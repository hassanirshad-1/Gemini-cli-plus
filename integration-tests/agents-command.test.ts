/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach, afterEach } from 'vitest';
import { TestRig } from './test-helper.js';
import { expect } from 'vitest';

describe('agents command', () => {
  let rig: TestRig;

  beforeEach(() => {
    rig = new TestRig();
  });

  afterEach(async () => {
    await rig.cleanup();
  });

  it('lists and creates agents', async () => {
    process.env.GEMINI_API_KEY = 'dummy-key';
    rig.setup('agents-command-test', {
      settings: {
        experimental: {
          enableAgents: true,
        },
      },
    });

    // List agents (expect empty initially)
    const listResult1 = await rig.runCommand(['/agents', 'list']);
    expect(listResult1).toContain('No agents found.');

    // Create an agent
    const createResult = await rig.runCommand(['/agents', 'create', 'grader']);
    expect(createResult).toContain('Created agent "grader"');

    // Now list again
    const listResult2 = await rig.runCommand(['/agents', 'list']);
    expect(listResult2).toContain('Available Agents:');
    expect(listResult2).toContain('grader');

    // Create duplicate
    const createResult2 = await rig.runCommand(['/agents', 'create', 'grader']);
    expect(createResult2).toContain('Agent "grader" already exists');

    // Phase 4 Orchestration check
    // We expect the 'grader' agent to be available as a tool 'agent_grader'
    // To verify this in an integration test without actual LLM calls is hard,
    // but we can check if it's listed in the /tools output.
    const toolsResult = await rig.runCommand(['/tools']);
    expect(toolsResult).toContain('agent_grader');
  }, 60000);
});
