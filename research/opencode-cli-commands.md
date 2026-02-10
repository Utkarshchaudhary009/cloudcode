# Research Paper: OpenCode AI CLI - Architecture, Commands, and Implementation

## Abstract
This document provides a comprehensive analysis of the OpenCode AI Command-Line Interface (CLI), an advanced autonomous coding agent. It explores the CLI's command structure, configuration mechanisms, and integration capabilities. The paper aims to serve as a technical reference for engineers implementing OpenCode within automated environments, such as sandboxed development platforms.

---

## 1. Introduction
OpenCode AI is a state-of-the-art coding agent designed to interact directly with codebases through a terminal interface. While it features a rich Terminal User Interface (TUI), its true power lies in its programmatic CLI, which enables seamless integration into CI/CD pipelines, IDEs, and automated agents.

## 2. Installation and Environment Setup
The CLI is distributed as an NPM package, ensuring cross-platform compatibility across Node.js environments.

### 2.1 Global Installation
```bash
npm install -g opencode-ai
```

### 2.2 System Requirements
- **Node.js**: Version 18.x or higher recommended.
- **Git**: Required for repository interaction and agentic commits.
- **API Keys**: Access to at least one LLM provider (OpenAI, Anthropic, Google, etc.).

---

## 3. Command Reference
The CLI follows a standard subcommand architecture.

### 3.1 Core Interaction
- `opencode`: Launches the interactive TUI.
- `opencode run "<prompt>"`: Executes a specific task autonomously and exits. This is the primary command for headless automation.
- `opencode --continue`: Resumes the most recent session.
- `opencode --session <id>`: Resumes a specific historical session.

### 3.2 Management Subcommands
- `opencode auth login`: Interactive credential management.
- `opencode agent list`: Lists available agent profiles.
- `opencode agent create`: Initiates a guided setup for custom agent behaviors.

### 3.3 Infrastructure Commands
- `opencode serve`: Starts a headless backend server, exposing an API for remote control.
- `opencode attach <url>`: Connects a local TUI to a remote `opencode serve` instance.

---

## 4. Configuration and Precedence
OpenCode employs a multi-layered configuration strategy using `opencode.json` files and environment variables.

### 4.1 Configuration Hierarchy (Precedence: Lowest to Highest)
1.  **Remote Defaults**: `.well-known/opencode`
2.  **Global User Config**: `~/.config/opencode/opencode.json`
3.  **Project-Specific Config**: `./opencode.json` (at the project root)
4.  **Runtime Content**: Provided via `OPENCODE_CONFIG_CONTENT` environment variable.

### 4.2 Key Environment Variables
| Variable | Purpose |
| :--- | :--- |
| `OPENAI_API_KEY` | Authentication for GPT-4o/o1 models |
| `ANTHROPIC_API_KEY` | Authentication for Claude 3.5 Sonnet/Opus models |
| `GEMINI_API_KEY` | Authentication for Google Gemini models |
| `ZAI_API_KEY` | Authentication for Z.ai models |
| `OPENCODE_CONFIG` | Custom path to the configuration JSON |
| `SHELL` | Defines the terminal environment for the agent's tools |

---

## 5. Integration: The `opencode.json` Schema
The configuration file allows for fine-grained control over model parameters and Model Context Protocol (MCP) servers.

### 5.1 Schema Example
```json
{
  "$schema": "https://opencode.ai/config.json",
  "providers": {
    "openai": { "apiKey": "{env:OPENAI_API_KEY}" },
    "opencode": { "apiKey": "{env:OPENCODE_API_KEY}" }
  },
  "mcp": {
    "github-tools": {
      "type": "remote",
      "url": "https://mcp.github.com",
      "enabled": true
    }
  }
}
```

---

## 6. Common Failure Modes and Troubleshooting
During implementation in automated sandboxes, several common issues may arise:

### 6.1 Silent Planning Failures
If `opencode run` fails during the initial analysis phase without output, it is often due to:
- **Default Provider Mismatch**: The CLI defaulting to `openai` when only `opencode` or `zai` keys are present.
- **Solution**: Explicitly set the provider/model or ensure the `opencode.json` has a `defaultProvider` entry (if supported) or that all relevant keys are exported.

### 6.2 Permission Errors
The agent requires execute permissions for its internal tools and the target project's build scripts.
- **Solution**: Run `chmod +x` on necessary scripts before invoking the agent.

---

## 7. Conclusion
The OpenCode AI CLI represents a significant leap in developer productivity by bridging the gap between interactive chat and autonomous execution. For robust production deployments, developers should prioritize project-level `opencode.json` configuration and utilize the `run` command with comprehensive environment variable pass-through for API keys.
