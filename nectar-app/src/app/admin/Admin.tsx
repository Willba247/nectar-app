'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { TrashIcon, PlusCircle, Clock, AlertCircle, Pencil } from 'lucide-react'
import AddQueueSkipDialog from '../_components/AddQueueSkipDialog'
import { api } from '@/trpc/react'
import type { QSConfigDay, TimeSlotEntry } from '@/types/queue-skip'
import { dayNames } from '@/types/queue-skip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseTimeString } from '@/app/hooks/useAvailableQSkips'

export default function AdminPage() {
    const [selectedVenueId, setSelectedVenueId] = useState<string>('')
    const [isAddDayDialogOpen, setIsAddDayDialogOpen] = useState(false)
    const [isEditMode, setIsEditMode] = useState(false)
    const [configsToEdit, setConfigsToEdit] = useState<QSConfigDay[]>([])
    const [timeSlotEntries, setTimeSlotEntries] = useState<TimeSlotEntry[]>([])
    const [venuePrices, setVenuePrices] = useState<Record<string, number>>({})

    const [isPriceModified, setIsPriceModified] = useState<Record<string, boolean>>({})
    const utils = api.useUtils()
    const deleteVenueQueueSkipConfig = api.venue.deleteVenueQueueSkipConfig.useMutation()
    const toggleConfigActiveStatus = api.venue.toggleConfigActive.useMutation()
    const updateVenuePrice = api.price.updateVenuePrice.useMutation()
    const { data: venues, isLoading } = api.venue.getAllVenues.useQuery();

    const [venueConfigs, setVenueConfigs] = useState(venues?.map(venue => ({
        ...venue,
    })))

    // Add useEffect to update venueConfigs when venues data changes
    useEffect(() => {
        if (venues) {
            setVenueConfigs(venues.map(venue => ({
                ...venue,
            })))
            setVenuePrices(venues.reduce((acc, venue) => ({
                ...acc,
                [venue.id]: venue.price
            }), {}))
        }
    }, [venues])


    const createQSConfig = api.venue.createVenueQueueSkipConfigs.useMutation({})

    const addDayConfigs = async (venueId: string) => {
        try {
            const configs = timeSlotEntries.flatMap(entry => {
                const startTime = parseTimeString(entry.start_time);
                const endTime = parseTimeString(entry.end_time);

                if (!startTime || !endTime) return [];

                // If end time is less than start time, it means it's overnight
                if (endTime.hours < startTime.hours) {
                    // Create two entries:
                    // 1. First entry: start_time to 23:59
                    // 2. Second entry: 00:00 to end_time
                    return [
                        {
                            dayOfWeek: entry.day_of_week,
                            start_time: entry.start_time,
                            end_time: '23:59',
                            slots_per_hour: entry.slots_per_hour
                        },
                        {
                            dayOfWeek: (entry.day_of_week + 1) % 7, // Next day
                            start_time: '00:00',
                            end_time: entry.end_time,
                            slots_per_hour: entry.slots_per_hour
                        }
                    ];
                }

                // Normal case - single entry
                return [{
                    dayOfWeek: entry.day_of_week,
                    start_time: entry.start_time,
                    end_time: entry.end_time,
                    slots_per_hour: entry.slots_per_hour
                }];
            });

            await createQSConfig.mutateAsync({
                venueId,
                configs
            });
            toast.success('Configurations added successfully');
            // Invalidate and refetch the data
            await utils.venue.getAllVenues.invalidate();
            setIsAddDayDialogOpen(false);
        } catch (error) {
            toast.error('Failed to save configurations');
        }
    }

    const deleteDayConfig = async (configId: number) => {
        try {
            await deleteVenueQueueSkipConfig.mutateAsync({
                configDayId: configId,
            })
            await utils.venue.getAllVenues.invalidate()
            toast.success('Configuration deleted successfully')
        } catch (error) {
            toast.error('Failed to delete configuration')
        }
    }

    const toggleConfigActive = async (configId: number, isActive: boolean) => {
        // Optimistically update the UI
        const updatedVenueConfigs = venueConfigs?.map(venue => ({
            ...venue,
            queueSkipConfigs: venue.qs_config_days?.map(config =>
                config.id === configId ? { ...config, is_active: isActive } : config
            )
        }))

        // Update the local state
        setVenueConfigs(updatedVenueConfigs)

        try {
            await toggleConfigActiveStatus.mutateAsync({
                configId,
                isActive
            })
            // Invalidate and refetch the data for all venues
            await utils.venue.getAllVenues.invalidate()
            toast.success(`Configuration ${isActive ? 'activated' : 'deactivated'} successfully`)
        } catch (error) {
            // Revert the optimistic update on error
            const revertedVenueConfigs = venueConfigs?.map(venue => ({
                ...venue,
                qs_config_days: venue.qs_config_days?.map(config =>
                    config.id === configId ? { ...config, is_active: !isActive } : config
                )
            }))
            setVenueConfigs(revertedVenueConfigs)
            toast.error('Failed to toggle configuration')
        }
    }
    const handlePriceUpdate = async (venueId: string, newPrice: number) => {
        try {
            await updateVenuePrice.mutateAsync({
                venueId,
                price: newPrice
            })
            await utils.venue.getAllVenues.invalidate()
            setVenuePrices(prev => ({ ...prev, [venueId]: newPrice }))
            setIsPriceModified(prev => ({ ...prev, [venueId]: false }))
            toast.success('Price updated successfully')
        } catch (error) {
            toast.error('Failed to update price')
        }
    }
    const openDialog = (venueId: string, configs?: QSConfigDay[]) => {
        setSelectedVenueId(venueId)
        setIsEditMode(!!configs)
        if (configs) {
            setConfigsToEdit([...configs])
        } else {
            setConfigsToEdit([])
            setTimeSlotEntries([])
        }
        setIsAddDayDialogOpen(true)
    }

    if (isLoading) {
        return <div className="text-white">Loading...</div>;
    }

    if (!venues) {
        return <div className="text-white">No venues found</div>;
    }

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-6">Queue Skip Configuration</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {venueConfigs?.map(venue => (
                    <Card key={venue.id} className="shadow-md">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-xl">{venue.name}</CardTitle>
                                {venue.qs_config_days?.length === 0 && (
                                    <div className="bg-red-100 text-red-800 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        No Config
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            if (venue.qs_config_days?.length) {
                                                openDialog(venue.id, venue.qs_config_days)
                                            } else {
                                                openDialog(venue.id)
                                            }
                                        }}
                                        disabled={isLoading}
                                    >
                                        {venue.qs_config_days?.length ? (
                                            <>
                                                <Pencil className="h-4 w-4 mr-2" />
                                                Edit Configurations
                                            </>
                                        ) : (
                                            <>
                                                <PlusCircle className="h-4 w-4 mr-2" />
                                                Add Configuration
                                            </>
                                        )}
                                    </Button>
                                </div>
                                <div className="flex flex-col gap-2 w-full">
                                    <Label>QS Price</Label>
                                    <div className='flex items-center gap-2'>
                                        <p>$</p>
                                        <Input
                                            type="number"
                                            placeholder="Price"
                                            value={venuePrices[venue.id] ?? ""}
                                            className='w-1/3'
                                            onChange={(e) => {
                                                const newPrice = Number(e.target.value)
                                                setVenuePrices(prev => ({ ...prev, [venue.id]: newPrice }))
                                                setIsPriceModified(prev => ({ ...prev, [venue.id]: newPrice !== (venuePrices[venue.id]) }))
                                            }}
                                        />
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => handlePriceUpdate(venue.id, venuePrices[venue.id] ?? 0)}
                                        disabled={!isPriceModified[venue.id]}
                                    >
                                        Save
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {venue.qs_config_days?.length ? (
                                        <div>
                                            {venue.qs_config_days.map(config => (
                                                <div key={config.id} className="border rounded-md p-3">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div className="flex items-center">
                                                            <Switch
                                                                checked={config.is_active}
                                                                onCheckedChange={(checked) => toggleConfigActive(config.id, checked)}
                                                                className="mr-2"
                                                            />
                                                            <span className="font-medium">{dayNames[config.day_of_week]}</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => deleteDayConfig(config.id)}
                                                                className="h-7 w-7 p-0"
                                                            >
                                                                <TrashIcon className="h-3 w-3 text-red-500" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex items-center space-x-3 text-sm">
                                                            <Clock className="h-3 w-3" />
                                                            <span>
                                                                {config.qs_config_hours[0]?.start_time.slice(0, 5)} to {config.qs_config_hours[0]?.end_time.slice(0, 5)}
                                                                {` (${config.slots_per_hour} slots/hour)`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-gray-500 text-sm italic">No configurations added yet</div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <AddQueueSkipDialog
                key={`dialog-${selectedVenueId}-${isEditMode ? 'edit' : 'add'}`}
                venueId={selectedVenueId}
                isOpen={isAddDayDialogOpen}
                onOpenChange={setIsAddDayDialogOpen}
                onSave={addDayConfigs}
                onTimeSlotChange={setTimeSlotEntries}
                existingConfig={configsToEdit}
                isEdit={isEditMode}
            />
        </div>
    )
} 