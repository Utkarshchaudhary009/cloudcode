# Adding a New Integration — Developer Guide

This document is the **single source of truth** for adding new integrations (GitHub, Vercel, GitLab, Bitbucket, etc.) to CloudCode. Follow every step — no exceptions.

---

## Architecture Overview

```
lib/integrations/
├── types.ts                       # Shared contracts (OAuthProvider, ConnectionInfo, etc.)
├── connection-manager.ts          # Generic connect/disconnect/status DB logic
├── token-resolver.ts              # Generic token resolution from accounts table
├── registry.ts                    # Provider registry: Record<ProviderId, OAuthProvider>
├── github/
│   ├── index.ts                   # Implements OAuthProvider interface
│   ├── client.ts                  # Octokit wrapper (domain-specific)
│   ├── user-token.ts              # GitHub-specific token resolution
│   └── actions.ts                 # PR create/merge, repos, etc.
├── vercel/
│   ├── index.ts                   # Implements OAuthProvider interface
│   ├── client.ts                  # Vercel API client
│   └── user.ts                    # Vercel user fetching
├── hooks/
│   ├── use-connection.ts          # Generic hook — works for any provider
│   └── use-github.ts              # GitHub-specific hook (repos, PRs)
└── components/
    ├── connect-button.tsx          # Generic connect/disconnect button
    └── connection-status.tsx       # Generic connection status badge
```

**Design principle:** Only abstract what's truly shared (OAuth, token storage, connection status). Keep domain-specific logic (Octokit, Vercel deployments, PR actions) in the provider folder.

---

## Step-by-Step: Adding a New Integration

### Step 1: Define Provider Metadata

Create `lib/integrations/<provider>/index.ts` implementing the `OAuthProvider` interface:

```ts
import type { OAuthProvider } from '../types'

export const gitlabProvider: OAuthProvider = {
  id: 'gitlab',
  name: 'GitLab',
  
  // OAuth configuration
  oauth: {
    authorizeUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    scopes: ['api', 'read_user'],
    clientIdEnv: 'GITLAB_CLIENT_ID',
    clientSecretEnv: 'GITLAB_CLIENT_SECRET',
    // Optional: set to true if provider uses PKCE
    usePKCE: false,
  },

  // How to fetch user info after token exchange
  async getUser(accessToken: string) {
    const res = await fetch('https://gitlab.com/api/v4/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json()
    return {
      externalId: String(data.id),
      username: data.username,
      email: data.email,
      name: data.name,
      avatarUrl: data.avatar_url,
    }
  },
}
```

### Step 2: Register the Provider

Add your provider to `lib/integrations/registry.ts`:

```ts
import { gitlabProvider } from './gitlab'

export const providers = {
  github: githubProvider,
  vercel: vercelProvider,
  gitlab: gitlabProvider,  // ← add here
} as const

export type ProviderId = keyof typeof providers
```

### Step 3: Update the Database Schema

In `lib/db/schema.ts`, add the provider ID to the enum in `users`, `accounts`, and related schemas:

```ts
// In users table
provider: text('provider', {
  enum: ['github', 'vercel', 'gitlab'],  // ← add here
}).notNull(),

// In accounts table  
provider: text('provider', {
  enum: ['github', 'vercel', 'gitlab'],  // ← add here
}).notNull(),

// In all Zod schemas that reference provider
provider: z.enum(['github', 'vercel', 'gitlab']),
```

**Then generate a migration:**

```bash
pnpm drizzle-kit generate
```

### Step 4: Add Session Types

In `lib/session/types.ts`, extend the `authProvider` union:

```ts
export interface Session {
  authProvider: 'github' | 'vercel' | 'gitlab'  // ← add here
  // ...
}
```

### Step 5: Create OAuth API Routes

Create these route files:

```
app/api/auth/<provider>/
├── signin/route.ts     # Initiate OAuth flow
├── callback/route.ts   # Handle OAuth callback
├── status/route.ts     # Check connection status  
└── disconnect/route.ts # Remove linked account
```

**Use the shared `connection-manager.ts` for token storage/lookup. Do NOT duplicate DB queries.**

Template for `signin/route.ts`:

```ts
import { providers } from '@/lib/integrations/registry'

export async function GET(req: NextRequest) {
  const provider = providers.gitlab
  const state = generateState()
  // Store state in cookies
  // Build authorize URL from provider.oauth config
  // Redirect to provider
}
```

Template for `callback/route.ts`:

```ts
import { providers } from '@/lib/integrations/registry'
import { connectionManager } from '@/lib/integrations/connection-manager'

export async function GET(req: NextRequest) {
  const provider = providers.gitlab
  // Exchange code for token using provider.oauth.tokenUrl
  // Fetch user info with provider.getUser(token)
  // Store with connectionManager.connect(userId, 'gitlab', token, user)
}
```

