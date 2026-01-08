/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../semantic-colors.js';
import {
  RadioButtonSelect,
} from './shared/RadioButtonSelect.js';
import { TextInput } from './shared/TextInput.js';
import { useTextBuffer } from './shared/text-buffer.js';
import { Storage } from '@google/gemini-cli-core';

/**
 * Props for the CreationWorkflow component.
 */
export interface CreationWorkflowProps {
  /** Type of resource to create: 'agent' or 'skill'. */
  type: 'agent' | 'skill';
  /** The initial name for the resource, if provided via args. */
  initialName?: string;
  /** Callback when the workflow is completed. */
  onComplete: (result: CreationWorkflowResult) => void;
  /** Callback to cancel/exit the workflow. */
  onCancel: () => void;
  /** The storage instance for determining directory paths. */
  storage: Storage | null;
}

/**
 * Result of the creation workflow.
 */
export interface CreationWorkflowResult {
  /** Name of the resource. */
  name: string;
  /** Scope: 'project' or 'global'. */
  scope: 'project' | 'global';
  /** Creation method: 'gemini' or 'manual'. */
  method: 'gemini' | 'manual';
  /** Description/goal for AI generation. Only present if method is 'gemini'. */
  description?: string;
  /** Full path to the directory where the file should be created. */
  directoryPath: string;
}

type WorkflowStep = 'SCOPE' | 'METHOD' | 'DESCRIPTION' | 'NAME';

interface ScopeItem {
  label: string;
  value: 'project' | 'global';
  key: string;
}

interface MethodItem {
  label: string;
  value: 'gemini' | 'manual';
  key: string;
}

/**
 * An interactive multi-step component for creating agents or skills.
 * Inspired by Claude Code's orchestration workflow.
 */
