import { inngest } from '../../client'
import { db } from '@/lib/db/client'
import { scheduledTasks, tasks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export const executeScheduledTask = inngest.createFunction(
  {
    id: 'execute-scheduled-task',
    concurrency: { limit: 10 },
    retries: 3,
  },
  { event: 'scheduled-task/execute' },
  async ({ event, step }) => {
    const { scheduledTaskId, userId, repoUrl, prompt, taskType, selectedAgent, selectedModel } = event.data

    const taskId = await step.run('create-task', async () => {
      const id = nanoid()
      await db.insert(tasks).values({
        id,
        userId,
        repoUrl,
        prompt: `[Scheduled: ${taskType}] ${prompt}`,
        selectedAgent,
        selectedModel,
        status: 'pending',
      })
      return id
    })

    await step.run('update-scheduled-task-status', async () => {
      await db
        .update(scheduledTasks)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: 'running',
          lastRunTaskId: taskId,
          updatedAt: new Date(),
        })
        .where(eq(scheduledTasks.id, scheduledTaskId))
    })

    const result = await step.run('execute-in-sandbox', async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tasks/${taskId}/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      )
      if (!response.ok) {
        throw new Error('Failed to start task')
      }
      return response.json()
    })

    await step.run('update-final-status', async () => {
      await db
        .update(scheduledTasks)
        .set({
          lastRunStatus: result.success ? 'success' : 'error',
          updatedAt: new Date(),
        })
        .where(eq(scheduledTasks.id, scheduledTaskId))
    })

    return { taskId, result }
  },
)
