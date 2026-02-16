# Deployments UI - Comprehensive Plan

## Current State Analysis

### Problem
The current deployments page only shows **failed deployments** that triggered webhooks. Users cannot see:
- Successful deployments
- Currently building deployments
- All deployments for a repo/project
- Real-time deployment status from Vercel

### Data Sources
| Source | What it provides |
|--------|------------------|
| **Vercel SDK** | All deployments (success, failed, building) with pagination |
| **Local DB** | Only failed deployments with fix status and PR info |

### Key Insight
We need to **merge data from two sources**:
1. **Vercel API** → All deployments with status, URL, time
2. **Local DB** → Fix status, PR info, task link (only for monitored failed deployments)

---

## User Mental Model

A user thinks about deployments in terms of:

1. **"What's happening now?"** → Building, queued deployments
2. **"What failed recently?"** → Failed deployments needing attention
3. **"What's fixed?"** → Deployments where CloudCode created a fix PR
4. **"Show me the deployment"** → Open in Vercel to see full logs
5. **"Show me the fix"** → Open the task/PR that fixed it

---

## 5 UI Design Concepts

### Design 1: Activity Feed (Recommended)

**Concept**: Real-time feed like GitHub's activity feed or Linear's issues list.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Deployments                                           [Filter ▼] [Search]  │
│                                                                             │
│ Status: [All] [Building 🔵] [Success ✅] [Failed 🔴] [Fixed 🟢]             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 🔵 BUILDING    cloudcode-api                            2 minutes ago    ││
│ │                owner/cloudcode                                           ││
│ │                → vercel.com/.../cloudcode-api/Am5oo...  [Open ↗]        ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 🔴 FAILED     my-nextjs-app                            15 minutes ago   ││
│ │                acme/my-nextjs-app                                        ││
│ │                Error: Cannot find name 'x'                               ││
│ │                → vercel.com/.../my-nextjs-app/Am5oo...  [Open ↗]        ││
│ │                🤖 Fixed by CloudCode → PR #142          [View PR]        ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ ✅ SUCCESS    api-server                               1 hour ago       ││
│ │                acme/api-server                                           ││
│ │                Production deployment                                     ││
│ │                → vercel.com/.../api-server/Am5oo...     [Open ↗]        ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ [Load more...]                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why it works**:
- Scannable, chronological
- Status badges immediately visible
- Primary action (open in Vercel) is prominent
- Fix info clearly associated with failed deployment
- Infinite scroll for pagination

**Interactions**:
- Click row → Opens deployment in Vercel (like clicking a GitHub issue opens it)
- "View PR" button → Opens the fix PR
- Filter tabs → Filter by status
- Search → Filter by project name

---

### Design 2: Kanban Board

**Concept**: Columns by status, like Trello or Linear's board view.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Deployments                                           [Search...]           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ 🔵 BUILDING  │ │ 🔴 FAILED    │ │ 🤖 FIXING    │ │ ✅ SUCCESS   │        │
│ │      (2)     │ │      (3)     │ │      (1)     │ │     (47)     │        │
│ ├──────────────┤ ├──────────────┤ ├──────────────┤ ├──────────────┤        │
│ │              │ │              │ │              │ │              │        │
│ │ cloudcode    │ │ my-nextjs    │ │ api-server   │ │ web-app      │        │
│ │ 2m ago [↗]   │ │ 15m ago[↗]  │ │ 5m ago[↗]   │ │ 1h ago [↗]  │        │
│ │              │ │              │ │ Task: Fix... │ │              │        │
│ │ sandbox-ui   │ │ backend-api  │ │ [View Task]  │ │ mobile-app   │        │
│ │ 5m ago [↗]   │ │ 30m ago[↗]  │ └──────────────┘ │ 2h ago [↗]  │        │
│ │              │ │              │ │              │ │              │        │
│ │              │ │ cli-tool     │ │              │ │ cron-job     │        │
│ │              │ │ 1h ago [↗]   │ │              │ │ 3h ago [↗]  │        │
│ │              │ └──────────────┘ │              │ └──────────────┘        │
│ │              │                  │              │                          │
│ └──────────────┘                  │              │                          │
│                                   │              │                          │
│ [Load more...]                    │              │                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why it works**:
- Visual status overview
- Easy to see how many of each status
- Drag-and-drop potential for future
- Works well for few deployments

**Downsides**:
- Success column can get very long
- Less suited for many deployments
- Harder to show error messages

---

### Design 3: Table with Actions

