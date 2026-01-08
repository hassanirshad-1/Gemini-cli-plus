/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import yaml from 'js-yaml';
import { debugLogger } from '../utils/debugLogger.js';
import { Storage } from '../config/storage.js';
import type { AgentDefinition } from '../agents/types.js';

export interface AgentMetadata {
  name: string;
  description: string;
  location: string;
  body: string;
  tools?: string[];
  model?: string;
  disabled?: boolean;
  created_by?: string;
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)/;

export class AgentManager {
  private agents: AgentMetadata[] = [];

  /**
   * Clears all discovered agents.
   */
  clearAgents(): void {
    this.agents = [];
  }

  /**
   * Discovers agents from standard user and project locations.
   * Project agents take precedence over user agents.
   */
  async discoverAgents(storage: Storage): Promise<void> {
    this.clearAgents();

    // User agents first
    const userPaths = [Storage.getUserAgentsDir()];
    const userAgents = await this.discoverAgentsInternal(userPaths);
    this.addAgentsWithPrecedence(userAgents);

    // Project agents second (overwrites user agents with same name)
    const projectPaths = [storage.getProjectAgentsDir()];
    const projectAgents = await this.discoverAgentsInternal(projectPaths);
    this.addAgentsWithPrecedence(projectAgents);
  }

  private addAgentsWithPrecedence(newAgents: AgentMetadata[]): void {
    const agentMap = new Map<string, AgentMetadata>();
    for (const agent of [...this.agents, ...newAgents]) {
      agentMap.set(agent.name, agent);
    }
    this.agents = Array.from(agentMap.values());
  }

  /**
   * Discovers agents in the provided paths and adds them to the manager.
   * Internal helper for tiered discovery.
   */
  async discoverAgentsInternal(paths: string[]): Promise<AgentMetadata[]> {
    const discoveredAgents: AgentMetadata[] = [];
    const seenLocations = new Set(this.agents.map((s) => s.location));

    for (const searchPath of paths) {
      try {
        const absoluteSearchPath = path.resolve(searchPath);
        debugLogger.debug(`Discovering agents in: ${absoluteSearchPath}`);

        const stats = await fs.stat(absoluteSearchPath).catch(() => null);
        if (!stats || !stats.isDirectory()) {
          debugLogger.debug(
            `Search path is not a directory: ${absoluteSearchPath}`,
          );
          continue;
        }

        const agentFiles = await glob('*.md', {
          cwd: absoluteSearchPath,
          absolute: true,
          nodir: true,
        });

        debugLogger.debug(
          `Found ${agentFiles.length} potential agent files in ${absoluteSearchPath}`,
        );

        for (const agentFile of agentFiles) {
          if (seenLocations.has(agentFile)) {
            continue;
          }

          const metadata = await this.parseAgentFile(agentFile);
          if (metadata) {
            debugLogger.debug(
              `Discovered agent: ${metadata.name} at ${agentFile}`,
            );
            discoveredAgents.push(metadata);
            seenLocations.add(agentFile);
          }
        }
      } catch (error) {
        debugLogger.log(`Error discovering agents in ${searchPath}:`, error);
      }
    }

    return discoveredAgents;
  }

  /**
   * Returns the list of enabled discovered agents.
   */
  getAgents(): AgentMetadata[] {
    return this.agents.filter((s) => !s.disabled);
  }

  /**
   * Returns all discovered agents, including disabled ones.
   */
  getAllAgents(): AgentMetadata[] {
    return this.agents;
  }

  /**
   * Reads the full content (metadata + body) of an agent by name.
   */
  getAgent(name: string): AgentMetadata | null {
    return this.agents.find((s) => s.name === name) ?? null;
  }

  /**
   * Converts AgentMetadata to AgentDefinition.
   */
  static metadataToAgentDefinition(metadata: AgentMetadata): AgentDefinition {
    return {
      kind: 'local',
      name: metadata.name,
      description: metadata.description,
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
        systemPrompt: metadata.body,
        query: '${task}',
      },
      modelConfig: {
        model: metadata.model ?? 'inherit',
        temp: 0.7,
        top_p: 0.95,
      },
      runConfig: {
        max_time_minutes: 5,
        max_turns: 20,
      },
      toolConfig: metadata.tools
        ? {
            tools: metadata.tools,
          }
        : undefined,
    };
  }

  private async parseAgentFile(
    filePath: string,
  ): Promise<AgentMetadata | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const match = content.match(FRONTMATTER_REGEX);
      if (!match) {
        return null;
      }

      // Use yaml.load() which is safe in js-yaml v4.
      const frontmatter = yaml.load(match[1]);
      if (!frontmatter || typeof frontmatter !== 'object') {
        return null;
      }

      const { name, description, tools, model, disabled, created_by } =
        frontmatter as Record<string, unknown>;
      if (typeof name !== 'string') {
        return null;
      }

      const result: AgentMetadata = {
        name,
        description: typeof description === 'string' ? description : '',
        location: filePath,
        body: match[2].trim(),
      };

      if (Array.isArray(tools) && tools.every((t) => typeof t === 'string')) {
        result.tools = tools;
      }

      if (typeof model === 'string') {
        result.model = model;
      }

      if (typeof disabled === 'boolean') {
        result.disabled = disabled;
      }

      if (typeof created_by === 'string') {
        result.created_by = created_by;
      }

      return result;
    } catch (error) {
      debugLogger.log(`Error parsing agent file ${filePath}:`, error);
      return null;
    }
  }
}
