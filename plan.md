# Plan: Fix Vercel Integration 401 Unauthorized Error

The user is reporting a 401 Unauthorized error when fetching Vercel teams. This happens because the current implementation returns a 401 status when no Vercel token is found, which is interpreted as a general authentication failure rather than a "missing integration" state.

## Objective
Improve the Vercel integration error handling by returning a consistent, non-error response when Vercel is not connected, and ensure the frontend handles this gracefully.

## Proposed Paths

### 1. Consistent "Needs Auth" Response (Selected Path)
Update `/api/vercel/teams` to return a 200 OK response with `needsVercelAuth: true` when no token is found, matching the behavior of `/api/vercel/projects`.
- **Pros:** Eliminates confusing 401 errors in console; consistent API design.
- **Cons:** Requires small frontend changes to handle the new response structure.

### 2. Global Auth Interceptor Update
Update the frontend fetch wrapper to specifically handle 401s from Vercel endpoints by showing the connection UI.
- **Pros:** Centralized handling.
- **Cons:** More complex; might interfere with legitimate 401s (e.g., session expired).

### 3. Middleware-level Token Check
Add a middleware check for Vercel tokens on specific routes and redirect to a connection page.
- **Pros:** Proactive.
- **Cons:** Can be intrusive for users who don't want to use Vercel.

### 4. Detailed Error Payloads
Keep 401 but add a specific error code (e.g., `VERCEL_TOKEN_MISSING`) and update frontend to switch based on code.
- **Pros:** Technically correct HTTP usage.
- **Cons:** Still shows as an error in browser console which can alarm users.

### 5. Automatic Refresh Flow
If a token is missing or expired, attempt an automatic silent refresh or redirect to auth.
- **Pros:** Seamless UX.
- **Cons:** Not possible for the initial connection; more complex to implement correctly with Arctic/OAuth2.

## Detailed Plan (Path 1)
1.  **Modify `/api/vercel/teams/route.ts`**:
    - Change the 401 response for `!vercelToken` to return `NextResponse.json({ scopes: [], needsVercelAuth: true })` with a 200 status (default).
2.  **Modify `/app/vercel-review/page.tsx`**:
    - Update `loadScopes` to check for `data.needsVercelAuth` and set the `needsVercelAuth` state.
3.  **Verify**:
    - Ensure the "Connect Vercel" UI appears correctly without console errors.

## Approval Required
Please approve the selected path (Path 1) to proceed with the changes.
