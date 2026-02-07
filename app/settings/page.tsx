import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Github, Zap } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences and integrations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/settings/review-rules">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Review Rules
              </CardTitle>
              <CardDescription>Configure custom code review rules for automated PR analysis</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/integrations">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Github className="h-5 w-5" />
                GitHub Integration
              </CardTitle>
              <CardDescription>Connect your repositories for automatic PR reviews</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/vercel-auto-fix">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Vercel Auto-Fix
              </CardTitle>
              <CardDescription>Subscribe to Vercel projects for automatic build failure fixes</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
