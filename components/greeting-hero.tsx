'use client'

import Image from 'next/image'

interface GreetingHeroProps {
  userName?: string
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

export function GreetingHero({ userName }: GreetingHeroProps) {
  const greeting = getTimeBasedGreeting()
  const displayName = userName || 'there'

  return (
    <header className="flex flex-col items-center gap-4 text-center mb-6" role="banner" aria-label="Welcome section">
      {/* Logo */}
      <div className="relative w-16 h-16 md:w-20 md:h-20" aria-hidden="true">
        <Image src="/Logo.png" alt="" fill className="object-contain dark:invert" priority />
      </div>

      {/* Greeting Text */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
          <span className="sr-only">Cloudcode: </span>
          {greeting}, {displayName} 👋
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">What should we code today?</p>
      </div>
    </header>
  )
}