export function CreationWorkflow({
  type,
  initialName,
  onComplete,
  onCancel,
  storage,
}: CreationWorkflowProps): React.JSX.Element {
  // Determine initial step based on whether name is provided
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(
    initialName ? 'SCOPE' : 'NAME',
  );
  const [name, setName] = useState(initialName || '');
  const [scope, setScope] = useState<'project' | 'global'>('project');
  const [method, setMethod] = useState<'gemini' | 'manual'>('gemini');
  const [nameValidationError, setNameValidationError] = useState<string | null>(
    null,
  );

  // Text buffer for name input
  const nameBuffer = useTextBuffer({
    initialText: initialName || '',
    viewport: { height: 1, width: 60 },
    isValidPath: () => false,
    singleLine: true,
  });

  // Text buffer for description input
  const descriptionBuffer = useTextBuffer({
    initialText: '',
    viewport: { height: 3, width: 60 },
    isValidPath: () => false,
    singleLine: true,
  });

  // Scope selection items
  const scopeItems: ScopeItem[] = useMemo(
    () => [
      {
        label: `Project (.gemini/${type}s/)`,
        value: 'project' as const,
        key: 'project',
      },
      {
        label: `Global (~/.gemini/${type}s/)`,
        value: 'global' as const,
        key: 'global',
      },
    ],
    [type],
  );

  // Method selection items
  const methodItems: MethodItem[] = useMemo(
    () => [
      {
        label: 'Generate with Gemini (recommended)',
        value: 'gemini' as const,
        key: 'gemini',
      },
      {
        label: 'Manual configuration',
        value: 'manual' as const,
        key: 'manual',
      },
    ],
    [],
  );

  // Get directory path based on scope and type
  const getDirectoryPath = useCallback(
    (selectedScope: 'project' | 'global'): string => {
      if (type === 'agent') {
        return selectedScope === 'project' && storage
          ? storage.getProjectAgentsDir()
          : Storage.getUserAgentsDir();
      } else {
        return selectedScope === 'project' && storage
          ? storage.getProjectSkillsDir()
          : Storage.getUserSkillsDir();
      }
    },
    [type, storage],
  );

  // Validate name
  const validateName = useCallback((inputName: string): string | null => {
    if (!inputName.trim()) {
      return 'Name is required.';
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(inputName)) {
      return 'Name can only contain letters, numbers, underscores, and hyphens.';
    }
    return null;
  }, []);

  // Handle name submission
  const handleNameSubmit = useCallback(
    (submittedName: string) => {
      const error = validateName(submittedName);
      if (error) {
        setNameValidationError(error);
        return;
      }
      setNameValidationError(null);
      setName(submittedName);
      setCurrentStep('SCOPE');
    },
    [validateName],
  );

  // Handle scope selection
  const handleScopeSelect = useCallback((selectedScope: 'project' | 'global') => {
    setScope(selectedScope);
    setCurrentStep('METHOD');
  }, []);

  // Handle method selection
  const handleMethodSelect = useCallback(
    (selectedMethod: 'gemini' | 'manual') => {
      setMethod(selectedMethod);
      if (selectedMethod === 'gemini') {
        setCurrentStep('DESCRIPTION');
      } else {
        // Manual: complete the workflow
        onComplete({
          name,
          scope,
          method: selectedMethod,
          directoryPath: getDirectoryPath(scope),
        });
      }
    },
    [name, scope, getDirectoryPath, onComplete],
  );

  // Handle description submission
  const handleDescriptionSubmit = useCallback(
    (submittedDescription: string) => {
      onComplete({
        name,
        scope,
        method,
        description: submittedDescription,
        directoryPath: getDirectoryPath(scope),
      });
    },
    [name, scope, method, getDirectoryPath, onComplete],
  );

  // Handle Escape to cancel/go back
  useInput((input, key) => {
    if (key.escape) {
      if (currentStep === 'NAME') {
        onCancel();
      } else if (currentStep === 'SCOPE') {
        if (!initialName) {
          setCurrentStep('NAME');
        } else {
          onCancel();
        }
      } else if (currentStep === 'METHOD') {
        setCurrentStep('SCOPE');
      } else if (currentStep === 'DESCRIPTION') {
        setCurrentStep('METHOD');
      }
    }
  });

  const typeLabel = type === 'agent' ? 'Agent' : 'Skill';
  const typeIcon = type === 'agent' ? '🤖' : '📘';

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={theme.text.primary}>
          {typeIcon} Create New {typeLabel}
        </Text>
      </Box>

      {/* Step: Name */}
      {currentStep === 'NAME' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.text.secondary}>
              Step 1: Enter a name for your {type}
            </Text>
          </Box>
          <Box>
            <Text color={theme.text.primary}>Name: </Text>
            <TextInput
              buffer={nameBuffer}
              placeholder={`my-${type}-name`}
              onSubmit={handleNameSubmit}
              onCancel={onCancel}
              focus={true}
            />
          </Box>
          {nameValidationError && (
            <Box marginTop={1}>
              <Text color={theme.status.error}>{nameValidationError}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color={theme.text.secondary} dimColor>
              Press Enter to continue, Esc to cancel
            </Text>
          </Box>
        </Box>
      )}

      {/* Step: Scope */}
      {currentStep === 'SCOPE' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.text.secondary}>
              Step {initialName ? '1' : '2'}: Choose location for "{name}"
            </Text>
          </Box>
          <RadioButtonSelect<'project' | 'global'>
            items={scopeItems}
            initialIndex={0}
            onSelect={handleScopeSelect}
            isFocused={true}
            showNumbers={true}
          />
          <Box marginTop={1}>
            <Text color={theme.text.secondary} dimColor>
              Press number or Enter to select, Esc to go back
            </Text>
          </Box>
        </Box>
      )}

      {/* Step: Method */}
      {currentStep === 'METHOD' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.text.secondary}>
              Step {initialName ? '2' : '3'}: Choose creation method
            </Text>
          </Box>
          <RadioButtonSelect<'gemini' | 'manual'>
            items={methodItems}
            initialIndex={0}
            onSelect={handleMethodSelect}
            isFocused={true}
            showNumbers={true}
          />
          <Box marginTop={1}>
            <Text color={theme.text.secondary} dimColor>
              Press number or Enter to select, Esc to go back
            </Text>
          </Box>
        </Box>
      )}

      {/* Step: Description (for Gemini generation) */}
      {currentStep === 'DESCRIPTION' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.text.secondary}>
              Step {initialName ? '3' : '4'}: Describe what this {type} should
              do
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color={theme.text.secondary} dimColor>
              Gemini will use the current conversation context along with your
              description.
            </Text>
          </Box>
          <Box>
            <Text color={theme.text.primary}>Goal: </Text>
            <TextInput
              buffer={descriptionBuffer}
              placeholder={`e.g., "Help me with FastAPI development"`}
              onSubmit={handleDescriptionSubmit}
              onCancel={() => setCurrentStep('METHOD')}
              focus={true}
            />
          </Box>
          <Box marginTop={1}>
            <Text color={theme.text.secondary} dimColor>
              Press Enter to generate, Esc to go back
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