### Step 6: Add Client-Side State (Optional)

If the integration needs client-side connection tracking, add a Jotai atom in `lib/atoms/`:

```ts
// lib/atoms/gitlab-connection.ts
import { atom } from 'jotai'

export interface GitLabConnection {
  connected: boolean
  username?: string
}

export const gitlabConnectionAtom = atom<GitLabConnection>({ connected: false })
```

### Step 7: Add Domain-Specific Logic

Create provider-specific API clients and actions in the provider folder:

```ts
// lib/integrations/gitlab/client.ts
export async function getGitLabClient(token: string) {
  // GitLab-specific API client
}

// lib/integrations/gitlab/actions.ts
export async function listMergeRequests(token: string, projectId: string) {
  // GitLab-specific MR logic
}
```

**Never force domain-specific logic into the shared `OAuthProvider` interface.**

### Step 8: Add UI

Use the generic `<ConnectButton>` component for connection management:

```tsx
<ConnectButton provider="gitlab" />
```

For provider-specific features, create components in `components/<feature>/`:

```tsx
// components/gitlab/merge-requests.tsx
export function GitLabMergeRequests({ projectId }: Props) {
  // GitLab-specific UI
}
```

### Step 9: Update Auth Providers Config

In `lib/auth/providers.ts`:

```ts
export function getEnabledAuthProviders() {
  const providers = process.env.NEXT_PUBLIC_AUTH_PROVIDERS || 'github'
  const enabled = providers.split(',').map(p => p.trim().toLowerCase())
  return {
    github: enabled.includes('github'),
    gitlab: enabled.includes('gitlab'),  // ← add here
  }
}
```

### Step 10: Add Environment Variables

Document required env vars in `.env.example`:

```
# GitLab Integration
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
```

Add the variables to the redaction list in `lib/utils/logging.ts` if they contain secrets.

---

## Checklist Before Merging

- [ ] Provider implements `OAuthProvider` interface
- [ ] Provider is registered in `registry.ts`
- [ ] DB schema updated with new provider enum + migration generated
- [ ] Session types updated
- [ ] OAuth routes created (signin, callback, status, disconnect)
- [ ] All tokens encrypted before storage (use `encrypt()` from `lib/crypto`)
- [ ] No dynamic values in log statements (static strings only)
- [ ] New env var secrets added to `lib/utils/logging.ts` redaction patterns
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes (0 errors)
- [ ] `pnpm format` applied
- [ ] `pnpm build` succeeds

---

## Shared Contracts Reference

### `OAuthProvider` Interface

```ts
interface OAuthProvider {
  id: string
  name: string
  oauth: {
    authorizeUrl: string
    tokenUrl: string
    scopes: string[]
    clientIdEnv: string
    clientSecretEnv: string
    usePKCE?: boolean
  }
  getUser(accessToken: string): Promise<ProviderUser>
}
```

### `ProviderUser`

```ts
interface ProviderUser {
  externalId: string
  username: string
  email?: string | null
  name?: string | null
  avatarUrl?: string | null
}
```

### `ConnectionInfo`

```ts
interface ConnectionInfo {
  connected: boolean
  provider: string
  username?: string
  connectedAt?: Date
}
```

---

## Anti-Patterns — Do NOT Do This

| ❌ Don't | ✅ Do |
|---------|------|
| Add provider-specific methods to `OAuthProvider` | Keep domain logic in `lib/integrations/<provider>/actions.ts` |
| Duplicate token encryption/decryption logic | Use shared `encrypt()`/`decrypt()` from `lib/crypto` |
| Create a "god interface" with `listRepos()`, `deploy()`, etc. | Use narrow interfaces per capability |
| Log dynamic values (`logger.info(\`Connected ${provider}\`)`) | Use static strings (`logger.info('Provider connected')`) |
| Add provider-specific UI to generic components | Create new components in `components/<feature>/` |
| Hardcode provider IDs in switch statements | Use registry lookup: `providers[providerId]` |
| Skip the migration when adding enum values | Always run `pnpm drizzle-kit generate` |

---

## FAQ

**Q: My provider uses PKCE. How do I handle it?**  
Set `usePKCE: true` in the oauth config. The shared OAuth route helpers will generate and verify the code challenge automatically.

**Q: My provider has refresh tokens. Where do I store them?**  
The `accounts` table already has a `refreshToken` column. Encrypt it with `encrypt()` before storing.

**Q: My provider needs custom headers or auth schemes?**  
Put that in `lib/integrations/<provider>/client.ts`. The shared layer only handles OAuth token exchange; everything after that is provider-specific.

**Q: How do I add a provider-specific settings page?**  
Create `app/settings/<provider>/page.tsx`. Add a link card in `app/settings/page.tsx` following the existing pattern (Card + icon + ChevronRight).
