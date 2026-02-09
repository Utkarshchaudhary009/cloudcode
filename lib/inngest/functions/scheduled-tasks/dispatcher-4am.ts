import { inngest } from '../../client'
import { db } from '@/lib/db/client'
import { scheduledTasks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const scheduledTasksDispatcher4am = inngest.createFunction(
  { id: 'scheduled-tasks-dispatcher-4am' },
  { cron: 'TZ=UTC 0 4 * * *' },
  async ({ step }: { step: any }) => {
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()

    const tasks = await step.run('fetch-tasks', async () => {
      return await db
        .select()
        .from(scheduledTasks)
        .where(and(eq(scheduledTasks.timeSlot, '4am'), eq(scheduledTasks.enabled, true)))
    })

    const tasksToRun = tasks.filter((task: any) => {
      const days = task.days as string[]
      return days.includes('daily') || days.includes(dayOfWeek)
    })

    if (tasksToRun.length === 0) {
      return { message: 'No tasks to run', count: 0 }
    }

    await step.sendEvent(
      'fan-out-tasks',
      tasksToRun.map((task: any) => ({
        name: 'scheduled-task/execute',
        data: {
          scheduledTaskId: task.id,
          userId: task.userId,
          repoUrl: task.repoUrl,
          prompt: task.prompt,
          taskType: task.taskType,
                  selectedProvider: task.selectedProvider,
                  selectedModel: task.selectedModel,
          
        },
      })),
    )

    return { message: 'Tasks dispatched', count: tasksToRun.length }
  },
)
