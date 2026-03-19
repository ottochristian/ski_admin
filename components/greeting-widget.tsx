'use client'

import { useMemo } from 'react'

interface GreetingWidgetProps {
  firstName: string
}

const MORNING_PHRASES = [
  "hope the snow's good today.",
  "the mountain is calling.",
  "great conditions out there.",
  "ready for a strong day?",
  "let's make today count.",
  "the slopes are yours.",
]

const AFTERNOON_PHRASES = [
  "hope the day's been good on the mountain.",
  "keeping the momentum going.",
  "how's the afternoon looking?",
  "the best runs are still ahead.",
  "halfway through — staying strong.",
  "good things happening today.",
]

const EVENING_PHRASES = [
  "another strong day for the club.",
  "great work out there today.",
  "the mountain never sleeps.",
  "wrap up strong.",
  "solid session today.",
  "the club's in good hands.",
]

export function GreetingWidget({ firstName }: GreetingWidgetProps) {
  const { greeting, phrase } = useMemo(() => {
    const hour = new Date().getHours()
    const day = new Date().getDay()

    let timeGreeting: string
    let pool: string[]

    if (hour < 12) {
      timeGreeting = 'Good morning'
      pool = MORNING_PHRASES
    } else if (hour < 17) {
      timeGreeting = 'Good afternoon'
      pool = AFTERNOON_PHRASES
    } else {
      timeGreeting = 'Good evening'
      pool = EVENING_PHRASES
    }

    // Deterministic per day so it doesn't flicker on re-render
    const phrase = pool[day % pool.length]

    return { greeting: timeGreeting, phrase }
  }, [])

  return (
    <div className="py-2">
      <h1 className="text-2xl font-semibold text-foreground tracking-tight">
        {greeting}, {firstName} —
      </h1>
      <p className="text-zinc-400 mt-1 text-base">{phrase}</p>
    </div>
  )
}
