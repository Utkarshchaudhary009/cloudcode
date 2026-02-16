# Plan: GitHub Integration + Code Review Feature

## Objective

Build the GitHub integration following the new `lib/integrations/` architecture (Plan 5 — Hybrid Provider Modules + Shared Contracts) and implement a **Code Review on PR** feature that automatically reviews PRs, comments on issues, and gives users a clear dashboard to manage everything.

---

## Part A: Integration Architecture (Backend)

### Phase 1 — Shared Contracts & Registry

Create the foundation:

```
lib/integrations/
├── types.ts                  # OAuthProvider, ProviderUser, ConnectionInfo
├── registry.ts               # providers map + ProviderId type
├── connection-manager.ts     # connect(), disconnect(), getStatus() — wraps DB
└── token-resolver.ts         # resolveToken(userId, provider) — generic
```

### Phase 2 — Migrate GitHub

Move existing code into new structure:

```
lib/integrations/github/
├── index.ts                  # Implements OAuthProvider (oauth config + getUser)
├── client.ts                 # Move from lib/github/client.ts (Octokit factory, PR helpers)
├── user-token.ts             # Move from lib/github/user-token.ts
└── actions.ts                # Move PR create/merge/status from client.ts
```

- Update all imports across the codebase
- Delete old `lib/github/` folder
- Existing API routes (`/api/auth/github/*`, `/api/github/*`) stay but import from new paths

### Phase 3 — Migrate Vercel

```
lib/integrations/vercel/
├── index.ts                  # Implements OAuthProvider
├── client.ts                 # Move from lib/vercel-client/
└── user.ts                   # Move from lib/vercel-client/user.ts
```

### Phase 4 — Shared Hooks & Components

```
lib/integrations/hooks/
├── use-connection.ts         # Generic: useConnection('github') → { connected, username, connect, disconnect }

lib/integrations/components/
├── connect-button.tsx        # <ConnectButton provider="github" />
└── connection-status.tsx     # <ConnectionStatus provider="github" />
```

---

## Part B: Code Review Feature (Backend)

### What It Does

1. User subscribes a repo to auto-review
2. On PR open/sync → webhook triggers AI review
3. AI analyzes the diff against user-defined rules
4. Findings posted as GitHub PR comments (inline + summary)
5. Dashboard shows all reviews with status, score, and findings

### Backend Components

```
lib/integrations/github/
├── webhooks.ts               # Webhook signature verification + event parsing
└── review/
    ├── types.ts              # ReviewFinding, ReviewResult, ReviewConfig
    ├── analyzer.ts           # AI-powered diff analysis (calls /api/reviews/analyze)
    ├── commenter.ts          # Posts findings as PR comments via Octokit
    └── subscription.ts       # Manages repo subscriptions (DB CRUD)

app/api/
├── github/webhooks/route.ts          # POST — receives GitHub webhook events
├── github/subscriptions/route.ts     # GET/POST — list/create subscriptions
├── github/subscriptions/[id]/route.ts # PATCH/DELETE — update/remove subscription
├── reviews/route.ts                  # GET — list reviews (already exists)
├── reviews/[id]/route.ts             # GET — review detail (already exists)
└── reviews/analyze/route.ts          # POST — AI analysis endpoint (already exists)
```

### DB Schema Additions

