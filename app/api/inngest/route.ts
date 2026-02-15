import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import {
  scheduledTasksDispatcher4am,
  scheduledTasksDispatcher9am,
  scheduledTasksDispatcher12pm,
  scheduledTasksDispatcher9pm,
  executeScheduledTask,
} from '@/lib/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    scheduledTasksDispatcher4am,
    scheduledTasksDispatcher9am,
    scheduledTasksDispatcher12pm,
    scheduledTasksDispatcher9pm,
    executeScheduledTask,
  ],
})
