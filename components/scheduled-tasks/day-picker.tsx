'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DayPickerProps {
  value: string[]
  onChange: (value: string[]) => void
}

const days = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
]

export function DayPicker({ value, onChange }: DayPickerProps) {
  const toggleDay = (dayValue: string) => {
    if (value.includes('daily')) {
      onChange([dayValue])
    } else if (value.includes(dayValue)) {
      const newValue = value.filter((v) => v !== dayValue)
      onChange(newValue.length === 0 ? ['daily'] : newValue)
    } else {
      onChange([...value, dayValue])
    }
  }

  const toggleDaily = () => {
    onChange(['daily'])
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => (
          <Button
            key={day.value}
            type="button"
            variant={value.includes(day.value) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleDay(day.value)}
            className={cn(value.includes(day.value) && 'ring-1 ring-primary')}
          >
            {day.label}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant={value.includes('daily') ? 'default' : 'outline'}
        size="sm"
        onClick={toggleDaily}
        className={cn('w-full', value.includes('daily') && 'ring-1 ring-primary')}
      >
        Daily
      </Button>
    </div>
  )
}