```ts
// github_subscriptions table (replaces old github_installations)
export const githubSubscriptions = pgTable('github_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  repoUrl: text('repo_url').notNull(),
  autoReviewEnabled: boolean('auto_review_enabled').notNull().default(true),
  reviewOnDraft: boolean('review_on_draft').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### Inngest Functions

```
lib/inngest/functions/reviews/
├── handle-pr-review.ts       # Orchestrator: fetch diff → analyze → save → post comments
└── post-review-comments.ts   # Posts findings as GitHub PR comments
```

---

## Part C: UI Plans — 5 Unique Approaches

Below are 5 unique UI plans for the Code Review feature. All share the same backend; they differ in **information architecture, navigation, and interaction patterns**.

---

### UI Plan 1: "GitHub-Native" — Repo-Centric Tabs

**Mental model:** GitHub's own repo page. Users expect reviews to live *inside* a repo, not in a global list.

**Structure:**

```
/repos/[owner]/[repo]/
├── commits/       (existing)
├── issues/        (existing)
├── pull-requests/ (existing)
├── reviews/       ← NEW tab: reviews for this repo
└── settings/      ← NEW tab: auto-review toggle, rules
```

- The existing repo layout gets 2 new tabs: **Reviews** and **Settings**
- `/reviews` (global page) becomes a cross-repo aggregation view
- No new top-level nav item needed — discovery is natural

**Key UI elements:**
- Repo page → Reviews tab → list of PR reviews with status pills
- Repo page → Settings tab → toggle auto-review on/off, configure rules
- PR list → each PR row shows a review status badge (✓ Passed, ⚠ 3 warnings, ✗ Failed)
- Global `/reviews` page → filterable table across all repos

**Pros:** Matches GitHub's mental model exactly. Users don't have to learn new navigation.  
**Cons:** Settings are buried under each repo, harder to manage 20 repos at once.

---

### UI Plan 2: "Dashboard-First" — Dedicated Code Review Page

**Mental model:** Vercel Dashboard / Linear. A dedicated top-level page for code review, like the Tasks page.

**Structure:**

```
Sidebar:
  Home
  Tasks
  Code Review  ← NEW top-level item
  Scheduled Tasks
  Settings

/code-review/
├── page.tsx           → Dashboard: stats + repo subscriptions + recent reviews
├── reviews/           → All reviews list
└── rules/             → Review rules management
```

- Code Review is a first-class citizen in the sidebar
- Dashboard page has 3 sections:
  1. **Stats cards** (total reviews, pass rate, issues found this week)
  2. **Subscribed Repos** table (toggle auto-review, configure each)
  3. **Recent Reviews** feed (clickable → review detail)

**Key UI elements:**
- Stats banner at top (4 cards: Total, Passed, Warnings, Failed)
- "Subscribe Repo" button → opens RepoSelector dialog
- Review list with severity badge, score, PR link
- Review detail page with inline findings grouped by severity

**Pros:** Centralized management for power users. Easy to see cross-repo picture.  
**Cons:** Adds a top-level nav item. Users must context-switch away from the repo page.

---

### UI Plan 3: "Settings-Driven" — Lightweight Integration

**Mental model:** Slack app settings. Integrations and automation live under Settings; results appear contextually.

**Structure:**

```
/settings/
├── page.tsx              → Settings hub with Integration card
├── integrations/
│   └── page.tsx          → Integration management (GitHub connect, subscribe repos)
├── review-rules/         (existing)

/repos/[owner]/[repo]/
├── pull-requests/        → Each PR shows inline review badge
└── reviews/              → NEW tab: reviews for this repo only

/reviews/                 → Global reviews list (existing, enhanced)
```

- Subscription management lives entirely under Settings → Integrations
- Review results surface where users naturally look: on the PR list and in a repo Reviews tab
- No new top-level sidebar item

**Key UI elements:**
- Settings → Integrations → card for each provider with connect/disconnect
- Settings → Integrations → "Subscribed Repos" section with toggle switches
- PR list → status badge on each row
- `/reviews` → global history with filters

**Pros:** Clean separation. Configuration stays in Settings, results appear in context.  
**Cons:** Two-place mental model (settings for config, repos for results). Discoverability suffers.

---

### UI Plan 4: "PR-Centric" — Review Lives on the PR

**Mental model:** GitHub Actions / Checks. Reviews are attached to PRs, not a separate concept.

**Structure:**

```
/repos/[owner]/[repo]/pull-requests/
├── page.tsx              → PR list with review status column
└── [pr_number]/
    └── page.tsx          → NEW: PR detail with review panel

/settings/
└── code-review/
    └── page.tsx          → Subscription management + rules
