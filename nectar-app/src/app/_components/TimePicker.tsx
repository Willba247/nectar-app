// components/ui/time-picker.tsx
'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface TimePickerProps {
    id?: string
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    className?: string
}

export function TimePicker({
    id,
    value,
    onChange,
    disabled = false,
    className,
}: TimePickerProps) {
    // Parse the time string into hours and minutes
    const [hours, minutes] = value.split(':').map(Number)

    // Handle individual hour and minute changes
    const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newHours = parseInt(e.target.value)
        if (isNaN(newHours) || newHours < 0 || newHours > 23) return

        const formattedHours = newHours.toString().padStart(2, '0')
        const formattedMinutes = minutes?.toString().padStart(2, '0') ?? '00'
        onChange(`${formattedHours}:${formattedMinutes}`)
    }

    const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newMinutes = parseInt(e.target.value)
        if (isNaN(newMinutes) || newMinutes < 0 || newMinutes > 59) return

        const formattedHours = hours?.toString().padStart(2, '0') ?? '00'
        const formattedMinutes = newMinutes.toString().padStart(2, '0')
        onChange(`${formattedHours}:${formattedMinutes}`)
    }

    // Quick time selection buttons
    const timeOptions = [
        { label: '9:00 PM', value: '21:00' },
        { label: '10:00 PM', value: '22:00' },
        { label: '11:00 PM', value: '23:00' },
        { label: '12:00 AM', value: '00:00' },
        { label: '1:00 AM', value: '01:00' },
        { label: '2:00 AM', value: '02:00' },
    ]

    // Format the time for display
    const formatTimeForDisplay = (timeString: string) => {
        const [h, m] = timeString.split(':').map(Number)
        const period = h && h >= 12 ? 'PM' : 'AM'
        const displayHour = (h && h % 12) ?? 12
        return `${displayHour}:${m?.toString().padStart(2, '0')} ${period}`
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !value && "text-muted-foreground",
                        className
                    )}
                    disabled={disabled}
                >
                    <Clock className="mr-2 h-4 w-4" />
                    {value ? formatTimeForDisplay(value) : "Select time"}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
                <div className="space-y-4">
                    <div className="flex justify-between">
                        <div className="grid gap-1">
                            <Label htmlFor="hours">Hours</Label>
                            <Input
                                id="hours"
                                className="w-20"
                                value={hours}
                                onChange={handleHoursChange}
                                type="number"
                                min={0}
                                max={23}
                            />
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="minutes">Minutes</Label>
                            <Input
                                id="minutes"
                                className="w-20"
                                value={minutes}
                                onChange={handleMinutesChange}
                                type="number"
                                min={0}
                                max={59}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {timeOptions.map((option) => (
                            <Button
                                key={option.value}
                                variant={value === option.value ? "default" : "outline"}
                                onClick={() => onChange(option.value)}
                                type="button"
                                className="text-xs"
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}