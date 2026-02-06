import { db } from '@/lib/db/client'
import { tasks } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

export const getAuthorizedTask = async (taskId: string, userId: string) => {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .limit(1)

  return task || null
}
