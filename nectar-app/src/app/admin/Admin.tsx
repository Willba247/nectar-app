// 'use client'

// import { useState, useEffect } from 'react'
// import toast from 'react-hot-toast'
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
// import { Button } from '@/components/ui/button'
// import { Switch } from '@/components/ui/switch'
// import { TrashIcon, PlusCircle, Clock, AlertCircle, Pencil } from 'lucide-react'
// import AddQueueSkipDialog from '../_components/AddQueueSkipDialog'
// import { api } from '@/trpc/react'
// import type { QSConfigDay, TimeSlotEntry } from '@/types/queue-skip'
// import { dayNames } from '@/types/queue-skip'

// export default function QueueSkipAdmin() {
//     const [selectedVenueId, setSelectedVenueId] = useState<string>('')
//     const [isAddDayDialogOpen, setIsAddDayDialogOpen] = useState(false)
//     const [isEditMode, setIsEditMode] = useState(false)
//     const [configsToEdit, setConfigsToEdit] = useState<QSConfigDay[]>([])
//     const [timeSlotEntries, setTimeSlotEntries] = useState<TimeSlotEntry[]>([])

//     const utils = api.useUtils()
//     const deleteVenueQueueSkipConfig = api.venue.deleteVenueQueueSkipConfig.useMutation()
//     const toggleConfigActiveStatus = api.venue.toggleConfigActive.useMutation()
//     const { data: venues, isLoading } = api.venue.getAllVenues.useQuery();

//     const [venueConfigs, setVenueConfigs] = useState(venues?.map(venue => ({
//         ...venue,
//     })))

//     // Add useEffect to update venueConfigs when venues data changes
//     useEffect(() => {
//         if (venues) {
//             setVenueConfigs(venues.map(venue => ({
//                 ...venue,
//             })))
//         }
//     }, [venues])

//     const createQSConfig = api.venue.createVenueQueueSkipConfigs.useMutation({})

//     const addDayConfigs = async (venueId: string) => {
//         try {
//             await createQSConfig.mutateAsync({
//                 venueId,
//                 configs: timeSlotEntries.map(entry => ({
//                     dayOfWeek: entry.day_of_week,
//                     start_time: entry.start_time,
//                     end_time: entry.end_time,
//                     slots_per_hour: entry.slots_per_hour
//                 }))
//             })
//             toast.success('Configurations added successfully')
//             // Invalidate and refetch the data
//             await utils.venue.getAllVenues.invalidate()
//             setIsAddDayDialogOpen(false)
//         } catch (error) {
//             toast.error('Failed to save configurations')
//         }
//     }

//     const deleteDayConfig = async (configId: number) => {
//         try {
//             await deleteVenueQueueSkipConfig.mutateAsync({
//                 configDayId: configId,
//             })
//             await utils.venue.getAllVenues.invalidate()
//             toast.success('Configuration deleted successfully')
//         } catch (error) {
//             toast.error('Failed to delete configuration')
//         }
//     }

//     const toggleConfigActive = async (configId: number, isActive: boolean) => {
//         // Optimistically update the UI
//         const updatedVenueConfigs = venueConfigs?.map(venue => ({
//             ...venue,
//             queueSkipConfigs: venue.queueSkipConfigs?.map(config =>
//                 config.id === configId ? { ...config, is_active: isActive } : config
//             )
//         }))

//         // Update the local state
//         setVenueConfigs(updatedVenueConfigs)

//         try {
//             await toggleConfigActiveStatus.mutateAsync({
//                 configId,
//                 isActive
//             })
//             // Invalidate and refetch the data for all venues
//             await utils.venue.getAllVenues.invalidate()
//             toast.success(`Configuration ${isActive ? 'activated' : 'deactivated'} successfully`)
//         } catch (error) {
//             // Revert the optimistic update on error
//             const revertedVenueConfigs = venueConfigs?.map(venue => ({
//                 ...venue,
//                 queueSkipConfigs: venue.queueSkipConfigs?.map(config =>
//                     config.id === configId ? { ...config, is_active: !isActive } : config
//                 )
//             }))
//             setVenueConfigs(revertedVenueConfigs)
//             toast.error('Failed to toggle configuration')
//         }
//     }

//     const openDialog = (venueId: string, configs?: QSConfigDay[]) => {
//         setSelectedVenueId(venueId)
//         setIsEditMode(!!configs)
//         if (configs) {
//             setConfigsToEdit([...configs])
//         } else {
//             setConfigsToEdit([])
//             setTimeSlotEntries([])
//         }
//         setIsAddDayDialogOpen(true)
//     }

