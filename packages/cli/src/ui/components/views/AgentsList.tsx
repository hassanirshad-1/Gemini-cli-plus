/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import { type AgentDefinition } from '../../types.js';

interface AgentsListProps {
  agents: readonly AgentDefinition[];
  showDescriptions: boolean;
}

export const AgentsList: React.FC<AgentsListProps> = ({
  agents,
  showDescriptions,
}) => {
  const enabledAgents = agents
    .filter((s) => !s.disabled)
    .sort((a, b) => a.name.localeCompare(b.name));

  const disabledAgents = agents
    .filter((s) => s.disabled)
    .sort((a, b) => a.name.localeCompare(b.name));

  const renderAgent = (agent: AgentDefinition) => (
    <Box key={agent.name} flexDirection="row">
      <Text color={theme.text.primary}>{'  '}- </Text>
      <Box flexDirection="column">
        <Box>
          <Text
            bold
            color={agent.disabled ? theme.text.secondary : theme.text.link}
          >
            {agent.name}
          </Text>
          {/* We could add badges here for (User) or (Project) if we parsed location */}
        </Box>
        {showDescriptions && agent.description && (
          <Box marginLeft={2}>
            <Text
              color={agent.disabled ? theme.text.secondary : theme.text.primary}
            >
              {agent.description}
            </Text>
          </Box>
        )}
        {showDescriptions && agent.location && (
          <Box marginLeft={2}>
            <Text color={theme.text.secondary} dimColor>
              Location: {agent.location}
              {agent.created_by ? ` • Created by: ${agent.created_by}` : ''}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" marginBottom={1}>
      {enabledAgents.length > 0 && (
        <Box flexDirection="column">
          <Text bold color={theme.text.primary}>
            Available Agents:
          </Text>
          <Box height={1} />
          {enabledAgents.map(renderAgent)}
        </Box>
      )}

      {enabledAgents.length > 0 && disabledAgents.length > 0 && (
        <Box marginY={1}>
          <Text color={theme.text.secondary}>{'-'.repeat(20)}</Text>
        </Box>
      )}

      {disabledAgents.length > 0 && (
        <Box flexDirection="column">
          <Text bold color={theme.text.secondary}>
            Disabled Agents:
          </Text>
          <Box height={1} />
          {disabledAgents.map(renderAgent)}
        </Box>
      )}

      {agents.length === 0 && (
        <Text color={theme.text.primary}> No agents found.</Text>
      )}
    </Box>
  );
};
