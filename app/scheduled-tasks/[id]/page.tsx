import { Suspense } from 'react'
import { ScheduledTaskForm } from '@/components/scheduled-tasks/scheduled-task-form'

export default function EditScheduledTaskPage({ params }: { params: { id: string } }) {
  return (
    <div className="container py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Edit Scheduled Task</h1>
        <p className="text-muted-foreground">Modify your scheduled task configuration</p>
      </div>
      <Suspense fallback={<div>Loading task...</div>}>
        <ScheduledTaskForm taskId={params.id} onSuccess={() => (window.location.href = '/scheduled-tasks')} />
      </Suspense>
    </div>
  )
}
