/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubAgent } from './sub-agent.js';
import type { AgentMetadata } from '../services/agentManager.js';
import type { ActivityCallback } from './local-executor.js';
import { LocalAgentExecutor } from './local-executor.js';
import type { SubAgentContext } from './types.js';
import { AgentTerminateMode } from './types.js';
import type { Config } from '../config/config.js';
import type { z } from 'zod';

vi.mock('./local-executor.js');

describe('SubAgent', () => {
  const mockMetadata: AgentMetadata = {
    name: 'test-agent',
    description: 'A test agent',
    location: '/path/to/agent.md',
    body: 'You are a test agent.',
    tools: ['ls', 'read_file'],
  };

  const mockConfig = {
    getActiveModel: vi.fn().mockReturnValue('gemini-pro'),
    getToolRegistry: vi.fn().mockReturnValue({
      getTool: vi.fn(),
    }),
  } as unknown as Config;

  const mockContext: SubAgentContext = {
    config: mockConfig,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should run a task and return output', async () => {
    const mockExecutor = {
      run: vi.fn().mockResolvedValue({
        result: 'Task result',
        terminate_reason: AgentTerminateMode.GOAL,
      }),
    };

    vi.mocked(LocalAgentExecutor.create).mockResolvedValue(
      mockExecutor as unknown as LocalAgentExecutor<z.ZodTypeAny>,
    );

    const subAgent = new SubAgent(mockMetadata, mockContext);
    const output = await subAgent.run('Hello');

    expect(output.result).toBe('Task result');
    expect(output.terminate_reason).toBe(AgentTerminateMode.GOAL);
    expect(LocalAgentExecutor.create).toHaveBeenCalled();

    // Check if definition passed to create has correct systemPrompt
    const [definition] = vi.mocked(LocalAgentExecutor.create).mock.calls[0];
    expect(definition.promptConfig.systemPrompt).toBe(mockMetadata.body);
    expect(definition.toolConfig?.tools).toEqual(mockMetadata.tools);
  });

  it('should handle activity reporting', async () => {
    const mockExecutor = {
      run: vi.fn().mockResolvedValue({
        result: 'Done',
        terminate_reason: AgentTerminateMode.GOAL,
      }),
    };

    vi.mocked(LocalAgentExecutor.create).mockResolvedValue(
      mockExecutor as unknown as LocalAgentExecutor<z.ZodTypeAny>,
    );

    const onActivity: ActivityCallback = vi.fn();
    const subAgent = new SubAgent(mockMetadata, mockContext);
    await subAgent.run('Task with activity', onActivity);

    // Verify onActivity is passed to LocalAgentExecutor.create
    const [, , passedOnActivity] = vi.mocked(LocalAgentExecutor.create).mock
      .calls[0];
    expect(passedOnActivity).toBe(onActivity);
  });
});
