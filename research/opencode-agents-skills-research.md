# OpenCode: Agents, Subagents, and Skills Research

## Overview

This document summarizes how **AGENTS.md**, **subagents**, and **skills** work in OpenCode, and how these concepts can be applied to cloudcode for adding new features like running subagents in the sandbox.

---

## 1. AGENTS.md

### What is AGENTS.md?
AGENTS.md is an open, community-driven format (like a "README for AI agents") that provides context and instructions to help AI coding agents work on a project. It emerged from collaboration between OpenAI Codex, Amp, Google Jules, Cursor, and Factory.

### Purpose
- **Project overview** and structure
- **Build and test commands** (`pnpm install`, `pnpm dev`, `pnpm test`)
- **Code style guidelines** (TypeScript strict mode, quotes, patterns)
- **Testing instructions** and CI workflows
- **Security considerations**

### Key Features
1. **Nested AGENTS.md**: Place additional files inside subpackages. The nearest file in the directory tree takes precedence.
2. **Auto-loaded**: Agents automatically read the closest AGENTS.md to the edited file.
3. **User prompts override**: Explicit chat prompts override AGENTS.md instructions.
4. **Backward compatible**: Works with AGENT.md via symlinks.

### Example Structure
```
project-root/
├── AGENTS.md           # Root-level instructions
├── packages/
│   ├── frontend/
│   │   └── AGENTS.md   # Frontend-specific instructions
│   └── backend/
│       └── AGENTS.md   # Backend-specific instructions
```

---

## 2. Agents Architecture in OpenCode

### Agent Types

| Type | Description |
|------|-------------|
| **Primary Agents** | Main agents users interact with (e.g., `build`, `plan`) |
| **Subagents** | Specialized assistants invoked by primary agents or via `@mention` |

### Built-in Agents

| Agent | Mode | Purpose |
|-------|------|---------|
| `build` | Primary | Default agent with all tools enabled for development work |
| `plan` | Primary | Restricted agent for planning/analysis without making changes |
| `general` | Subagent | Multi-step tasks with full tool access (except todo) |
| `explore` | Subagent | Research and exploration |
| `compaction` | Primary (hidden) | Compacts long context into summaries |
| `title` | Primary (hidden) | Generates session titles |
| `summary` | Primary (hidden) | Creates session summaries |

### Agent Components
Every agent needs:
1. **Model** - The LLM to use
2. **Tools** - Available actions (edit, bash, read, etc.)
3. **System Prompt** - Instructions explaining behavior

---

## 3. Subagents Deep Dive

### How Subagents Work
Subagents run in their own **separate session** with:
- Their own context window
- Potentially different LLM
- Custom tools and permissions
- Independent system prompt

### Invocation Methods
1. **Automatic**: Primary agents invoke via the `task` tool based on descriptions
2. **Manual**: Users type `@subagent-name` in their message

### The Task Tool
The `task` tool is the mechanism for invoking subagents:
- **Description**: Lists available agents and their descriptions
- **Execute function**: Spins up a new session for the chosen subagent

```typescript
// Task tool pattern
{
  name: "task",
  description: "Available agent types: {agents list with descriptions}",
  execute: async (params) => {
    // Create new session for subagent
    // Provide tools and system prompt
    // Return subagent's output
  }
}
```

### Session Navigation
When subagents create child sessions:
- `+Right` - Cycle forward through parent → child1 → child2 → parent
- `+Left` - Cycle backward

---

## 4. Defining Custom Agents

### Method 1: JSON Configuration (opencode.json)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "quick-thinker": {
      "description": "Fast reasoning with limited iterations",
      "prompt": "You are a quick thinker. Solve problems with minimal steps.",
      "model": "anthropic/claude-haiku-4-5",
      "steps": 5,
      "mode": "subagent",
      "permission": {
        "edit": "deny",
        "bash": "ask"
      }
    }
  }
}
```

### Method 2: Markdown Files

Place in:
- **Global**: `~/.config/opencode/agents/`
- **Per-project**: `.opencode/agents/`

Example: `~/.config/opencode/agents/review.md`

```markdown
---
description: Reviews code for quality and best practices
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
tools:
  write: false
  edit: false
  bash: false
