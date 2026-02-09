'use client'

import { ScheduledTaskForm } from '@/components/scheduled-tasks/scheduled-task-form'
import { useRouter } from 'next/navigation'

export default function NewScheduledTaskPage() {
  const router = useRouter()

  return (
    <div className="flex-1 bg-background flex flex-col">
      <div className="container py-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Create Scheduled Task</h1>
          <p className="text-muted-foreground">Configure an automated task to run at specific time slots</p>
        </div>
        <ScheduledTaskForm onSuccess={() => router.push('/scheduled-tasks')} />
      </div>
    </div>
  )
}
