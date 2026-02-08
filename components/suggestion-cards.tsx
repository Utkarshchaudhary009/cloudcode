'use client'

import { Code, Bug, Zap, TestTube, FileText, Shield } from 'lucide-react'

interface SuggestionCard {
  title: string
  icon: React.ReactNode
  prompt: string
}

const suggestions: SuggestionCard[] = [
  {
    title: 'Add a feature',
    icon: <Zap className="h-5 w-5" />,
    prompt: 'Add a new feature that...',
  },
  {
    title: 'Fix a bug',
    icon: <Bug className="h-5 w-5" />,
    prompt: 'Fix the bug where...',
  },
  {
    title: 'Refactor code',
    icon: <Code className="h-5 w-5" />,
    prompt: 'Refactor the code to improve...',
  },
  {
    title: 'Write tests',
    icon: <TestTube className="h-5 w-5" />,
    prompt: 'Write comprehensive tests for...',
  },
  {
    title: 'Add documentation',
    icon: <FileText className="h-5 w-5" />,
    prompt: 'Add documentation for...',
  },
  {
    title: 'Security audit',
    icon: <Shield className="h-5 w-5" />,
    prompt: 'Review and fix security issues in...',
  },
]

interface SuggestionCardsProps {
  onSelect: (prompt: string) => void
}

export function SuggestionCards({ onSelect }: SuggestionCardsProps) {
  return (
    <nav className="w-full max-w-2xl mx-auto mt-6" aria-label="Quick start suggestions">
      <h2 id="suggestions-heading" className="text-xs uppercase tracking-wider text-muted-foreground mb-3 px-1">
        Get started with an example
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2" role="list" aria-labelledby="suggestions-heading">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            onClick={() => onSelect(suggestion.prompt)}
            className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all duration-200 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            role="listitem"
            aria-label={`${suggestion.title}: ${suggestion.prompt}`}
          >
            <span className="text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true">
              {suggestion.icon}
            </span>
            <span className="text-sm font-medium text-foreground">{suggestion.title}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
