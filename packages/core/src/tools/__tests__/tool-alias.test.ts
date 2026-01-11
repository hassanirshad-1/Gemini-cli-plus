import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../tool-registry.js';
import { Config } from '../../config/config.js';
import { ApprovalMode } from '../../policy/types.js';

describe('Tool Aliases', () => {
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    const config = new Config({
      sessionId: 'test-session',
      cwd: '/tmp',
      model: 'test-model',
      embeddingModel: 'test-embedding-model',
      targetDir: '/test/dir',
      debugMode: false,
      approvalMode: ApprovalMode.YOLO,
    });
    toolRegistry = new ToolRegistry(config);
  });

  describe('resolveToolName', () => {
    it('should resolve hallucinated file system tool names', () => {
      expect(toolRegistry.resolveToolName('file_system.write')).toBe('write_file');
      expect(toolRegistry.resolveToolName('file_system.read')).toBe('read_file');
      expect(toolRegistry.resolveToolName('file_system.list')).toBe('list_directory');
    });

    it('should resolve tool_code_write_file to write_file', () => {
      expect(toolRegistry.resolveToolName('tool_code_write_file')).toBe('write_file');
    });

    it('should return the original name if no alias exists', () => {
      expect(toolRegistry.resolveToolName('unknown_tool')).toBe('unknown_tool');
      expect(toolRegistry.resolveToolName('write_file')).toBe('write_file');
    });
  });
});
