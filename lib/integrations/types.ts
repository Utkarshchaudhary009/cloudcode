export interface TokenProvider {
  id: string
  name: string
  token: {
    createUrl: string
    validateUrl?: string
    scopes?: string[]
  }
  validateToken(accessToken: string, teamId?: string): Promise<ProviderUser>
}

export interface ProviderUser {
  externalId: string
  username: string
  email?: string | null
  name?: string | null
  avatarUrl?: string | null
}

export interface ConnectionInfo {
  connected: boolean
  provider: string
  username?: string
  connectedAt?: Date
}

export type DeploymentProvider = 'vercel' | 'cloudflare' | 'render'

export type ErrorType = 'typescript' | 'dependency' | 'config' | 'runtime' | 'build' | 'other'

export type FixStatus =
  | 'pending'
  | 'analyzing'
  | 'fixing'
  | 'reviewing'
  | 'pr_created'
  | 'merged'
  | 'failed'
  | 'skipped'

export interface AnalysisResult {
  errorType: ErrorType
  errorMessage: string
  errorContext: string
  affectedFiles: string[]
  confidence: number
}

export interface MatchedRule {
  id: string
  name: string
  skipFix: boolean
  customPrompt?: string | null
}

export interface VercelProjectLink {
  type: 'github' | 'github-limited' | 'github-custom-host' | 'gitlab' | 'bitbucket'
  org?: string
  repo?: string
  projectNameWithNamespace?: string
  name?: string
  slug?: string
}

export interface VercelProject {
  id: string
  name: string
  link?: VercelProjectLink
}

export function getRepoFullName(project: VercelProject): string | null {
  const { link } = project
  if (!link) return null

  switch (link.type) {
    case 'github':
    case 'github-limited':
      return link.org && link.repo ? `${link.org}/${link.repo}` : null
    case 'github-custom-host':
      return link.org && link.repo ? `${link.org}/${link.repo}` : null
    case 'gitlab':
      return link.projectNameWithNamespace ?? null
    case 'bitbucket':
      return link.name && link.slug ? `${link.name}/${link.slug}` : null
    default:
      return null
  }
}
