/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  BaseDeclarativeTool,
  Kind,
  type ToolInvocation,
  type ToolResult,
  BaseToolInvocation,
} from '../tools/tools.js';
import type { AnsiOutput } from '../utils/terminalSerializer.js';
import type { Config } from '../config/config.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { AgentMetadata } from '../services/agentManager.js';
import { SubAgent } from './sub-agent.js';
import type { SubagentActivityEvent } from './types.js';

interface SubAgentToolParams {
  task: string;
}

const schema = z.object({
  task: z.string().describe('The task to delegate to the specialized agent.'),
});

/**
 * A tool that wraps a discovered Sub-Agent.
 */
export class SubAgentTool extends BaseDeclarativeTool<
  SubAgentToolParams,
  ToolResult
> {
  constructor(
    private readonly metadata: AgentMetadata,
    private readonly config: Config,
    messageBus?: MessageBus,
  ) {
    super(
      `agent_${metadata.name}`,
      `Agent: ${metadata.name}`,
      `Execute a task using the specialized "${metadata.name}" agent. Description: ${metadata.description}`,
      Kind.Think,
      zodToJsonSchema(schema),
      /* isOutputMarkdown */ true,
      /* canUpdateOutput */ true,
      messageBus,
    );
  }

  protected createInvocation(
    params: SubAgentToolParams,
  ): ToolInvocation<SubAgentToolParams, ToolResult> {
    return new SubAgentInvocation(
      this.metadata,
      params,
      this.config,
      this.messageBus,
    );
  }
}

class SubAgentInvocation extends BaseToolInvocation<
  SubAgentToolParams,
  ToolResult
> {
  constructor(
    private readonly metadata: AgentMetadata,
    params: SubAgentToolParams,
    private readonly config: Config,
    messageBus?: MessageBus,
  ) {
    super(params, messageBus, `agent_${metadata.name}`);
  }

  getDescription(): string {
    return `Delegating task to agent '${this.metadata.name}'`;
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: string | AnsiOutput) => void,
  ): Promise<ToolResult> {
    const subAgent = new SubAgent(this.metadata, {
      config: this.config,
      messageBus: this.messageBus,
    });

    const onActivity = (activity: SubagentActivityEvent) => {
      if (!updateOutput) return;
      if (activity.type === 'THOUGHT_CHUNK' && activity.data['text']) {
        updateOutput(`🤖💭 ${this.metadata.name}: ${activity.data['text']}`);
      } else if (activity.type === 'TOOL_CALL_START') {
        updateOutput(
          `🔧 ${this.metadata.name} calling: ${activity.data['name']}`,
        );
      }
    };

    const output = await subAgent.run(this.params.task, onActivity, signal);

    return {
      llmContent: [{ text: output.result }],
      returnDisplay: `### Sub-Agent "${this.metadata.name}" Result\n\n${output.result}`,
    };
  }
}
