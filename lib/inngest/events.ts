export type Events = {
  'scheduled-task/execute': {
    data: {
      scheduledTaskId: string
      userId: string
      repoUrl: string
      prompt: string
      taskType: string
      selectedProvider: string
      selectedModel?: string
    }
  }
  'deployment-failure/received': {
    data: {
      fixId: string
      subscriptionId: string
      deploymentId: string
      projectId: string
      webhookDeliveryId: string
    }
  }
  'deployment-fix/create-pr': {
    data: {
      deploymentId: string
      repoFullName: string
      branchName: string
      fixSummary: string
      fixDetails: string
    }
  }
  'deployment-fix/completed': {
    data: {
      deploymentId: string
      taskId: string
      success: boolean
      prUrl?: string
      prNumber?: number
      error?: string
    }
  }
}
