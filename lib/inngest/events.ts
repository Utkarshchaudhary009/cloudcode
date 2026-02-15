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
}
