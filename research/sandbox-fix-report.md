# Engineering Report: OpenCode Sandbox Agent Architectural Fixes

## 1. Objective
To resolve the "OpenCode planning step failed" error and align the sandbox execution environment with the official OpenCode AI technical specifications.

## 2. Identified Root Causes
- **Missing Root Configuration**: The generated `opencode.json` defined providers but lacked a root `model` property, causing the CLI to fall back to unauthorized providers (e.g., OpenAI) even when OpenCode Zen keys were present.
- **Log Pollution**: The lack of a `--quiet` flag introduced terminal control characters (spinners/animations) into the log stream, complicating error detection.
- **Ambiguous Model IDs**: Model selections were passed without provider prefixes, leading to ambiguity in the CLI's internal routing.

## 3. Changes Implemented

### 3.1 Root Model Configuration
Updated `lib/sandbox/agents/opencode.ts` to explicitly set the `model` property at the root of the configuration file.
- **Logic**: It now automatically formats the model string as `provider/model_id` (e.g., `opencode/gpt-5.2-codex`) based on user selection.
- **Fallback**: If no model is selected, it defaults to the verified `opencode/gpt-5.2-codex` gateway.

### 3.2 Automation Optimization
Modified the `runOpenCodeRun` interaction layer to include the official `--quiet` flag.
- **Benefit**: Disables interactive TUI elements (spinners, progress bars) during the planning and execution phases, ensuring clean, readable logs in the production Activity Feed.

### 3.3 Enhanced Diagnostic Logging
Updated error handling to capture and log the full `stderr` output from the OpenCode CLI.
- **Benefit**: Instead of a generic "Planning step failed," developers will now see the specific reason (e.g., "Invalid API Key" or "Model Context Overflow") directly in the task logs.

## 4. Verification Results
- **Schema Alignment**: The generated `opencode.json` now validates against the official `https://opencode.ai/config.json` schema.
- **Execution Flow**: Verified that the CLI now prioritizes the `opencode` provider key correctly, eliminating the unauthorized fallback to OpenAI.

## 5. Conclusion
The OpenCode agent is now robustly configured for autonomous execution within the sandbox. These changes eliminate the primary failure mode observed in production and ensure compatibility with future updates to the OpenCode CLI.
