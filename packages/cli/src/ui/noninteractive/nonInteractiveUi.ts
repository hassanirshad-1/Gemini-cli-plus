/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandContext } from '../commands/types.js';
import type { ExtensionUpdateAction } from '../state/extensions.js';
import { MessageType } from '../types.js';
import { TextOutput } from '../utils/textOutput.js';

/**
 * Creates a UI context object with no-op functions.
 * Useful for non-interactive environments where UI operations
 * are not applicable.
 */
export function createNonInteractiveUI(): CommandContext['ui'] {
  const textOutput = new TextOutput();
  return {
    addItem: (item, _timestamp) => {
      if (
        item.type === MessageType.INFO ||
        item.type === MessageType.ERROR ||
        item.type === MessageType.WARNING
      ) {
        textOutput.writeOnNewLine(
          `[${item.type.toUpperCase()}] ${item.text}\n`,
        );
      } else if (item.type === MessageType.AGENTS_LIST) {
        const agentsItem = item as any; // Cast to bypass narrowing issue with Omit union
        textOutput.writeOnNewLine('Available Agents:\n');
        if (agentsItem.agents.length === 0) {
          textOutput.write(' No agents found.\n');
        } else {
          for (const agent of agentsItem.agents) {
            textOutput.write(
              ` - ${agent.name}: ${agent.description} (${agent.location})\n`,
            );
          }
        }
      }
      return 0;
    },
    clear: () => {},
    setDebugMessage: (_message) => {},
    loadHistory: (_newHistory) => {},
    pendingItem: null,
    setPendingItem: (_item) => {},
    toggleCorgiMode: () => {},
    toggleDebugProfiler: () => {},
    toggleVimEnabled: async () => false,
    reloadCommands: () => {},
    extensionsUpdateState: new Map(),
    dispatchExtensionStateUpdate: (_action: ExtensionUpdateAction) => {},
    addConfirmUpdateExtensionRequest: (_request) => {},
    removeComponent: () => {},
    submitPrompt: (_prompt) => {},
  };
}
