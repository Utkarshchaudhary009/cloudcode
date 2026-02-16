'use client'

import { DeploymentsTab } from '@/components/deployments/minimal/deployments-tab'
import { ProjectsTab } from '@/components/deployments/projects-tab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function DeploymentsPage() {
  return (
    <div className="flex-1 bg-background flex flex-col overflow-hidden">
      <div className="px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-4 sm:py-6 flex-shrink-0 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold">Deployments</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">Monitor deployments and auto-fix failures</p>
      </div>

      <Tabs defaultValue="deployments" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 flex-shrink-0">
          <TabsList className="mb-0">
            <TabsTrigger value="deployments">Deployments</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="deployments" className="flex-1 overflow-hidden m-0">
          <DeploymentsTab />
        </TabsContent>

        <TabsContent value="projects" className="flex-1 overflow-auto m-0 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16">
          <ProjectsTab />
        </TabsContent>

        <TabsContent value="rules" className="flex-1 overflow-auto m-0">
          <div className="flex items-center justify-center h-full">
            <p className="text-sm sm:text-base text-muted-foreground">Coming soon</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
