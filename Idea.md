# Projects Tab Implementation Plan (Final)

## Core Concept: Simple Toggle List with External Link

The simplest possible UX:
- List all Vercel projects
- Each row has: project name, GitHub repo, toggle, external link
- Toggle ON = create webhook, start monitoring
- Toggle OFF = delete webhook, stop monitoring
- External link opens project in Vercel dashboard

---

## Final UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│ Projects                                    [Search projects...]│
│                                                    [Vercel ▼]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [V] my-nextjs-app                         ━━━━○ Monitoring [↗]│
│      github.com/acme/my-nextjs-app                              │
│                                                                 │
│  [V] api-server                            ○━━━━ Disabled   [↗]│
│      github.com/acme/api-server                                 │
│                                                                 │
│  [V] static-site                           ━━━━○ Monitoring [↗]│
│      github.com/acme/static-site                                │
│                                                                 │
│  [?] cli-project                           ───── No Git         │
│      This project has no Git repository connected               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Row Elements

| Element | Description |
|---------|-------------|
| `[V]` | Vercel icon (or provider icon) |
| `my-nextjs-app` | Project name |
| `━━━━○` | Toggle (ON=green/right, OFF=gray/left) |
| `Monitoring` | Status text |
| `[↗]` | External link to Vercel project dashboard |
| `github.com/...` | GitHub repo (derived from project link) |

### Toggle States

| State | Toggle | Color | Text |
|-------|--------|-------|------|
| Monitoring | `━━━━○` | Green | "Monitoring" |
| Disabled | `○━━━━` | Gray | "Disabled" |
| No Git | `─────` | Dashed | "No Git" |

---

## External Links

Each provider has a project URL pattern:

| Provider | URL Pattern |
|----------|-------------|
| Vercel | `https://vercel.com/{teamId}/{projectName}` |
| Cloudflare | `https://dash.cloudflare.com/{accountId}/pages/view/{projectName}` |
| Render | `https://dashboard.render.com/web/{serviceId}` |

For Vercel, we can construct: `https://vercel.com/{projectName}` (works for personal) or use teamId from integration.

---

## Implementation Flow

### 1. Fetch Data

```typescript
// Get all Vercel projects with their Git links
const projects = await fetch('/api/integrations/vercel/projects')
// Returns: [{ id, name, framework, link: { type, org, repo } }]

// Get existing subscriptions
const subscriptions = await fetch('/api/integrations/vercel/subscriptions')
// Returns: [{ platformProjectId, ... }]
```

### 2. Merge and Display

```typescript
const displayProjects = projects.map(project => ({
  ...project,
  isMonitored: subscriptions.some(s => s.platformProjectId === project.id),
  hasGitLink: !!project.link,
  githubRepo: project.link ? `${project.link.org}/${project.link.repo}` : null,
}))
```

### 3. Toggle ON

```typescript
// POST to create subscription
await fetch('/api/integrations/vercel/subscriptions', {
  method: 'POST',
  body: JSON.stringify({
    platformProjectId: project.id,
    platformProjectName: project.name,
    githubRepoFullName: `${project.link.org}/${project.link.repo}`,
  })
})
```

### 4. Toggle OFF

```typescript
// DELETE subscription
await fetch(`/api/integrations/vercel/subscriptions?id=${subscriptionId}`, {
  method: 'DELETE'
})
```

---

## Files to Create/Modify

### New Files

1. **`components/deployments/projects-tab.tsx`**
   - Main container component
   - Search bar and provider filter
   - Maps projects to ProjectRow

2. **`components/deployments/project-row.tsx`**
   - Single project row
   - Provider icon, name, GitHub repo
   - Toggle switch with loading state
   - External link button

3. **`components/ui/switch.tsx`** (if not exists)
   - Toggle switch component (check if shadcn has it)

### Modified Files

4. **`app/deployments/page.tsx`**
   - Add Tabs structure (Deployments | Projects | Rules)

5. **`app/api/integrations/vercel/projects/route.ts`**
   - Ensure `link` data is returned in response

6. **`app/api/integrations/vercel/subscriptions/route.ts`**
   - POST: Auto-use project's link data for repo

7. **`lib/integrations/vercel/client.ts`**
   - Verify `listVercelProjects` returns link data

---

## Component Structure

```tsx
// projects-tab.tsx
export function ProjectsTab() {
  const [projects, setProjects] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState('all')
  
  // Fetch projects and subscriptions on mount
  // Filter projects by search
  // Render ProjectRow for each
}

// project-row.tsx
interface ProjectRowProps {
  project: VercelProject
  isMonitored: boolean
  onToggle: (enabled: boolean) => void
  externalUrl: string
}

export function ProjectRow({ project, isMonitored, onToggle, externalUrl }: ProjectRowProps) {
  const [loading, setLoading] = useState(false)
  
  return (
    <div className="...">
      <ProviderIcon provider="vercel" />
      <span>{project.name}</span>
      <span className="text-muted">{project.githubRepo}</span>
      <Switch checked={isMonitored} onCheckedChange={onToggle} />
      <a href={externalUrl} target="_blank">
        <ExternalLink />
      </a>
    </div>
  )
}
```

---

## Edge Cases

| Case | UI Behavior |
|------|-------------|
| No integration connected | Show "Connect Vercel first" with link to /integrations |
| No projects | Show "No projects found" |
| Project has no Git link | Show disabled toggle, "No Git" text, no external link |
| Toggle fails | Show error toast, revert toggle state |
| Loading | Show skeleton rows |

---

## Success Criteria

- User sees all projects immediately after connecting Vercel
- User can toggle monitoring in 1 click
- User can open project in Vercel in 1 click
- Works on mobile (responsive)
- Clear feedback on toggle action
