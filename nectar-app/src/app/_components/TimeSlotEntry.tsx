import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrashIcon } from 'lucide-react'
import { TimePicker } from './TimePicker'
import type { TimeSlotEntry as TimeSlotEntryType } from '@/types/queue-skip'
import { dayNames } from '@/types/queue-skip'

interface TimeSlotEntryProps {
    entry: TimeSlotEntryType
    index: number
    isEdit: boolean
    onUpdate: (index: number, field: keyof TimeSlotEntryType, value: string | number) => void
    onRemove: (index: number) => void
    canRemove: boolean
}

export function TimeSlotEntry({ entry, index, isEdit, onUpdate, onRemove, canRemove }: TimeSlotEntryProps) {
    return (
        <div className="space-y-3 p-3 border rounded-md">
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium">
                    {isEdit && entry.id ? `Edit Configuration (ID: ${entry.id})` : `Configuration #${index + 1}`}
                </h4>
                {canRemove && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemove(index)}
                        className="h-6 w-6 p-0"
                    >
                        <TrashIcon className="h-3 w-3 text-red-500" />
                    </Button>
                )}
            </div>

            <div className="space-y-2">
                <Label className="text-xs">Select Day</Label>
                <Select
                    value={entry.day_of_week.toString()}
                    onValueChange={(value) => onUpdate(index, 'day_of_week', parseInt(value))}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select a day" />
                    </SelectTrigger>
                    <SelectContent>
                        {dayNames.map((day, idx) => (
                            <SelectItem key={idx} value={idx.toString()}>
                                {day}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label className="text-xs">From</Label>
                    <TimePicker
                        value={entry.start_time}
                        onChange={(value) => onUpdate(index, 'start_time', value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">To</Label>
                    <TimePicker
                        value={entry.end_time}
                        onChange={(value) => onUpdate(index, 'end_time', value)}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs">Slots Per Hour</Label>
                <Input
                    type="number"
                    value={entry.slots_per_hour}
                    onChange={(e) => onUpdate(index, 'slots_per_hour', parseInt(e.target.value) || 10)}
                    min={1}
                    max={60}
                />
            </div>
        </div>
    )
} 