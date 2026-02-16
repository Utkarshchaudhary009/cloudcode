'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2, User, Users } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface Team {
  id: string
  name: string
  slug: string
}

interface StepPasteTokenProps {
  token: string
  onChange: (value: string) => void
  error: string | null
  loading: boolean
  progressMessage: string | null
  onConnect: () => void
  onBack?: () => void
  // New props for integrated scope selection
  teams: Team[]
  selectedTeamId: string | null
  onScopeChange: (teamId: string | null, teamSlug: string | null) => void
  isVerified: boolean
  onFinalConnect: () => void
}

export function StepPasteToken({
  token,
  onChange,
  error,
  loading,
  progressMessage,
  onConnect,
  onBack,
  teams,
  selectedTeamId,
  onScopeChange,
  isVerified,
  onFinalConnect,
}: StepPasteTokenProps) {
  const isValidFormat = token.length > 10

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">{isVerified ? 'Select Your Scope' : 'Paste Your Token'}</h3>
        <p className="text-sm text-muted-foreground mt-2">
          {isVerified
            ? 'Success! Now choose which account context to use for this integration.'
            : 'Copy the token you just created and paste it below.'}
        </p>
      </div>

      {!isVerified ? (
        <div className="space-y-2">
          <div className="relative">
            <Input
              value={token}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Paste your API token here"
              className="font-mono pr-10"
              autoFocus
              type="password"
            />
            {isValidFormat && !error && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {progressMessage && !error && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {progressMessage}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="space-y-2">
            <Label htmlFor="scope">Account Context</Label>
            <Select
              value={selectedTeamId || 'personal'}
              onValueChange={(value) => {
                if (value === 'personal') {
                  onScopeChange(null, null)
                } else {
                  const team = teams.find((t) => t.id === value)
                  onScopeChange(team?.id || null, team?.slug || null)
                }
              }}
            >
              <SelectTrigger className="w-full h-12">
                <SelectValue placeholder="Select a scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Personal Account</span>
                  </div>
                </SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{team.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Projects and deployments will be scoped to this selection.</p>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        {onBack && (
          <Button onClick={onBack} variant="outline" disabled={loading}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}
        {!isVerified ? (
          <Button onClick={onConnect} disabled={!token || !isValidFormat || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Token'
            )}
          </Button>
        ) : (
          <Button onClick={onFinalConnect} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect Account'
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