//     return (
//         <div className="container mx-auto py-8">
//             <h1 className="text-3xl font-bold mb-6">Queue Skip Configuration</h1>

//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//                 {venueConfigs?.map(venue => (
//                     <Card key={venue.id} className="shadow-md">
//                         <CardHeader>
//                             <div className="flex justify-between items-start">
//                                 <CardTitle className="text-xl">{venue.name}</CardTitle>
//                                 {venue.queueSkipConfigs?.length === 0 && (
//                                     <div className="bg-red-100 text-red-800 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
//                                         <AlertCircle className="h-3 w-3" />
//                                         No Config
//                                     </div>
//                                 )}
//                             </div>
//                         </CardHeader>
//                         <CardContent>
//                             <div className="space-y-4">
//                                 <div className="flex justify-between items-center">
//                                     <h3 className="text-lg font-medium">Day Configurations</h3>
//                                     <Button
//                                         variant="outline"
//                                         size="sm"
//                                         onClick={() => {
//                                             if (venue.queueSkipConfigs?.length) {
//                                                 openDialog(venue.id, venue.queueSkipConfigs)
//                                             } else {
//                                                 openDialog(venue.id)
//                                             }
//                                         }}
//                                         disabled={isLoading}
//                                     >
//                                         {venue.queueSkipConfigs?.length ? (
//                                             <>
//                                                 <Pencil className="h-4 w-4 mr-2" />
//                                                 Edit Configurations
//                                             </>
//                                         ) : (
//                                             <>
//                                                 <PlusCircle className="h-4 w-4 mr-2" />
//                                                 Add Configuration
//                                             </>
//                                         )}
//                                     </Button>
//                                 </div>

//                                 <div className="space-y-3">
//                                     {venue.queueSkipConfigs?.length ? (
//                                         <div>
//                                             {venue.queueSkipConfigs.map(config => (
//                                                 <div key={config.id} className="border rounded-md p-3">
//                                                     <div className="flex justify-between items-center mb-2">
//                                                         <div className="flex items-center">
//                                                             <Switch
//                                                                 checked={config.is_active}
//                                                                 onCheckedChange={(checked) => toggleConfigActive(config.id, checked)}
//                                                                 className="mr-2"
//                                                             />
//                                                             <span className="font-medium">{dayNames[config.day_of_week]}</span>
//                                                         </div>
//                                                         <div className="flex items-center">
//                                                             <Button
//                                                                 variant="ghost"
//                                                                 size="sm"
//                                                                 onClick={() => openDialog(venue.id, [config])}
//                                                                 className="h-7 w-7 p-0 mr-1"
//                                                             >
//                                                                 <Pencil className="h-3 w-3 text-gray-500" />
//                                                             </Button>
//                                                             <Button
//                                                                 variant="ghost"
//                                                                 size="sm"
//                                                                 onClick={() => deleteDayConfig(config.id)}
//                                                                 className="h-7 w-7 p-0"
//                                                             >
//                                                                 <TrashIcon className="h-3 w-3 text-red-500" />
//                                                             </Button>
//                                                         </div>
//                                                     </div>

//                                                     <div className="space-y-2">
//                                                         <div className="flex items-center space-x-3 text-sm">
//                                                             <Clock className="h-3 w-3" />
//                                                             <span>
//                                                                 17:00 to 23:00
//                                                                 {` (${config.slots_per_hour} slots/hour)`}
//                                                             </span>
//                                                         </div>
//                                                     </div>
//                                                 </div>
//                                             ))}
//                                         </div>
//                                     ) : (
//                                         <div className="text-gray-500 text-sm italic">No configurations added yet</div>
//                                     )}
//                                 </div>
//                             </div>
//                         </CardContent>
//                     </Card>
//                 ))}
//             </div>

//             <AddQueueSkipDialog
//                 key={`dialog-${selectedVenueId}-${isEditMode ? 'edit' : 'add'}`}
//                 venueId={selectedVenueId}
//                 isOpen={isAddDayDialogOpen}
//                 onOpenChange={setIsAddDayDialogOpen}
//                 onSave={addDayConfigs}
//                 onTimeSlotChange={setTimeSlotEntries}
//                 existingConfig={configsToEdit}
//                 isEdit={isEditMode}
//             />
//         </div>
//     )
// } 