/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { glob } from 'glob';
import { AgentManager } from './agentManager.js';
import { Storage } from '../config/storage.js';
import * as path from 'node:path';

vi.mock('node:fs/promises');
vi.mock('glob');
vi.mock('../config/storage.js');

describe('AgentManager', () => {
  let agentManager: AgentManager;
  let mockStorage: Storage;

  beforeEach(() => {
    agentManager = new AgentManager();
    mockStorage = new Storage('/mock/project/root');
    vi.resetAllMocks();

    // Mock Storage static methods
    vi.mocked(Storage.getUserAgentsDir).mockReturnValue('/mock/user/agents');
    // Mock Storage instance methods
    vi.mocked(mockStorage.getProjectAgentsDir).mockReturnValue(
      '/mock/project/agents',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should discover agents from user and project directories', async () => {
    // Setup file system mocks
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => true,
    } as unknown as Stats);

    // Mock glob to return files
    vi.mocked(glob).mockImplementation(async (pattern, options) => {
      if (options?.cwd === path.resolve('/mock/user/agents')) {
        return [path.resolve('/mock/user/agents/user-agent.md')];
      }
      if (options?.cwd === path.resolve('/mock/project/agents')) {
        return [path.resolve('/mock/project/agents/project-agent.md')];
      }
      return [];
    });

    // Mock fs.readFile to return content
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      if (filePath === path.resolve('/mock/user/agents/user-agent.md')) {
        return `---
name: user-agent
description: A user agent
---
User agent body`;
      }
      if (filePath === path.resolve('/mock/project/agents/project-agent.md')) {
        return `---
name: project-agent
description: A project agent
tools: [tool1]
model: gemini-pro
---
Project agent body`;
      }
      return '';
    });

    await agentManager.discoverAgents(mockStorage);

    const agents = agentManager.getAgents();
    expect(agents).toHaveLength(2);

    const userAgent = agents.find((a) => a.name === 'user-agent');
    expect(userAgent).toBeDefined();
    expect(userAgent?.description).toBe('A user agent');
    expect(userAgent?.body).toBe('User agent body');
    expect(userAgent?.location).toBe(
      path.resolve('/mock/user/agents/user-agent.md'),
    );

    const projectAgent = agents.find((a) => a.name === 'project-agent');
    expect(projectAgent).toBeDefined();
    expect(projectAgent?.description).toBe('A project agent');
    expect(projectAgent?.body).toBe('Project agent body');
    expect(projectAgent?.tools).toEqual(['tool1']);
    expect(projectAgent?.model).toBe('gemini-pro');
  });

  it('should prioritize project agents over user agents with the same name', async () => {
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => true,
    } as unknown as Stats);

    vi.mocked(glob).mockImplementation(async (pattern, options) => {
      if (options?.cwd === path.resolve('/mock/user/agents')) {
        return [path.resolve('/mock/user/agents/common-agent.md')];
      }
      if (options?.cwd === path.resolve('/mock/project/agents')) {
        return [path.resolve('/mock/project/agents/common-agent.md')];
      }
      return [];
    });

    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      if (filePath === path.resolve('/mock/user/agents/common-agent.md')) {
        return `---
name: common-agent
description: User version
---
User body`;
      }
      if (filePath === path.resolve('/mock/project/agents/common-agent.md')) {
        return `---
name: common-agent
description: Project version
---
Project body`;
      }
      return '';
    });

    await agentManager.discoverAgents(mockStorage);

    const agents = agentManager.getAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('common-agent');
    expect(agents[0].description).toBe('Project version');
    expect(agents[0].body).toBe('Project body');
    expect(agents[0].location).toBe(
      path.resolve('/mock/project/agents/common-agent.md'),
    );
  });

  it('should ignore malformed agent files', async () => {
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => true,
    } as unknown as Stats);
    vi.mocked(glob).mockResolvedValue([
      path.resolve('/mock/user/agents/bad.md'),
    ]);

    vi.mocked(fs.readFile).mockResolvedValue('Invalid content'); // No frontmatter

    await agentManager.discoverAgents(mockStorage);

    expect(agentManager.getAgents()).toHaveLength(0);
  });

  it('should filter out disabled agents', async () => {
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => true,
    } as unknown as Stats);
    vi.mocked(glob).mockResolvedValue([
      path.resolve('/mock/user/agents/disabled.md'),
    ]);

    vi.mocked(fs.readFile).mockResolvedValue(`---
name: disabled-agent
description: Disabled
disabled: true
---
Body`);

    await agentManager.discoverAgents(mockStorage);

    expect(agentManager.getAgents()).toHaveLength(0);
    expect(agentManager.getAllAgents()).toHaveLength(1);
  });
});
