import type { ReviewFinding } from '@/lib/db/schema'

export type Events = {
  'scheduled-task/execute': {
    data: {
      scheduledTaskId: string
      userId: string
      repoUrl: string
      prompt: string
      taskType: string
      selectedAgent: string
      selectedModel?: string
    }
  }
  'pr/review.requested': {
    data: {
      userId: string
      repoUrl: string
      prNumber: number
      prTitle: string
      prAuthor: string
      headSha: string
      baseBranch: string
      headBranch: string
      installationId: string
    }
  }
  'review/post-comments': {
    data: {
      reviewId: string
      userId: string
      repoUrl: string
      prNumber: number
      findings: ReviewFinding[]
    }
  }
  // Vercel auto-fix events
  'vercel/deployment.failed': {
    data: {
      subscriptionId: string
      deploymentId: string
      deploymentUrl: string
      branch: string
      buildError: string
      projectId: string
      projectName: string
    }
  }
  'vercel/build-fix.execute': {
    data: {
      buildFixId: string
      subscriptionId: string
      attempt: number
    }
  }
}