permission:
  bash:
    "*": ask
    "git diff": allow
    "git log*": allow
---

You are in code review mode. Focus on:
- Code quality and best practices
- Potential bugs and edge cases
- Performance implications
- Security considerations

Provide constructive feedback without making direct changes.
```

### Agent Configuration Options

| Option | Description |
|--------|-------------|
| `description` | What the agent does (shown in tool descriptions) |
| `mode` | `primary`, `subagent`, or `all` |
| `model` | Override model (format: `provider/model-id`) |
| `prompt` | Custom system prompt or file reference |
| `steps` | Max agentic iterations before forced response |
| `permission` | Tool permissions (`allow`, `deny`, `ask`) |
| `hidden` | Hide from `@` autocomplete (subagents only) |
| `color` | UI color (hex or theme color) |

### Permission System

```json
{
  "permission": {
    "edit": "deny",           // Disable file edits
    "bash": {
      "*": "ask",             // Ask for all bash commands
      "git diff": "allow",    // Allow git diff specifically
      "rm *": "deny"          // Deny remove commands
    },
    "webfetch": "allow",
    "task": {
      "*": "deny",            // Deny all subagent invocations
      "helper-*": "allow"     // Allow only helper-* subagents
    }
  }
}
```

---

## 5. Skills System

### What are Skills?
Skills are **reusable instruction sets** loaded on-demand via the `skill` tool. They provide domain-specific instructions and workflows.

### Skill Locations

| Path | Scope |
|------|-------|
| `.opencode/skills/<name>/SKILL.md` | Project-specific |
| `~/.config/opencode/skills/<name>/SKILL.md` | Global |
| `.claude/skills/<name>/SKILL.md` | Claude-compatible |
| `.agents/skills/<name>/SKILL.md` | Agent-compatible |

### SKILL.md Format

```markdown
---
name: git-release
description: Create consistent releases and changelogs
license: MIT
compatibility: opencode
metadata:
  audience: maintainers
  workflow: github
---

## What I do
- Draft release notes from merged PRs
- Propose a version bump
- Provide a copy-pasteable `gh release create` command

## When to use me
Use this when you are preparing a tagged release.
```

### Skill Name Rules
- 1-64 characters
- Lowercase alphanumeric with single hyphen separators
- No leading/trailing hyphens
- No consecutive `--`
- Must match directory name

### Skill Permissions

```json
{
  "permission": {
    "skill": {
      "*": "allow",
      "internal-*": "deny",
      "experimental-*": "ask"
    }
  }
}
```

---

## 6. Implementation Recommendations for CloudCode

### Current State
CloudCode already has:
- `lib/sandbox/agents/` - Agent execution framework
- `lib/sandbox/agents/opencode.ts` - OpenCode integration in sandbox
- Provider configuration system
- MCP server integration

### Feature Ideas

#### 1. Add Subagent Support to Sandbox

Create custom subagents that run inside the sandbox:

```typescript
// lib/sandbox/agents/subagents/index.ts
export interface SubagentConfig {
  name: string;
  description: string;
  mode: 'subagent' | 'primary';
  model?: string;
  prompt: string;
  tools: {
    edit: boolean;
    bash: boolean | Record<string, 'allow' | 'deny' | 'ask'>;
    webfetch: boolean;
  };
}

export async function executeSubagentInSandbox(
  sandbox: Sandbox,
  subagent: SubagentConfig,
  instruction: string,
  logger: TaskLogger
): Promise<AgentExecutionResult> {
  // 1. Create subagent markdown file in sandbox
  // 2. Configure OpenCode to use it
  // 3. Execute with @subagent-name prefix or task tool
}
```

#### 2. Expose Skills to Users

Allow users to create project-specific skills:

```typescript
// lib/sandbox/skills/index.ts
export interface SkillConfig {
  name: string;
  description: string;
  content: string; // Markdown content
}

