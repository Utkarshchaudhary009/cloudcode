'use client'

import { DeploymentsDashboard } from './deployments-dashboard'
import { ProjectsTab } from '@/components/deployments/projects-tab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function DeploymentsPage() {
  return (
    <div className="flex-1 bg-background">
      <div className="px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Deployments</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Monitor deployments and auto-fix failures
          </p>
        </div>

        <Tabs defaultValue="deployments" className="w-full">
          <TabsList className="mb-4 sm:mb-6">
            <TabsTrigger value="deployments">Deployments</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="deployments">
            <DeploymentsDashboard />
          </TabsContent>

          <TabsContent value="projects">
            <ProjectsTab />
          </TabsContent>

          <TabsContent value="rules">
            <div className="flex items-center justify-center py-12">
              <p className="text-sm sm:text-base text-muted-foreground">Coming soon</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