```

- Clicking a PR in the PR list opens a **PR detail page** with:
  - PR metadata (title, author, branch, status)
  - **Review panel** (findings, score, summary)
  - **Diff viewer** with inline annotations
  - "Run Review" button for manual trigger
- No separate `/reviews` page — reviews live on PRs

**Key UI elements:**
- PR list → status column with review badge
- PR detail → split layout: left = diff, right = findings panel
- Findings panel → grouped by file, color-coded by severity
- "Run Review" button on PR detail for on-demand reviews
- Settings → Code Review → manage subscriptions and rules

**Pros:** Most natural place. Users think "I want to review this PR," not "I want to see reviews."  
**Cons:** Need a new PR detail page. Cross-repo review aggregation is lost.

---

### UI Plan 5: "Notification-Feed" — Review as Activity

**Mental model:** GitHub Notifications / Slack. Reviews appear in an activity feed; subscriptions managed via quick actions.

**Structure:**

```
Home page (existing ActivityFeed) ← reviews appear as feed items
  └── Feed item → click → review detail

/repos/[owner]/[repo]/
  └── pull-requests/ → review badge on each PR row

Quick-action in repo page → "Enable Auto-Review" toggle (no separate settings page)
```

- **No new pages at all.** Reviews surface in the existing Activity Feed on the home page.
- Each review is a feed card: repo name, PR title, score, summary excerpt
- Clicking a feed item → expands to show findings inline (accordion) or navigates to review detail
- Subscribing a repo = clicking "Auto-Review" toggle directly on the repo page header

**Key UI elements:**
- Activity Feed → "Reviews" tab (already exists as a filter category)
- Feed card: avatar + repo + PR title + severity badge + score
- Expandable card or bottom drawer for review detail
- Repo page header → "Auto-Review: On/Off" toggle
- Toast notification when review completes

**Pros:** Zero new navigation. Fits the "notification" mental model. Very lightweight.  
**Cons:** Feed can get noisy. Detail view is constrained (accordion or drawer, not full page). Power users managing many repos will want a dedicated list.

---

## My Recommendation: **UI Plan 2 (Dashboard-First)** with Plan 1 elements

**Why Plan 2 as the base:**

1. **Users already have the mental model.** The app already has top-level pages for Tasks and Scheduled Tasks. Code Review is an equally important feature — it deserves equal status in the sidebar. Users expect a dedicated space for important workflows.

2. **Centralized management scales.** When a user has 10+ repos with auto-review, they need a single place to see all reviews, toggle repos, and check stats. Scattering this across individual repo settings (Plan 1 pure) or the activity feed (Plan 5) doesn't scale.

3. **Stats provide real value.** A dashboard with pass rate, issues found, and trends gives users a reason to *come back* to the page. It transforms code review from "a thing that runs in the background" into "a tool I actively use."

4. **Consistent with existing patterns.** Tasks page = list of tasks + status. Scheduled Tasks = list of scheduled items + status. Code Review = list of reviews + status. Same pattern, instantly familiar.

**Borrowing from Plan 1:**

- Add a **Reviews tab** to the repo page (`/repos/[owner]/[repo]/reviews/`). This gives contextual access without leaving the repo.
- Add a **review status badge** to each PR row in the Pull Requests tab. This is the lightweight contextual indicator users expect.

**Why NOT the others:**

- **Plan 1 (pure repo-centric):** Forces users to navigate repo-by-repo to manage subscriptions. No cross-repo view.
- **Plan 3 (settings-driven):** Buries the feature under Settings. Users won't discover it.
- **Plan 4 (PR-centric):** Requires building a full PR detail page. The review is one concern of many on a PR — making it the primary view is too narrow.
- **Plan 5 (feed-based):** Too lightweight for a feature this important. Feed items are transient; reviews need a permanent home.

---

## Implementation Order

1. **Phase 1:** Shared integration architecture (`lib/integrations/types.ts`, registry, connection-manager)
2. **Phase 2:** Migrate GitHub + Vercel into new structure
3. **Phase 3:** GitHub subscriptions backend (DB, API routes, webhook)
4. **Phase 4:** Inngest review pipeline (diff → AI analyze → post comments)
5. **Phase 5:** Code Review dashboard UI (top-level page, stats, subscription management)
6. **Phase 6:** Repo-level reviews tab + PR status badges
7. **Phase 7:** Review detail page enhancements

Shall I proceed?
