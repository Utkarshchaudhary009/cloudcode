import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, ChevronRight } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="container py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your preferences and integrations</p>
      </div>

      <div className="space-y-3">
        <Link href="/settings/review-rules" className="block">
          <Card className="cursor-pointer hover:bg-accent/50 transition-all duration-200 group">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-info" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm mb-0.5">Review Rules</h3>
                <p className="text-muted-foreground text-xs">
                  Configure custom code review rules for automated PR analysis
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
