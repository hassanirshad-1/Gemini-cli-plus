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
import { MessageType, type HistoryItemSkillsList } from '../types.js';
import { SettingScope } from '../../config/settings.js';
// Storage is imported via context.services.config.storage
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

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

  const skillManager = context.services.config?.getSkillManager();
  if (!skillManager) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Could not retrieve skill manager.',
      },
      Date.now(),
    );
    return;
  }

  // Refresh skills
  if (context.services.config?.storage) {
    await skillManager.discoverSkills(context.services.config.storage);
  }

  const skills = skillManager.getAllSkills();

  const skillsListItem: HistoryItemSkillsList = {
    type: MessageType.SKILLS_LIST,
    skills: skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      location: skill.location,
      disabled: skill.disabled,
      created_by: skill.created_by,
    })),
    showDescriptions: useShowDescriptions,
  };

  context.ui.addItem(skillsListItem, Date.now());
}

async function disableAction(
  context: CommandContext,
  args: string,
): Promise<void | SlashCommandActionReturn> {
  const skillName = args.trim();
  if (!skillName) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Please provide a skill name to disable.',
      },
      Date.now(),
    );
    return;
  }
  const skillManager = context.services.config?.getSkillManager();
  const skill = skillManager?.getSkill(skillName);
  if (!skill) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `Skill "${skillName}" not found.`,
      },
      Date.now(),
    );
    return;
  }

  const currentDisabled =
    context.services.settings.merged.skills?.disabled ?? [];
  if (currentDisabled.includes(skillName)) {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `Skill "${skillName}" is already disabled.`,
      },
      Date.now(),
    );
    return;
  }

  const newDisabled = [...currentDisabled, skillName];
  const scope = context.services.settings.workspace.path
    ? SettingScope.Workspace
    : SettingScope.User;

  context.services.settings.setValue(scope, 'skills.disabled', newDisabled);
  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `Skill "${skillName}" disabled in ${scope} settings. Restart required to take effect.`,
    },
    Date.now(),
  );
}

async function enableAction(
  context: CommandContext,
  args: string,
): Promise<void | SlashCommandActionReturn> {
  const skillName = args.trim();
  if (!skillName) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Please provide a skill name to enable.',
      },
      Date.now(),
    );
    return;
  }

  const currentDisabled =
    context.services.settings.merged.skills?.disabled ?? [];
  if (!currentDisabled.includes(skillName)) {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `Skill "${skillName}" is not disabled.`,
      },
      Date.now(),
    );
    return;
  }

  const newDisabled = currentDisabled.filter((name) => name !== skillName);
  const scope = context.services.settings.workspace.path
    ? SettingScope.Workspace
    : SettingScope.User;

  context.services.settings.setValue(scope, 'skills.disabled', newDisabled);
  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `Skill "${skillName}" enabled in ${scope} settings. Restart required to take effect.`,
    },
    Date.now(),
  );
}

async function createAction(
  context: CommandContext,
  args: string,
): Promise<void | SlashCommandActionReturn> {
  const skillName = args.trim() || undefined;

  // If a name is provided, validate it
  if (skillName && !/^[a-zA-Z0-9_-]+$/.test(skillName)) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Skill name can only contain letters, numbers, underscores, and hyphens.',
      },
      Date.now(),
    );
    return;
  }

  // If a name is provided, check if skill already exists
  if (skillName) {
    const skillManager = context.services.config?.getSkillManager();
    if (skillManager?.getSkill(skillName)) {
      context.ui.addItem(
        {
          type: MessageType.WARNING,
          text: `Skill "${skillName}" already exists.`,
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
        type: 'skill',
        initialName: skillName,
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
description: "<Write a clear description of when this skill should activate. Include trigger phrases.>"
created_by: "manual"
---
# ${result.name} Skill

## Use Cases
<!-- Define when to use this skill -->

## Instructions
<!-- Detailed instructions for the model -->

## Examples
<!-- Positive and negative examples -->
`;
            try {
              await fs.writeFile(filePath, template, 'utf-8');
              context.ui.addItem(
                {
                  type: MessageType.INFO,
                  text: `✅ Created skill template at: ${filePath}\nEdit the file to customize your skill.`,
                },
                Date.now(),
              );
            } catch (error) {
              context.ui.addItem(
                {
                  type: MessageType.ERROR,
                  text: `Failed to create skill: ${error instanceof Error ? error.message : String(error)}`,
                },
                Date.now(),
              );
            }
          } else {
            // For Gemini generation, submit a prompt
            const prompt = `Create a SKILL.md file for "${result.name}" based on our current conversation and the following goal: "${result.description || 'General-purpose knowledge'}".

Use this format exactly:
\`\`\`markdown
---
name: "${result.name}"
description: "<Write a clear description of when this skill should activate. Include trigger phrases.>"
created_by: "gemini"
---

# ${result.name} Skill

## Use Cases
<Describe specific scenarios where this skill is applicable based on our conversation and the goal: "${result.description || 'General-purpose knowledge'}">

## Instructions
<Detailed instructions for how the model should apply this skill's knowledge>

## Examples
<Include examples of how this skill improves responses>
\`\`\`

IMPORTANT: 
- Use the KNOWLEDGE from our conversation to populate this skill with REAL, USEFUL information
- Skills are for TEACHING behaviors/knowledge within the SAME context
- Do NOT create a generic template - capture the actual expertise we discussed
- Save the file to: ${filePath}
- After creating, confirm the skill was saved successfully`;

            context.ui.addItem(
              {
                type: MessageType.INFO,
                text: `🤖 Generating skill "${result.name}" with Gemini...`,
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
              text: 'Skill creation cancelled.',
            },
            Date.now(),
          );
        },
      },
    ),
  };
}


function disableCompletion(
  context: CommandContext,
  partialArg: string,
): string[] {
  const skillManager = context.services.config?.getSkillManager();
  if (!skillManager) {
    return [];
  }
  return skillManager
    .getAllSkills()
    .filter((s) => !s.disabled && s.name.startsWith(partialArg))
    .map((s) => s.name);
}

function enableCompletion(
  context: CommandContext,
  partialArg: string,
): string[] {
  const skillManager = context.services.config?.getSkillManager();
  if (!skillManager) {
    return [];
  }
  return skillManager
    .getAllSkills()
    .filter((s) => s.disabled && s.name.startsWith(partialArg))
    .map((s) => s.name);
}

export const skillsCommand: SlashCommand = {
  name: 'skills',
  description:
    'List, create, enable, or disable Gemini CLI skills. Usage: /skills [list | create <name> | disable <name> | enable <name>]',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  subCommands: [
    {
      name: 'list',
      description: 'List available agent skills. Usage: /skills list [nodesc]',
      kind: CommandKind.BUILT_IN,
      action: listAction,
    },
    {
      name: 'create',
      description: 'Create a new skill. Usage: /skills create <name>',
      kind: CommandKind.BUILT_IN,
      action: createAction,
    },
    {
      name: 'disable',
      description: 'Disable a skill by name. Usage: /skills disable <name>',
      kind: CommandKind.BUILT_IN,
      action: disableAction,
      completion: disableCompletion,
    },
    {
      name: 'enable',
      description:
        'Enable a disabled skill by name. Usage: /skills enable <name>',
      kind: CommandKind.BUILT_IN,
      action: enableAction,
      completion: enableCompletion,
    },
  ],
  action: listAction,
};