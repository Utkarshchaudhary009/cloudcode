export interface VercelProject {
  id: string
  name: string
  framework?: string
  link?: {
    type: 'github' | 'gitlab' | 'bitbucket'
    org: string
    repo: string
    repoId: number
  }
}

export interface ProjectSubscription {
  id: string
  platformProjectId: string
  platformProjectName: string
  githubRepoFullName: string
  webhookId?: string | null
  createdAt: string
}

export interface DisplayProject extends VercelProject {
  isMonitored: boolean
  subscriptionId?: string
  hasGitLink: boolean
  githubRepo: string | null
}
