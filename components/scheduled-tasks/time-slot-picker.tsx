'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TimeSlotPickerProps {
  value: string
  onChange: (value: string) => void
}

const timeSlots = [
  { value: '4am', label: '4:00 AM' },
  { value: '9am', label: '9:00 AM' },
  { value: '12pm', label: '12:00 PM' },
  { value: '9pm', label: '9:00 PM' },
]

export function TimeSlotPicker({ value, onChange }: TimeSlotPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {timeSlots.map((slot) => (
        <Button
          key={slot.value}
          type="button"
          variant={value === slot.value ? 'default' : 'outline'}
          onClick={() => onChange(slot.value)}
          className={cn(value === slot.value && 'ring-2 ring-primary')}
        >
          {slot.label}
        </Button>
      ))}
    </div>
  )
}
