'use client'

import { useState, useEffect, startTransition } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { OpenCodeProviderId } from '@/lib/opencode/providers'
import { DEFAULT_OPENCODE_PROVIDER } from '@/lib/opencode/providers'
import { useModelsDevCatalog } from '@/lib/hooks/use-models-dev'

interface Commit {
  sha: string
  commit: {
    author: {
      name: string
      email: string
      date: string
    }
    message: string
  }
  author: {
    login: string
    avatar_url: string
  } | null
  html_url: string
}

interface RevertCommitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commit: Commit | null
  owner: string
  repo: string
  onRevert: (config: {
    commit: Commit
    selectedProvider: string
    selectedModel: string
    installDependencies: boolean
    maxDuration: number
    keepAlive: boolean
  }) => void
  maxSandboxDuration?: number
}

export function RevertCommitDialog({
  open,
  onOpenChange,
  commit,
  owner,
  repo,
  onRevert,
  maxSandboxDuration = 300,
}: RevertCommitDialogProps) {
  const [selectedProvider, setSelectedProvider] = useState<OpenCodeProviderId>(DEFAULT_OPENCODE_PROVIDER)
  const { providers, modelsByProvider, defaultModels } = useModelsDevCatalog()
  const [selectedModel, setSelectedModel] = useState<string>(defaultModels[DEFAULT_OPENCODE_PROVIDER])
  const [installDependencies, setInstallDependencies] = useState(false)
  const [maxDuration, setMaxDuration] = useState(300)
  const [keepAlive, setKeepAlive] = useState(false)
  const [isReverting, setIsReverting] = useState(false)

  // Update model when agent changes
  useEffect(() => {
    if (selectedProvider) {
      const agentModels = modelsByProvider[selectedProvider]
      const defaultModel = defaultModels[selectedProvider]
      // Check if current model exists for the new agent, otherwise use default
      const modelExists = agentModels?.some((m) => m.value === selectedModel)
      if (!modelExists) {
        // Use startTransition to defer state update
        startTransition(() => {
          setSelectedModel(defaultModel)
        })
      }
    }
  }, [defaultModels, modelsByProvider, selectedProvider, selectedModel])

  const handleRevert = () => {
    if (!commit) return

    setIsReverting(true)
    onRevert({
      commit,
      selectedProvider,
      selectedModel,
      installDependencies,
      maxDuration,
      keepAlive,
    })
    setIsReverting(false)
    onOpenChange(false)
  }

  if (!commit) return null

  const commitShortSha = commit.sha.substring(0, 7)
  const commitMessage = commit.commit.message.split('\n')[0]

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Revert Commit</AlertDialogTitle>
          <AlertDialogDescription>
            Create a new task to revert commit <code className="bg-muted px-1 py-0.5 rounded">{commitShortSha}</code>:{' '}
            {commitMessage}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Provider</label>
              <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as OpenCodeProviderId)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a provider">
                    {selectedProvider
                      ? (() => {
                          const provider = providers.find((item) => item.value === selectedProvider)
                          return provider ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={provider.logoUrl}
                                alt={`${provider.label} logo`}
                                className="h-4 w-4"
                                loading="lazy"
                              />
                              <span>{provider.label}</span>
                            </div>
                          ) : null
                        })()
                      : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      <div className="flex items-center gap-2">
                        <img src={provider.logoUrl} alt={`${provider.label} logo`} className="h-4 w-4" loading="lazy" />
                        <span>{provider.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Model</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {modelsByProvider[selectedProvider]?.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Task Options */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">Task Options</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="revert-install-deps"
                  checked={installDependencies}
                  onCheckedChange={(checked) => setInstallDependencies(!!checked)}
                />
                <Label
                  htmlFor="revert-install-deps"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Install Dependencies?
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="revert-max-duration" className="text-sm font-medium">
                  Maximum Duration
                </Label>
                <Select value={maxDuration.toString()} onValueChange={(value) => setMaxDuration(parseInt(value))}>
                  <SelectTrigger id="revert-max-duration" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="180">3 hours</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                    <SelectItem value="300">5 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="revert-keep-alive"
                  checked={keepAlive}
                  onCheckedChange={(checked) => setKeepAlive(!!checked)}
                />
                <Label
                  htmlFor="revert-keep-alive"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Keep Alive ({maxSandboxDuration} minutes max)
                </Label>
              </div>
            </div>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRevert} disabled={isReverting}>
            {isReverting ? 'Creating...' : 'Create Task'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
