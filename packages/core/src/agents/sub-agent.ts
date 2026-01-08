/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentMetadata } from '../services/agentManager.js';
import type {
  SubAgentContext,
  LocalAgentDefinition,
  AgentInputs,
  OutputObject,
} from './types.js';
import type { ActivityCallback } from './local-executor.js';
import { LocalAgentExecutor } from './local-executor.js';
import type { z } from 'zod';

export class SubAgent {
  constructor(
    private metadata: AgentMetadata,
    private context: SubAgentContext,
  ) {}

  async run(
    task: string,
    onActivity?: ActivityCallback,
    signal?: AbortSignal,
  ): Promise<OutputObject> {
    const definition: LocalAgentDefinition<z.ZodString> = {
      kind: 'local',
      name: this.metadata.name,
      description: this.metadata.description,
      inputConfig: {
        inputs: {
          task: {
            description: 'The task to perform',
            type: 'string',
            required: true,
          },
        },
      },
      promptConfig: {
        systemPrompt: this.metadata.body,
        query: '${task}',
      },
      modelConfig: {
        model: this.metadata.model ?? 'inherit',
        temp: 0.7,
        top_p: 0.95,
      },
      runConfig: {
        max_time_minutes: 5,
        max_turns: 20,
      },
      toolConfig: this.metadata.tools
        ? {
            tools: this.metadata.tools,
          }
        : undefined,
    };

    const executor = await LocalAgentExecutor.create(
      definition,
      this.context.config,
      onActivity,
    );

    const inputs: AgentInputs = {
      task,
    };

    return executor.run(inputs, signal ?? new AbortController().signal);
  }
}
