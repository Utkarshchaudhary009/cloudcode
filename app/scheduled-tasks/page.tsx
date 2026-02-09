import { ScheduledTaskList } from '@/components/scheduled-tasks/scheduled-task-list'

export default function ScheduledTasksPage() {
  return (
    <div className="flex-1 bg-background flex flex-col">
      <div className="container py-8 px-4 md:px-8 lg:px-16 xl:px-24">
        <ScheduledTaskList />
      </div>
    </div>
  )
}
