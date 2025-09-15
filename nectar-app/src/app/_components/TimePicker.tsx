// components/ui/time-picker.tsx
'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
    const [isOpen, setIsOpen] = React.useState(false)
    const dropdownRef = React.useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Generate 15-minute interval time options
    const timeOptions = []
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
            const period = hour < 12 ? 'AM' : 'PM'
            const displayMinute = minute.toString().padStart(2, '0')
            const label = `${displayHour}:${displayMinute} ${period}`
            
            timeOptions.push({ label, value: timeValue })
        }
    }

    // Format the time for display
    const formatTimeForDisplay = (timeString: string) => {
        const [h, m] = timeString.split(':').map(Number)
        const period = h && h >= 12 ? 'PM' : 'AM'
        const displayHour = (h && h % 12) ?? 12
        return `${displayHour}:${m?.toString().padStart(2, '0')} ${period}`
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <Button
                id={id}
                variant="outline"
                className={cn(
                    "w-full justify-start text-left font-normal",
                    !value && "text-muted-foreground",
                    className
                )}
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Clock className="mr-2 h-4 w-4" />
                {value ? formatTimeForDisplay(value) : "Select time"}
            </Button>
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border rounded-md shadow-lg z-50 overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto p-2">
                        <div className="grid grid-cols-2 gap-2">
                            {timeOptions.map((option) => (
                                <Button
                                    key={option.value}
                                    variant={value === option.value ? "default" : "outline"}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('TimePicker option clicked:', option.value);
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    type="button"
                                    className={cn(
                                        "text-xs transition-colors",
                                        value === option.value && "bg-primary text-primary-foreground hover:bg-primary/90"
                                    )}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}