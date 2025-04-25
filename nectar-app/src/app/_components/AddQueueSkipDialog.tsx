import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { TimeSlotEntry } from './TimeSlotEntry'
import type { TimeSlotEntry as TimeSlotEntryType, QSConfigDay } from '@/types/queue-skip'
import { DEFAULT_TIME_SLOT } from '@/types/queue-skip'

interface AddQueueSkipDialogProps {
    venueId: string
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onSave: (venueId: string) => Promise<void>
    onTimeSlotChange?: (entries: TimeSlotEntryType[]) => void
    existingConfig?: QSConfigDay[]
    isEdit?: boolean
}

export default function AddQueueSkipDialog({
    venueId,
    isOpen,
    onOpenChange,
    onSave,
    onTimeSlotChange,
    existingConfig,
    isEdit = false
}: AddQueueSkipDialogProps) {
    const [timeSlotEntries, setTimeSlotEntries] = useState<TimeSlotEntryType[]>([DEFAULT_TIME_SLOT])
    const [isLoading, setIsLoading] = useState(false)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null)
    const entryRefs = useRef<(HTMLDivElement | null)[]>([])

    // Initialize time slot entries from existing config
    useEffect(() => {
        if (isOpen && existingConfig?.length && isEdit) {
            const entries = existingConfig.map(config => {
                const timeSlot = config.qs_config_hours[0] || DEFAULT_TIME_SLOT
                return {
                    id: config.id,
                    day_of_week: config.day_of_week,
                    start_time: timeSlot.start_time,
                    end_time: timeSlot.end_time,
                    slots_per_hour: config.slots_per_hour
                }
            })
            setTimeSlotEntries(entries)
            onTimeSlotChange?.(entries)
        } else if (isOpen && (!existingConfig?.length || !isEdit)) {
            setTimeSlotEntries([DEFAULT_TIME_SLOT])
            onTimeSlotChange?.([DEFAULT_TIME_SLOT])
        }
    }, [isOpen, existingConfig, isEdit, onTimeSlotChange])

    useEffect(() => {
        entryRefs.current = entryRefs.current.slice(0, timeSlotEntries.length)
    }, [timeSlotEntries.length])

    useEffect(() => {
        if (lastAddedIndex !== null && entryRefs.current[lastAddedIndex]) {
            setTimeout(() => {
                entryRefs.current[lastAddedIndex]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                })
            }, 100)
            setLastAddedIndex(null)
        }
    }, [lastAddedIndex])

    const addTimeSlotEntry = () => {
        const updatedEntries = [...timeSlotEntries, DEFAULT_TIME_SLOT]
        setTimeSlotEntries(updatedEntries)
        onTimeSlotChange?.(updatedEntries)
        setLastAddedIndex(timeSlotEntries.length)
    }

    const updateTimeSlotEntry = (index: number, field: keyof TimeSlotEntryType, value: string | number) => {
        const updatedEntries = timeSlotEntries.map((entry, i) =>
            i === index ? { ...entry, [field]: value } : entry
        )
        setTimeSlotEntries(updatedEntries)
        onTimeSlotChange?.(updatedEntries)
    }

    const removeTimeSlotEntry = (index: number) => {
        if (timeSlotEntries.length > 1) {
            const updatedEntries = timeSlotEntries.filter((_, i) => i !== index)
            setTimeSlotEntries(updatedEntries)
            onTimeSlotChange?.(updatedEntries)
        }
    }

    const handleSave = async () => {
        setIsLoading(true)
        try {
            await onSave(venueId)
            setTimeSlotEntries([DEFAULT_TIME_SLOT])
            onOpenChange(false)
        } catch (error) {
            console.error('Error saving configurations:', error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Edit Configurations' : 'Add Configurations'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 overflow-y-auto pr-2 pb-2" ref={scrollContainerRef}>
                    {timeSlotEntries.map((entry, index) => (
                        <div
                            key={index}
                            ref={(el) => {
                                if (el) entryRefs.current[index] = el
                            }}
                        >
                            <TimeSlotEntry
                                entry={entry}
                                index={index}
                                isEdit={isEdit}
                                onUpdate={updateTimeSlotEntry}
                                onRemove={removeTimeSlotEntry}
                                canRemove={timeSlotEntries.length > 1}
                            />
                        </div>
                    ))}
                </div>

                <div className="pt-4 border-t mt-2 space-y-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={addTimeSlotEntry}
                        className="w-full"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Another Configuration
                    </Button>

                    <Button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="w-full"
                    >
                        {isEdit ? 'Update Configurations' : 'Save Configurations'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
} 