**Concept**: Dense table like Vercel's own deployment table.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Deployments                                                                 │
│ Status: [All ▼]  Project: [All ▼]  Repo: [All ▼]           [Search...]      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Status    │ Project        │ Repo           │ Time      │ Actions          │
├───────────┼────────────────┼────────────────┼───────────┼──────────────────┤
│ 🔵 Build  │ cloudcode-api  │ owner/cloudcode│ 2m ago    │ [Open ↗]         │
│ 🔴 Failed │ my-nextjs-app  │ acme/my-app    │ 15m ago   │ [Open ↗] [Fix]   │
│ 🤖 Fixing │ api-server     │ acme/api       │ 5m ago    │ [Open ↗] [Task]  │
│ ✅ Success│ web-app        │ acme/web       │ 1h ago    │ [Open ↗]         │
│ 🟢 Fixed  │ backend        │ acme/backend   │ 2h ago    │ [Open ↗] [PR #42]│
│ ✅ Success│ mobile-app     │ acme/mobile    │ 3h ago    │ [Open ↗]         │
│ ...                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
│ [← Previous]                                         [Next →]               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why it works**:
- Dense, shows many deployments
- Sortable columns
- Familiar table pattern
- Clear action buttons

**Downsides**:
- Less visual than feed/kanban
- Mobile experience harder
- Error messages not visible

---

### Design 4: Split View with Detail Panel

**Concept**: List left, details right - like Slack's layout.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Deployments                                           [Filter] [Search]     │
├───────────────────────────────────────────┬─────────────────────────────────┤
│                                           │                                 │
│ 🔴 FAILED  my-nextjs-app     15m ago  →   │ my-nextjs-app                   │
│ 🔵 BUILD   cloudcode-api     2m ago       │                                 │
│ ✅ SUCCESS web-app           1h ago       │ Status: 🔴 FAILED               │
│ 🤖 FIXING  api-server        5m ago       │ Time: 15 minutes ago            │
│ ✅ SUCCESS mobile-app        3h ago       │ Repo: acme/my-nextjs-app        │
│                                           │                                 │
│                                           │ Error:                          │
│                                           │ Cannot find name 'x'            │
│                                           │ src/components/App.tsx:42       │
│                                           │                                 │
│                                           │ CloudCode Fix:                  │
│                                           │ 🤖 Created PR #142              │
│                                           │ Branch: fix/missing-variable    │
│                                           │ [View PR] [View Task]           │
│                                           │                                 │
│                                           │ ────────────────────────        │
│                                           │ Open in Vercel:                 │
│                                           │ [vercel.com/.../my-nextjs...]   │
│                                           │                                 │
└───────────────────────────────────────────┴─────────────────────────────────┘
```

**Why it works**:
- Rich details without navigation
- Quick comparison between deployments
- Clear focus state
- Fix info prominent

**Downsides**:
- More complex implementation
- Takes more screen space
- Mobile needs different layout

---

### Design 5: Minimal List with Quick Actions

**Concept**: Ultra-minimal, maximum scanning speed.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Deployments                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 🔵 cloudcode-api     owner/cloudcode    2m      [Open ↗]                   │
│ 🔴 my-nextjs-app    acme/my-app        15m     [Open ↗]  [Fix 🤖]         │
│ 🤖 api-server       acme/api           5m      [Open ↗]  [Task →]         │
│ ✅ web-app          acme/web           1h      [Open ↗]                   │
│ 🟢 backend          acme/backend       2h      [Open ↗]  [PR #42 ↗]       │
│ ✅ mobile-app       acme/mobile        3h      [Open ↗]                   │
│ ✅ cron-job         acme/cron          5h      [Open ↗]                   │
│ ✅ admin-panel      acme/admin         8h      [Open ↗]                   │
│                                                                             │
│ [Load more...]                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why it works**:
- Maximum scanning speed
- Minimal visual noise
- Works on any screen size
- Primary actions always visible

**Downsides**:
- No inline error messages
- Less visual feedback
- No detail panel

---

## Recommended: Hybrid of Design 1 + Design 4

Combine the Activity Feed with an expandable detail section:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Deployments                                                                 │
│ [All] [Building 🔵] [Failed 🔴] [Fixing 🤖] [Fixed 🟢] [Success ✅]         │
│ [Search deployments...]                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 🔵 BUILDING    cloudcode-api                            2 minutes ago    ││
│ │                owner/cloudcode                                           ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 🔴 FAILED     my-nextjs-app                            15 minutes ago   ││ ⬍ Click to expand
│ │                acme/my-nextjs-app                                        ││
│ │   Error: Cannot find name 'x' in src/components/App.tsx                 ││
│ │   🤖 CloudCode fix in progress → PR #142              [View PR] [Task]  ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 🟢 FIXED      backend-api                              2 hours ago      ││
│ │                acme/backend                                              ││
│ │   Error: Missing dependency 'lodash'                                    ││
│ │   ✅ Fixed by CloudCode → PR #41                       [View PR]        ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ ✅ SUCCESS    web-app                                  1 hour ago       ││
│ │                acme/web-app                                              ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ [Loading more...]                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Vercel Deployments API

**New function in `lib/integrations/vercel/client.ts`**:
```typescript
export async function listVercelDeployments(options: {
  projectId?: string
  projectIds?: string[]
  limit?: number
  since?: number  // timestamp for pagination
  state?: 'BUILDING' | 'ERROR' | 'READY' | 'QUEUED' | 'CANCELED'
  target?: 'production' | 'preview'
  teamId?: string
  token?: string
}): Promise<{
  deployments: VercelDeployment[]
  pagination: { next?: number }
}>

interface VercelDeployment {
  id: string          // dpl_xxx
  name: string        // project name
  url: string         // https://xxx.vercel.app
  state: 'BUILDING' | 'ERROR' | 'READY' | 'QUEUED' | 'CANCELED'
  target: 'production' | 'preview'
  projectId: string
  createdAt: number
  createdBy: { username: string }
  meta?: {
    githubCommitSha?: string
    githubCommitMessage?: string
    githubRepoFullName?: string
  }
}
```

### 2. New API Endpoint

**`GET /api/integrations/vercel/deployments`**:
```typescript
// Query params
? limit=20
& since=1234567890
& projectId=prj_xxx (optional, for repo-specific view)
& state=ERROR (optional filter)
& target=production (optional filter)

// Response
{
  deployments: [{
    // From Vercel
    id: 'dpl_xxx',
    name: 'my-project',
    url: 'https://...',
    state: 'ERROR',
    target: 'production',
    createdAt: '2024-01-15T10:30:00Z',
    projectId: 'prj_xxx',
    inspectorUrl: 'https://vercel.com/...',
    
    // From local DB (if monitored and failed)
    fixStatus?: 'fixing' | 'pr_created' | 'merged' | 'failed',
    prUrl?: string,
    prNumber?: number,
    taskId?: string,
    errorMessage?: string,
    errorType?: string,
  }],
  pagination: { next?: number }
}
```

### 3. Merging Logic

```typescript
// In API route
const vercelDeployments = await listVercelDeployments({ ... })
const localDeployments = await db.select().from(deployments).where(...)

const merged = vercelDeployments.map(vd => {
  const local = localDeployments.find(ld => 
    ld.platformDeploymentId === vd.id
  )
  
  return {
    ...vd,
    fixStatus: local?.fixStatus,
    prUrl: local?.prUrl,
    prNumber: local?.prNumber,
    taskId: local?.taskId,
    errorMessage: local?.errorMessage,
    errorType: local?.errorType,
  }
})
```

### 4. Deployment Row Component

```typescript
interface DeploymentRowProps {
  id: string
  name: string
  state: 'BUILDING' | 'ERROR' | 'READY' | 'QUEUED' | 'CANCELED'
  target: 'production' | 'preview'
  createdAt: string
  url: string
  inspectorUrl: string  // Link to Vercel deployment page
  
  // Optional fix info
  fixStatus?: FixStatus
  prUrl?: string
  prNumber?: number
  taskId?: string
  errorMessage?: string
  
  // For repo view
  repoFullName?: string
}

// Interactions:
// 1. Click row → Opens inspectorUrl (Vercel deployment page)
// 2. "View PR" button → Opens PR
// 3. "View Task" button → Navigates to /tasks/:taskId
```

### 5. Infinite Scroll

Using Intersection Observer:
```typescript
const { ref, inView } = useInView({
  threshold: 0,
  triggerOnce: false,
})

useEffect(() => {
  if (inView && hasMore && !loading) {
    fetchMore()
  }
}, [inView, hasMore, loading])
```

### 6. Repo-Specific View

**In `app/repos/[owner]/[repo]/deployments/`**:
- Filter Vercel deployments by project ID (from subscription)
- Or filter by `meta.githubRepoFullName` matching the repo
- Show same UI but scoped to that repo

---

## Status Badge Mapping

| Vercel State | Badge | Color |
|--------------|-------|-------|
| BUILDING | 🔵 Building | Blue |
| QUEUED | 🔵 Queued | Blue |
| ERROR | 🔴 Failed | Red |
| READY | ✅ Success | Green |
| CANCELED | ⚪ Canceled | Gray |

| Fix Status (overlay) | Badge | Color |
|---------------------|-------|-------|
| fixing | 🤖 Fixing | Purple |
| pr_created | 🟢 PR Created | Green |
| merged | ✅ Fixed | Green |
| failed | ⚠️ Fix Failed | Yellow |

---

## Key User Interactions

| User Action | Result |
|-------------|--------|
| Click deployment row | Opens Vercel deployment page in new tab |
| Click "View PR" | Opens GitHub PR in new tab |
| Click "View Task" | Navigates to `/tasks/:taskId` |
| Scroll to bottom | Loads more deployments |
| Click status filter | Filters by status |
| Type in search | Filters by project name |

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `lib/integrations/vercel/client.ts` | Modify | Add `listVercelDeployments()` |
| `app/api/integrations/vercel/deployments/route.ts` | Create | New API endpoint |
| `components/deployments/deployments-tab.tsx` | Create | New deployments list component |
| `components/deployments/deployment-row.tsx` | Modify | Enhanced row with Vercel link |
| `app/deployments/page.tsx` | Modify | Use new DeploymentsTab |
| `components/repo-deployments.tsx` | Modify | Use shared components with repo filter |
| `lib/types/deployments.ts` | Create | TypeScript interfaces |

---

## Success Criteria

1. User can see ALL deployments from Vercel (not just failed)
2. Infinite scroll for pagination
3. One click to open deployment in Vercel
4. Fix info clearly associated with failed deployments
5. Works for both global and repo-specific views
6. Mobile responsive
7. Fast loading (first 20, then lazy load more)
