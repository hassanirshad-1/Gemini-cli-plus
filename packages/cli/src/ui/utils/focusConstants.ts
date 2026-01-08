/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// ANSI escape codes to enable/disable terminal focus reporting
export const ENABLE_FOCUS_REPORTING = '\x1b[?1004h';
export const DISABLE_FOCUS_REPORTING = '\x1b[?1004l';

// ANSI escape codes for focus events
export const FOCUS_IN = '\x1b[I';
export const FOCUS_OUT = '\x1b[O';
