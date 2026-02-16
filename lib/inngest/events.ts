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
}
