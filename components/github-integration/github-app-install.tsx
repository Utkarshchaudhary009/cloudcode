'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Github, ExternalLink, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

export function GitHubAppInstall() {
  const [repoUrl, setRepoUrl] = useState('')
  const [autoReviewEnabled, setAutoReviewEnabled] = useState(true)
  const [reviewOnDraft, setReviewOnDraft] = useState(false)
  const [loading, setLoading] = useState(false)
  const [installed, setInstalled] = useState(false)

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/github-installations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          installationId: 'demo-installation-id',
          autoReviewEnabled,
          reviewOnDraft,
        }),
      })

      if (!response.ok) throw new Error('Failed to install GitHub App')

      setInstalled(true)
    } catch (error) {
      console.error('Error installing GitHub App')
      toast.error('Failed to install GitHub App')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">GitHub Integration</h1>
        <p className="text-muted-foreground">Subscribe repositories to automated PR reviews with the GitHub App.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub App Subscription
          </CardTitle>
          <CardDescription>Install the GitHub App to enable automatic code reviews on pull requests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!installed ? (
            <>
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <form onSubmit={handleInstall} className="space-y-4">
                  <div>
                    <Label htmlFor="repoUrl">Repository URL</Label>
                    <Input
                      id="repoUrl"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch id="autoReviewEnabled" checked={autoReviewEnabled} onCheckedChange={setAutoReviewEnabled} />
                    <Label htmlFor="autoReviewEnabled">Enable automatic PR reviews</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch id="reviewOnDraft" checked={reviewOnDraft} onCheckedChange={setReviewOnDraft} />
                    <Label htmlFor="reviewOnDraft">Review draft PRs</Label>
                  </div>

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      'Installing...'
                    ) : (
                      <>
                        <Github className="h-4 w-4 mr-2" />
                        Install GitHub App
                      </>
                    )}
                  </Button>
                </form>

                <div className="rounded-md border bg-muted/40 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium">What you get</p>
                    <p className="text-xs text-muted-foreground">A streamlined PR review workflow.</p>
                  </div>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Automatic reviews triggered on new pull requests</li>
                    <li>Rule-based findings and actionable summaries</li>
                    <li>Configurable coverage for draft PRs</li>
                    <li>Review history centralized in the Reviews tab</li>
                  </ol>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">GitHub App Installed</p>
              <p className="text-sm text-muted-foreground mb-4">Automatic PR reviews are enabled for {repoUrl}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge variant="secondary">Active</Badge>
                <Badge variant="outline">{autoReviewEnabled ? 'Auto reviews on' : 'Auto reviews off'}</Badge>
                <Badge variant="outline">{reviewOnDraft ? 'Draft reviews on' : 'Draft reviews off'}</Badge>
              </div>
              <Button variant="outline" onClick={() => setInstalled(false)} className="mt-4">
                Install Another Repository
              </Button>
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Learn more</p>
            <a
              href="https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              About GitHub Webhooks <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
