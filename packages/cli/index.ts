#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
