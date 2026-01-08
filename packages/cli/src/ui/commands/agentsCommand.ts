/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createElement } from 'react';
import {
  type CommandContext,
  type SlashCommand,
  type SlashCommandActionReturn,
  CommandKind,
} from './types.js';
import { MessageType, type HistoryItemAgentsList } from '../types.js';
// Storage is imported via context.services.config.storage
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import {
  SubAgent,
  type SubagentActivityEvent,
} from '@google/gemini-cli-core';

async function listAction(
  context: CommandContext,
  args: string,
): Promise<void | SlashCommandActionReturn> {
  const subCommand = args.trim();

  // Default to SHOWING descriptions. The user can hide them with 'nodesc'.
  let useShowDescriptions = true;
  if (subCommand === 'nodesc') {
    useShowDescriptions = false;
  }

  const agentManager = context.services.config?.getAgentManager();
  if (!agentManager) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Could not retrieve agent manager.',
      },
      Date.now(),
    );
    return;
  }

  // Refresh agents
  if (context.services.config?.storage) {
    await agentManager.discoverAgents(context.services.config.storage);
  }

  const agents = agentManager.getAllAgents();

  const agentsListItem: HistoryItemAgentsList = {
    type: MessageType.AGENTS_LIST,
    agents: agents.map((agent) => ({
      name: agent.name,
      description: agent.description,
      location: agent.location,
      tools: agent.tools,
      model: agent.model,
      disabled: agent.disabled,
      created_by: agent.created_by,
    })),
    showDescriptions: useShowDescriptions,
  };

  context.ui.addItem(agentsListItem, Date.now());
}

async function createAction(
  context: CommandContext,
  args: string,
): Promise<void | SlashCommandActionReturn> {
  const agentName = args.trim() || undefined;

  // If a name is provided, validate it
  if (agentName && !/^[a-zA-Z0-9_-]+$/.test(agentName)) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Agent name can only contain letters, numbers, underscores, and hyphens.',
      },
      Date.now(),
    );
    return;
  }

  // If a name is provided, check if agent already exists
  if (agentName) {
    const agentManager = context.services.config?.getAgentManager();
    if (agentManager?.getAgent(agentName)) {
      context.ui.addItem(
        {
          type: MessageType.WARNING,
          text: `Agent "${agentName}" already exists.`,
        },
        Date.now(),
      );
      return;
    }
  }

  const storage = context.services.config?.storage ?? null;

  // Return the CreationWorkflow component as a custom dialog
  return {
    type: 'custom_dialog',
    component: createElement(
      (await import('../components/CreationWorkflow.js')).CreationWorkflow,
      {
        type: 'agent',
        initialName: agentName,
        storage,
        onComplete: async (result) => {
          // Remove the dialog
          context.ui.removeComponent();

          const filePath = path.join(result.directoryPath, `${result.name}.md`);

          // Ensure directory exists
          try {
            await fs.mkdir(result.directoryPath, { recursive: true });
          } catch {
            // Directory might already exist
          }

          if (result.method === 'manual') {
            // Create a minimal template for manual configuration
            const template = `--- 
name: "${result.name}"
description: "A specialized agent for ${result.name}-related tasks."
tools: []
model: "inherit"
created_by: "manual"
---

# ${result.name} Agent

You are a specialized sub-agent.

## Expertise
<!-- Add your expertise here -->

## Approach
<!-- Define your methodology -->

## Constraints
<!-- List any limitations -->
`;
            try {
              await fs.writeFile(filePath, template, 'utf-8');
              context.ui.addItem(
                {
                  type: MessageType.INFO,
                  text: `✅ Created agent template at: ${filePath}\nEdit the file to customize your agent.`,
                },
                Date.now(),
              );
            } catch (error) {
              context.ui.addItem(
                {
                  type: MessageType.ERROR,
                  text: `Failed to create agent: ${error instanceof Error ? error.message : String(error)}`,
                },
                Date.now(),
              );
            }
          } else {
            // For Gemini generation, submit a prompt
            // We need to handle this differently - for now, add an info message
            // and let the user know to provide a prompt
            const prompt = `Create a sub-agent definition file for "${result.name}" based on our current conversation and the following goal: "${result.description || 'General-purpose specialist'}".

Use this format exactly:
\`\`\`markdown
---
name: "${result.name}"
description: "<Write a clear description of what this agent specializes in and when to delegate to it.>"
tools: [] # Optional: List specific tools this agent can use, or leave empty for all
model: "inherit" # Use parent's model, or specify a model like "gemini-2.0-flash"
created_by: "gemini"
---

# ${result.name} Agent

You are a specialized sub-agent focused on ${result.name}-related tasks.

## Expertise
<Describe the specific domain knowledge this agent has based on our conversation and the goal: "${result.description || 'General-purpose specialist'}">

## Approach
<Step-by-step methodology this agent should follow>

## Constraints
- <Any limitations or boundaries for this agent>

## Examples
<Include example tasks this agent handles well>
\`\`\`

IMPORTANT: 
- Use the KNOWLEDGE from our conversation to populate this agent with REAL, USEFUL expertise
- Sub-agents run in ISOLATED context - they should be self-contained specialists
- Do NOT create a generic template - capture the actual expertise we discussed
- Save the file to: ${filePath}
- After creating, confirm the agent was saved successfully`;

            context.ui.addItem(
              {
                type: MessageType.INFO,
                text: `🤖 Generating agent "${result.name}" with Gemini...`,
              },
              Date.now(),
            );

            // Submit the prompt for Gemini generation
            context.ui.submitPrompt(prompt);
          }
        },
        onCancel: () => {
          context.ui.removeComponent();
          context.ui.addItem(
            {
              type: MessageType.INFO,
              text: 'Agent creation cancelled.',
            },
            Date.now(),
          );
        },
      },
    ),
  };
}


