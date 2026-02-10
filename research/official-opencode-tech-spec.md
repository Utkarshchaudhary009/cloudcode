# Official Technical Specification: OpenCode AI CLI & Configuration

## 1. Introduction
This specification document outlines the official command-line interface (CLI) and configuration schema for OpenCode AI, as defined by the official documentation and the `https://opencode.ai/config.json` schema.

## 2. CLI Command Architecture
The OpenCode CLI supports both interactive (TUI) and non-interactive (Programmatic) modes.

### 2.1 Non-Interactive Execution (`run`)
The `run` command is the primary entry point for automation.
- **Command**: `opencode run "<prompt>"`
- **Quiet Mode**: `-q` or `--quiet` (disables spinner and animation, ideal for CI/CD and sandbox logging).
- **Model Override**: `-m <provider/model>` or `--model <provider/model>`.

### 2.2 Session Management
- **Continue Session**: `opencode --continue` (resumes the last active session).
- **Specific Session**: `opencode --session <id>` (resumes by ID).
- **Forking**: `--fork` (creates a new session branch from an existing one).

### 2.3 Headless Operations
- **Headless Server**: `opencode serve` (starts a backend API instance).
- **Remote Attachment**: `opencode attach <url>` (connects a local UI to a remote backend).

---

## 3. Configuration Schema (`opencode.json`)
The configuration follows a strictly defined JSON schema.

### 3.1 Core Global Settings
| Property | Type | Description |
| :--- | :--- | :--- |
| `model` | string | The default model in `provider/model_id` format. |
| `small_model` | string | Used for lightweight tasks like summarization. |
| `default_agent` | string | The agent profile to use by default. |
| `logLevel` | string | Options: `debug`, `info`, `warn`, `error`. |
| `enabled_providers`| string[] | Whitelist of allowed providers. |

### 3.2 Agent Definitions
Each agent (e.g., `build`, `plan`, `explore`) can be configured with:
- **Permissions**: Granular control over `read`, `edit`, `bash`, and `webfetch`.
- **Logic**: `temperature`, `system_prompt`, and `steps`.

### 3.3 Provider Configuration
Providers are configured under the `providers` key:
```json
"providers": {
  "openai": {
    "options": {
      "apiKey": "{env:OPENAI_API_KEY}",
      "timeout": 30000
    }
  }
}
```

### 3.4 MCP Server Integration
Model Context Protocol (MCP) servers enable the agent to use external tools.
- **Local**: Requires a `command` array.
- **Remote**: Requires a `url` and optional `headers`.
```json
"mcp": {
  "db-tools": {
    "type": "local",
    "command": ["npx", "-y", "@modelcontextprotocol/server-postgres"],
    "enabled": true
  }
}
```

---

## 4. Environment Variable Reference
OpenCode prioritizes environment variables for sensitive credentials.
- `ANTHROPIC_API_KEY`: Required for Claude models.
- `OPENAI_API_KEY`: Required for OpenAI models.
- `GEMINI_API_KEY`: Required for Google models.
- `OPENCODE_CONFIG`: Path to a custom `opencode.json`.
- `OPENCODE_CONFIG_CONTENT`: Direct JSON string for runtime configuration.

## 5. Configuration Precedence
OpenCode loads configuration in the following order (highest number wins):
1.  **Remote**: `.well-known/opencode`
2.  **Global**: `~/.config/opencode/opencode.json`
3.  **Environment**: `OPENCODE_CONFIG` file or `OPENCODE_CONFIG_CONTENT` string.
4.  **Local**: `./opencode.json` in the current working directory.

---

## 6. Implementation Notes for Sandboxes
To ensure the highest reliability in automated environments:
1.  **Explicit Model Format**: Always use the `provider/model` format in configuration to avoid ambiguity.
2.  **Quiet Mode**: Always use `--quiet` when invoking via `run` to prevent control characters from polluting log streams.
3.  **Config Injection**: Use `OPENCODE_CONFIG_CONTENT` to inject dynamic per-task configurations without writing to the filesystem.
