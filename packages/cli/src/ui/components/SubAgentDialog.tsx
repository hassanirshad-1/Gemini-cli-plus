/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { GeminiRespondingSpinner } from './GeminiRespondingSpinner.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { isNarrowWidth } from '../utils/isNarrowWidth.js';
import {
  SubAgent,
  type SubagentActivityEvent,
  MessageBusType,
  type ToolConfirmationRequest,
  ToolConfirmationOutcome,
  ApprovalMode,
} from '@google/gemini-cli-core';
import type { Config } from '@google/gemini-cli-core';
import { MessageType } from '../types.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { ShellConfirmationDialog } from './ShellConfirmationDialog.js';

interface SubAgentDialogProps {
  agentName: string;
  task: string;
  config: Config;
  onComplete: (result: string) => void;
  onCancel: () => void;
  onError: (error: Error) => void;
  // Callback to add items to the main history *while* the dialog is open (if needed)
  addHistoryItem: (item: any) => void;
}

const LOADING_PHRASES = [
  'Reasoning about the task...',
  'Analyzing requirements...',
  'Consulting specialized knowledge...',
  'Formulating a plan...',
  'Reviewing available tools...',
  'Constructing the solution...',
  'Verifying the output...',
  'Polishing the results...',
];

export const SubAgentDialog: React.FC<SubAgentDialogProps> = ({
  agentName,
  task,
  config,
  onComplete,
  onCancel,
  onError,
  addHistoryItem,
}) => {
  const { columns: terminalWidth } = useTerminalSize();
  const isNarrow = isNarrowWidth(terminalWidth);

  // State
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loadingPhrase, setLoadingPhrase] = useState(LOADING_PHRASES[0]);
  const [thoughts, setThoughts] = useState('');
  const [status, setStatus] = useState<'running' | 'cancelling' | 'finished'>(
    'running',
  );
  const [confirmationRequest, setConfirmationRequest] =
    useState<ToolConfirmationRequest | null>(null);

  const abortControllerRef = useRef<AbortController>(new AbortController());

  // Timer & Phrase Cycler
  useEffect(() => {
    const timer = setInterval(() => setElapsedTime((t) => t + 1), 1000);
    const phraseTimer = setInterval(() => {
      setLoadingPhrase((prev) => {
        const idx = LOADING_PHRASES.indexOf(prev);
        return LOADING_PHRASES[(idx + 1) % LOADING_PHRASES.length];
      });
    }, 3000);

    return () => {
      clearInterval(timer);
      clearInterval(phraseTimer);
    };
  }, []);

  // Subscribe to MessageBus for tool confirmation
  useEffect(() => {
    const messageBus = config.getMessageBus();
    const handleConfirmationRequest = (request: ToolConfirmationRequest) => {
      setConfirmationRequest(request);
    };

    const unsubscribe = messageBus.subscribe(
      MessageBusType.TOOL_CONFIRMATION_REQUEST,
      handleConfirmationRequest,
    );

    return () => {
      unsubscribe();
    };
  }, [config]);

  // Handle Input (Esc to cancel) using the app's native hook
  const handleKeypress = useCallback(
    (key: any) => {
      if (key.name === 'escape' && status === 'running') {
        setStatus('cancelling');
        abortControllerRef.current.abort();
      }
    },
    [status],
  );

  useKeypress(handleKeypress, { isActive: status === 'running' });

  // Run Agent
  useEffect(() => {
    let mounted = true;

    const runAgent = async () => {
      // Find agent metadata
      const agentManager = config.getAgentManager();
      const metadata = agentManager?.getAgent(agentName);

      if (!metadata) {
        if (mounted) onError(new Error(`Agent "${agentName}" not found.`));
        return;
      }

      // Create a proxy config to force interactive mode and user approval
      const forcedInteractiveConfig = Object.create(config);
      forcedInteractiveConfig.isInteractive = () => true;
      forcedInteractiveConfig.getApprovalMode = () => ApprovalMode.DEFAULT; // DEFAULT = Ask User

      const subAgent = new SubAgent(metadata, {
        config: forcedInteractiveConfig,
        messageBus: config.getMessageBus(),
      });

      try {
        const signal = abortControllerRef.current.signal;
        const result = await subAgent.run(
          task,
          (activity: SubagentActivityEvent) => {
            if (!mounted) return;

            if (activity.type === 'THOUGHT_CHUNK') {
              const text = activity.data['text'] as string;
              if (text) {
                setThoughts((prev) => prev + text);
              }
            } else if (activity.type === 'TOOL_CALL_START') {
              const name = activity.data['name'] as string;
              // Add tool call to history so it persists
              addHistoryItem({
                type: MessageType.INFO,
                text: `Running tool: ${name || 'unknown'}`,
              });
            }
          },
          signal,
        );

        if (mounted) {
          if (signal.aborted) {
            onCancel();
          } else {
            setStatus('finished');
            onComplete(result.result);
          }
        }
      } catch (error) {
        if (mounted) {
          // Check if it was an abort
          if (abortControllerRef.current.signal.aborted) {
            onCancel();
          } else {
            onError(error instanceof Error ? error : new Error(String(error)));
          }
        }
      }
    };

    runAgent();

    return () => {
      mounted = false;
      // Ensure we abort if unmounted while running
      if (status === 'running') {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirmation = (
    outcome: ToolConfirmationOutcome,
    approvedCommands?: string[],
  ) => {
    if (confirmationRequest) {
      const messageBus = config.getMessageBus();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      messageBus.publish({
        type: MessageBusType.TOOL_CONFIRMATION_RESPONSE,
        correlationId: confirmationRequest.correlationId,
        confirmed:
          outcome === ToolConfirmationOutcome.ProceedOnce ||
          outcome === ToolConfirmationOutcome.ProceedAlways,
        outcome,
        approvedCommands,
      });
      setConfirmationRequest(null);
    }
  };

  if (status === 'finished') return null;

  // Render Confirmation Dialog if request exists
  if (confirmationRequest && confirmationRequest.subType === 'exec') {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.border.default}
        paddingX={1}
      >
        <ShellConfirmationDialog
          request={{
            commands: confirmationRequest.commands,
            onConfirm: handleConfirmation,
          }}
        />
      </Box>
    );
  }

  // Render
  const cancelContent =
    status === 'cancelling'
      ? '(cancelling...)'
      : `(esc to cancel, ${elapsedTime}s)`;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border.default}
      paddingX={1}
    >
      {/* Header / Loading Line */}
      <Box
        width="100%"
        flexDirection={isNarrow ? 'column' : 'row'}
        alignItems={isNarrow ? 'flex-start' : 'center'}
      >
        <Box marginRight={1}>
          <GeminiRespondingSpinner />
        </Box>
        <Text color={theme.text.accent} wrap="truncate-end">
          {loadingPhrase}
        </Text>
        {!isNarrow && (
          <>
            <Box flexGrow={1} />
            <Text color={theme.text.secondary}>{cancelContent}</Text>
          </>
        )}
      </Box>

      {/* Streaming Thoughts Area - Latest Thought Line */}
      {thoughts.length > 0 && (
        <Box marginTop={1} paddingLeft={2}>
          <Text color={theme.text.secondary} italic wrap="truncate-end">
            {thoughts.split('\n').pop()?.slice(-terminalWidth + 10)}
          </Text>
        </Box>
      )}
    </Box>
  );
};