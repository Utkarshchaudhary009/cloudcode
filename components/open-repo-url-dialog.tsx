'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RepoSelector } from '@/components/repo-selector'

interface OpenRepoUrlDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (repoUrl: string) => void
}

export function OpenRepoUrlDialog({ open, onOpenChange, onSubmit }: OpenRepoUrlDialogProps) {
  const [selectedOwner, setSelectedOwner] = useState('')
  const [selectedRepo, setSelectedRepo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedOwner('')
      setSelectedRepo('')
    }
  }, [open])

  const repoUrl = selectedOwner && selectedRepo ? `https://github.com/${selectedOwner}/${selectedRepo}` : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!repoUrl) {
      toast.error('Please select a repository')
      return
    }

    setIsSubmitting(true)
    try {
      onSubmit(repoUrl)
      // Reset form
      setSelectedOwner('')
      setSelectedRepo('')
      onOpenChange(false)
    } catch (error) {
      console.error('Error processing repo URL:', error)
      toast.error('Failed to process repository')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open Repository</DialogTitle>
          <DialogDescription>
            Select a GitHub repository to create a task. The repository will be cloned and you can start working on it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Repository</Label>
            <RepoSelector
              selectedOwner={selectedOwner}
              selectedRepo={selectedRepo}
              onOwnerChange={setSelectedOwner}
              onRepoChange={setSelectedRepo}
              size="default"
            />
            {repoUrl && <p className="text-xs text-muted-foreground mt-1">{repoUrl}</p>}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !repoUrl}>
              {isSubmitting ? 'Opening...' : 'Open Repository'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
