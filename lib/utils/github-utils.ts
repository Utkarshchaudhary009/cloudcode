export interface ParsedGitHubRepo {
  owner: string
  repo: string
}

/**
 * Parse a GitHub repository URL to extract owner and repo name.
 * Works for standard HTTPS URLs.
 *
 * @param repoUrl - The full GitHub repository URL
 * @returns An object containing owner and repo, or null if invalid
 */
export function parseGitHubRepoUrl(repoUrl: string): ParsedGitHubRepo | null {
  if (!repoUrl) return null

  // Remove trailing slashes and .git suffix
  const cleanUrl = repoUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')

  // Regular expression to match github.com/owner/repo
  const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) return null

  return {
    owner: match[1],
    repo: match[2],
  }
}

/**
 * Build a GitHub repository URL from owner and repo name.
 *
 * @param owner - The GitHub owner/organization
 * @param repo - The repository name
 * @returns The full GitHub repository URL
 */
export function buildGitHubRepoUrl(owner: string, repo: string): string {
  if (!owner || !repo) return ''
  return `https://github.com/${owner}/${repo}`
}