async function runAction(
  context: CommandContext,
  args: string,
): Promise<void | SlashCommandActionReturn> {
  const parts = args.trim().split(/\s+/);
  const agentName = parts[0];
  const task = parts.slice(1).join(' ');

  if (!agentName || !task) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Please provide an agent name and a task. Usage: /agents run <name> <task>',
      },
      Date.now(),
    );
    return;
  }

  const agentManager = context.services.config?.getAgentManager();
  const metadata = agentManager?.getAgent(agentName);

  if (!metadata) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `Agent "${agentName}" not found.`,
      },
      Date.now(),
    );
    return;
  }

  if (!context.services.config) {
    return;
  }

  const subAgent = new SubAgent(metadata, {
    config: context.services.config,
  });

    try {
      const onActivity = (activity: SubagentActivityEvent) => {
        if (activity.type === 'THOUGHT_CHUNK') {
          context.ui.setDebugMessage(
            `Sub-agent thinking: ${activity.data['text']}`,
          );
        } else if (activity.type === 'TOOL_CALL_START') {
          context.ui.addItem(
            {
              type: MessageType.INFO,
              text: `Sub-agent calling tool: ${activity.data['name']}`,
            },
            Date.now(),
          );
        }
      };

      const output = await subAgent.run(task, onActivity);

      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `Sub-agent "${agentName}" finished. Result:\n\n${output.result}`,
        },
        Date.now(),
      );
    } catch (error) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: `Sub-agent "${agentName}" failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        Date.now(),
      );
    }
}

export const agentsCommand: SlashCommand = {
  name: 'agents',
  description:
    'List or create Gemini CLI agents. Usage: /agents [list | create <name>]',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  subCommands: [
    {
      name: 'list',
      description: 'List available agents. Usage: /agents list [nodesc]',
      kind: CommandKind.BUILT_IN,
      action: listAction,
    },
    {
      name: 'create',
      description: 'Create a new agent. Usage: /agents create <name>',
      kind: CommandKind.BUILT_IN,
      action: createAction,
    },
    {
      name: 'run',
      description: 'Run an agent task. Usage: /agents run <name> <task>',
      kind: CommandKind.BUILT_IN,
      action: runAction,
    },
  ],
  action: listAction,
};