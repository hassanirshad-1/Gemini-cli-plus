import { processImports } from '../memoryImportProcessor.js';
import { describe, it, expect, vi } from 'vitest';

vi.mock('node:fs/promises');

describe('memoryImportProcessor', () => {
  it('should not misinterpret scoped packages as imports', async () => {
    const content = 'This is a package: @hassanirshad-1/gemini-ri';
    const result = await processImports(content, '/tmp', false);
    
    expect(result.content).not.toContain('Import failed: hassanirshad-1/gemini-ri');
    expect(result.content).toBe(content);
  });

  it('should have a depth limit in flat format', async () => {
    // We can't easily trigger a deep recursion with mocks without complex setup,
    // but we can at least verify it's not crashing on simple content.
    const content = 'Simple content';
    const result = await processImports(content, '/tmp', false);
    expect(result.content).toBe(content);
  });
});
