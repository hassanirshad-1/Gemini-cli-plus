#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Suppress the punycode deprecation warning (caused by older dependencies)
// This ensures a clean CLI experience for the user.
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  if (typeof warning === 'string') {
    if (warning.includes('The `punycode` module is deprecated')) return;
  } else if (warning && typeof warning === 'object' && warning.name === 'DeprecationWarning') {
     if (warning.message && warning.message.includes('The `punycode` module is deprecated')) return;
  }
  return originalEmitWarning.call(process, warning, ...args);
};

import { main } from './src/gemini.js';
import {
  FatalError,
  writeToStderr,
  debugLogger,
} from '@google/gemini-cli-core';
import { runExitCleanup } from './src/utils/cleanup.js';

// --- Global Entry Point ---
try {
  await main();
} catch (error) {
  await runExitCleanup();

  if (error instanceof FatalError) {
    let errorMessage = error.message;
    if (!process.env['NO_COLOR']) {
      errorMessage = `\x1b[31m${errorMessage}\x1b[0m`;
    }
    writeToStderr(errorMessage + '\n');
    process.exit(error.exitCode);
  } else {
    writeToStderr('An unexpected critical error occurred:\n');
    if (error instanceof Error) {
      writeToStderr(error.stack + '\n');
    } else {
      writeToStderr(String(error) + '\n');
    }
    debugLogger.error(
      `Unhandled error during startup: ${error instanceof Error ? error.stack : String(error)}`,
    );
    process.exit(1);
  }
}