export async function installSkillInSandbox(
  sandbox: Sandbox,
  skill: SkillConfig
): Promise<void> {
  // Create .opencode/skills/<name>/SKILL.md in sandbox
}
```

#### 3. Dynamic Agent Configuration

Store agent/subagent configs in database and apply to sandbox:

```typescript
// Schema addition
export const customAgents = pgTable("custom_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description").notNull(),
  mode: varchar("mode", { length: 20 }).notNull(),
  model: varchar("model", { length: 100 }),
  prompt: text("prompt").notNull(),
  toolsConfig: jsonb("tools_config"),
  permissionConfig: jsonb("permission_config"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

#### 4. Multi-Agent Orchestration

Enable parent tasks to spawn multiple subagent tasks:

```typescript
// Task with subagent orchestration
interface OrchestrationConfig {
  primaryAgent: string;
  subagents: {
    trigger: string; // What triggers this subagent
    name: string;
    config: SubagentConfig;
  }[];
  parallelExecution: boolean;
}
```

#### 5. Session Management for Subagents

Track subagent sessions for navigation/resumption:

```typescript
interface SubagentSession {
  parentSessionId: string;
  childSessionId: string;
  subagentName: string;
  status: 'running' | 'completed' | 'failed';
  output?: string;
}
```

---

## 7. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     CloudCode Platform                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐   ┌──────────────────────────────────┐ │
│  │   User Request  │   │        Task Orchestration         │ │
│  └────────┬────────┘   └──────────────┬───────────────────┘ │
│           │                           │                      │
│           ▼                           ▼                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Sandbox Environment                   ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │                   OpenCode CLI                      │││
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │││
│  │  │  │   Primary   │  │   Subagents  │  │   Skills   │ │││
│  │  │  │   Agents    │  │              │  │            │ │││
│  │  │  │ ┌─────────┐ │  │ ┌──────────┐ │  │ ┌────────┐ │ │││
│  │  │  │ │  build  │ │  │ │ general  │ │  │ │ skill1 │ │ │││
│  │  │  │ │  plan   │ │  │ │ explore  │ │  │ │ skill2 │ │ │││
│  │  │  │ │ custom  │ │  │ │ custom   │ │  │ │ skillN │ │ │││
│  │  │  │ └─────────┘ │  │ └──────────┘ │  │ └────────┘ │ │││
│  │  │  └─────────────┘  └──────────────┘  └────────────┘ │││
│  │  │                                                     │││
│  │  │  ┌─────────────────────────────────────────────────┐│││
│  │  │  │                   Tools                         ││││
│  │  │  │  read | edit | bash | webfetch | task | skill   ││││
│  │  │  └─────────────────────────────────────────────────┘│││
│  │  └─────────────────────────────────────────────────────┘││
│  │                                                         ││
│  │  ┌─────────────────┐  ┌─────────────────────────────┐  ││
│  │  │   AGENTS.md     │  │    opencode.json            │  ││
│  │  │   (Project      │  │    (Agent/Skill config)     │  ││
│  │  │    context)     │  │                             │  ││
│  │  └─────────────────┘  └─────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Key Takeaways

1. **AGENTS.md** = Project context file for AI agents (commands, style, conventions)
2. **Primary Agents** = Main interaction point (build, plan)
3. **Subagents** = Specialized helpers invoked via `task` tool or `@mention`
4. **Skills** = Reusable instruction sets loaded on-demand
5. **The Task Tool** = Mechanism for agent-to-agent invocation (creates child sessions)
6. **Permissions** = Granular control over what agents can do (per-tool, per-pattern)
7. **Configuration** = JSON (`opencode.json`) or Markdown files (`.opencode/agents/*.md`)

---

## 9. References

- [AGENTS.md Specification](https://github.com/openai/agents.md)
- [OpenCode Agents Documentation](https://opencode.ai/docs/agents/)
- [OpenCode Skills Documentation](https://opencode.ai/docs/skills/)
- [OpenCode Configuration](https://opencode.ai/docs/config/)
- [OpenCode Deep Dive Article](https://cefboud.com/posts/coding-agents-internals-opencode-deepdive/)
