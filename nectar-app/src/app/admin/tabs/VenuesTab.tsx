'use client'

import { useMemo, useState, useEffect } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/trpc/react'
import toast from 'react-hot-toast'
import { Plus, Edit, Trash2, Upload, X, TrashIcon, PlusCircle, Clock, AlertCircle, Pencil } from 'lucide-react'
import AddQueueSkipDialog from '../../_components/AddQueueSkipDialog'
import type { VenueWithConfigs } from '@/server/api/routers/venue'
import type { QSConfigDay, TimeSlotEntry } from '@/types/queue-skip'
import { dayNames } from '@/types/queue-skip'
import { parseTimeString } from '@/app/hooks/useAvailableQSkips'

interface VenueFormData {
  name: string
  price: number
  timeZone: string
}

type TimeZoneOption = {
  value: string
  label: string
}

const AU_TIME_ZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Hobart',
  'Australia/Darwin',
  'Australia/Currie',
  'Australia/Lord_Howe',
]

function getTimeZones() {
  if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
    try {
      return Intl.supportedValuesOf('timeZone').filter((zone) =>
        zone.startsWith('Australia/')
      )
    } catch {
      return AU_TIME_ZONES
    }
  }
  return AU_TIME_ZONES
}

function formatOffset(offsetMs: number | null) {
  if (offsetMs === null) {
    return '(UTC)'
  }

  const totalMinutes = Math.round(offsetMs / 60000)
  const sign = totalMinutes >= 0 ? '+' : '-'
  const absMinutes = Math.abs(totalMinutes)
  const hours = Math.floor(absMinutes / 60)
  const minutes = absMinutes % 60

  return `(UTC${sign}${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')})`
}

function getTimeZoneOffsetMs(timeZone: string): number | null {
  if (typeof Intl === 'undefined') {
    return null
  }

  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const parts = formatter.formatToParts(now)
    const lookup = (type: string) => parts.find((part) => part.type === type)?.value
    const toNumber = (value: string | undefined) => {
      if (!value) return 0
      const parsed = Number(value)
      return Number.isNaN(parsed) ? 0 : parsed
    }

    const year = toNumber(lookup('year'))
    const month = toNumber(lookup('month'))
    const day = toNumber(lookup('day'))
    const hours = toNumber(lookup('hour'))
    const minutes = toNumber(lookup('minute'))
    const seconds = toNumber(lookup('second'))

    const localMs = Date.UTC(year, month - 1, day, hours, minutes, seconds)
    return now.getTime() - localMs
  } catch {
    return null
  }
}

function buildTimeZoneOptions(baseZones: string[], extra?: string): TimeZoneOption[] {
  const uniqueZones = extra ? [extra, ...baseZones] : baseZones
  const seen = new Set<string>()
  const zonesWithOffset = uniqueZones.reduce<
    { value: string; offsetMs: number | null }[]
  >((acc, zone) => {
    if (seen.has(zone)) return acc
    seen.add(zone)
    acc.push({
      value: zone,
      offsetMs: getTimeZoneOffsetMs(zone),
    })
    return acc
  }, [])

  return zonesWithOffset
    .sort((a, b) => {
      const aOffset = a.offsetMs ?? 0
      const bOffset = b.offsetMs ?? 0
      if (aOffset !== bOffset) {
        return aOffset - bOffset
      }
      return a.value.localeCompare(b.value)
    })
    .map(({ value, offsetMs }) => ({
      value,
      label: `${formatOffset(offsetMs)} ${value}`,
    }))
}

export default function VenuesTab() {
  const [isCreateVenueDialogOpen, setIsCreateVenueDialogOpen] = useState(false)
  const [isEditVenueDialogOpen, setIsEditVenueDialogOpen] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState<VenueWithConfigs | null>(null)

  // Queue skip config states
  const [selectedVenueId, setSelectedVenueId] = useState<string>('')
  const [isAddDayDialogOpen, setIsAddDayDialogOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [configsToEdit, setConfigsToEdit] = useState<QSConfigDay[]>([])
  const [timeSlotEntries, setTimeSlotEntries] = useState<TimeSlotEntry[]>([])
  const [venuePrices, setVenuePrices] = useState<Record<string, number>>({})
  const [isPriceModified, setIsPriceModified] = useState<Record<string, boolean>>({})

  const { data: venues, isLoading } = api.venue.getAllVenues.useQuery()
  const utils = api.useUtils()

  // Venue mutations
  const deleteVenue = api.venue.deleteVenue.useMutation({
    onSuccess: () => {
      toast.success('Venue deleted successfully')
      void utils.venue.getAllVenues.invalidate()
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  // Queue skip mutations
  const deleteVenueQueueSkipConfig = api.venue.deleteVenueQueueSkipConfig.useMutation()
  const toggleConfigActiveStatus = api.venue.toggleConfigActive.useMutation()
  const updateVenuePrice = api.price.updateVenuePrice.useMutation()
  const createQSConfig = api.venue.createVenueQueueSkipConfigs.useMutation({})

  // Initialize venue prices when venues load
  useEffect(() => {
    if (venues) {
      setVenuePrices(venues.reduce((acc, venue) => ({
        ...acc,
        [venue.id]: venue.price
      }), {}))
    }
  }, [venues])

  const handleEditVenue = (venue: VenueWithConfigs) => {
    setSelectedVenue(venue)
    setIsEditVenueDialogOpen(true)
  }

  const handleDeleteVenue = (venue: VenueWithConfigs) => {
    if (confirm(`Are you sure you want to delete "${venue.name}"?`)) {
      deleteVenue.mutate({ id: venue.id })
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
    } catch {
      toast.error('Failed to update price')
    }
  }

  // Queue skip config functions
  const addDayConfigs = async (venueId: string) => {
    try {
      const configs = timeSlotEntries.flatMap(entry => {
        const startTime = parseTimeString(entry.start_time);
        const endTime = parseTimeString(entry.end_time);

        if (!startTime || !endTime) return [];

        if (endTime.hours < startTime.hours) {
          return [
            {
              dayOfWeek: entry.day_of_week,
              start_time: entry.start_time,
              end_time: '23:59',
              slots_per_hour: entry.slots_per_hour
            },
            {
              dayOfWeek: (entry.day_of_week + 1) % 7,
              start_time: '00:00',
              end_time: entry.end_time,
              slots_per_hour: entry.slots_per_hour
            }
          ];
        }

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
      await utils.venue.getAllVenues.invalidate();
      setIsAddDayDialogOpen(false);
    } catch {
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
    } catch {
      toast.error('Failed to delete configuration')
    }
  }

  const toggleConfigActive = async (configId: number, isActive: boolean) => {
    try {
      await toggleConfigActiveStatus.mutateAsync({
        configId,
        isActive
      })
      await utils.venue.getAllVenues.invalidate()
      toast.success(`Configuration ${isActive ? 'activated' : 'deactivated'} successfully`)
    } catch {
      toast.error('Failed to toggle configuration')
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
    return <div className="text-center py-8">Loading venues...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Venue Button */}
      <div className="flex justify-between items-center">
        <Dialog open={isCreateVenueDialogOpen} onOpenChange={setIsCreateVenueDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Venue
            </Button>
          </DialogTrigger>
          <VenueDialog
            mode="create"
            onSuccess={() => setIsCreateVenueDialogOpen(false)}
            onClose={() => setIsCreateVenueDialogOpen(false)}
          />
        </Dialog>
      </div>

      {/* Venues Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {venues?.map((venue) => (
          <Card key={venue.id} className="shadow-md pt-0 border-none">
            {/* Venue Image */}
            <div className="relative h-48">
              <Image
                src={venue.image_url}
                alt={venue.name}
                fill
                className="object-cover rounded-t-lg"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleEditVenue(venue)}
                  className="bg-white/90 hover:bg-white"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteVenue(venue)}
                  disabled={deleteVenue.isPending}
                  className="bg-red-600/90 hover:bg-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

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
              <div className='flex gap-2 text-xs text-gray-500'>
                <p>Time Zone:</p>
                <p>{venue.time_zone}</p>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                {/* Queue Skip Configuration */}
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
                        Edit Queue Config
                      </>
                    ) : (
                      <>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Queue Config
                      </>
                    )}
                  </Button>
                </div>

                {/* Price Management */}
                <div className="flex flex-col gap-2 w-full">
                  <Label>Queue Skip Price</Label>
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
                        setIsPriceModified(prev => ({ ...prev, [venue.id]: newPrice !== venue.price }))
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handlePriceUpdate(venue.id, venuePrices[venue.id] ?? 0)}
                    disabled={!isPriceModified[venue.id]}
                  >
                    Save Price
                  </Button>
                </div>

                {/* Queue Skip Config Display */}
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
                    <div className="text-gray-500 text-sm italic">No queue skip configurations</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {venues?.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-xl font-semibold text-gray-700 mb-4">No venues found</h3>
          <p className="text-gray-500 mb-6">Get started by adding your first venue</p>
          <Button onClick={() => setIsCreateVenueDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Venue
          </Button>
        </div>
      )}

      {/* Edit Venue Dialog */}
      <Dialog open={isEditVenueDialogOpen} onOpenChange={setIsEditVenueDialogOpen}>
        <VenueDialog
          mode="edit"
          venue={selectedVenue}
          onSuccess={() => {
            setIsEditVenueDialogOpen(false)
            setSelectedVenue(null)
          }}
          onClose={() => {
            setIsEditVenueDialogOpen(false)
            setSelectedVenue(null)
          }}
        />
      </Dialog>

      {/* Queue Skip Configuration Dialog */}
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

// Venue Dialog Component
interface VenueDialogProps {
  mode: 'create' | 'edit'
  venue?: VenueWithConfigs | null
  onSuccess: () => void
  onClose: () => void
}

function VenueDialog({ mode, venue, onSuccess, onClose }: VenueDialogProps) {
  const [formData, setFormData] = useState<VenueFormData>({
    name: venue?.name ?? '',
    price: venue?.price ?? 0,
    timeZone: venue?.time_zone ?? '',
  })

  useEffect(() => {
    if (!venue) return
    setFormData({
      name: venue.name,
      price: venue.price,
      timeZone: venue.time_zone
    })
  }, [venue?.id])

  const baseTimeZones = useMemo(() => getTimeZones(), [])
  const timeZoneOptions = useMemo(() => buildTimeZoneOptions(baseTimeZones, formData.timeZone), [baseTimeZones, formData.timeZone])

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>(venue?.image_url ?? '')
  const [isUploading, setIsUploading] = useState(false)

  const utils = api.useUtils()

  const createVenue = api.venue.createVenue.useMutation({
    onSuccess: () => {
      toast.success('Venue created successfully')
      void utils.venue.getAllVenues.invalidate()
      onSuccess()
      resetForm()
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  const updateVenue = api.venue.updateVenue.useMutation({
    onSuccess: () => {
      toast.success('Venue updated successfully')
      void utils.venue.getAllVenues.invalidate()
      onSuccess()
      resetForm()
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  const uploadImage = api.venue.uploadVenueImage.useMutation()

  const resetForm = () => {
    setFormData({ name: '', price: 0, timeZone: '' })
    setImageFile(null)
    setImagePreview('')
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please select a valid image file (JPEG, PNG, or WebP)')
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image file must be less than 5MB')
        return
      }

      setImageFile(file)

      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(mode === 'edit' ? venue?.image_url ?? '' : '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Venue name is required')
      return
    }

    if (formData.price < 0) {
      toast.error('Price must be positive')
      return
    }

    const trimmedTimeZone = formData.timeZone.trim()

    if (!trimmedTimeZone) {
      toast.error('Time zone is required')
      return
    }

    try {
      let imageUrl = venue?.image_url ?? ''

      if (imageFile) {
        setIsUploading(true)
        const reader = new FileReader()
        reader.onloadend = async () => {
          try {
            const result = await uploadImage.mutateAsync({
              fileName: imageFile.name,
              fileType: imageFile.type,
              fileData: reader.result as string,
            })

            imageUrl = result.imageUrl

            if (mode === 'create') {
              createVenue.mutate({
                name: formData.name.trim(),
                price: formData.price,
                imageUrl,
                timeZone: trimmedTimeZone,
              })
            } else if (venue?.id) {
              updateVenue.mutate({
                id: venue.id,
                name: formData.name.trim(),
                price: formData.price,
                imageUrl,
                timeZone: trimmedTimeZone,
              })
            }
          } catch (error) {
            toast.error('Failed to upload image')
          } finally {
            setIsUploading(false)
          }
        }
        reader.readAsDataURL(imageFile)
      } else {
        if (mode === 'create') {
          if (!imageUrl) {
            toast.error('Please select an image for the venue')
            return
          }
          createVenue.mutate({
            name: formData.name.trim(),
            price: formData.price,
            imageUrl,
            timeZone: trimmedTimeZone,
          })
        } else if (venue?.id) {
          updateVenue.mutate({
            id: venue.id,
            name: formData.name.trim(),
            price: formData.price,
            ...(imageUrl !== venue.image_url && { imageUrl }),
            timeZone: trimmedTimeZone,
          })
        }
      }
    } catch (error) {
      toast.error('Something went wrong')
    }
  }

  const isLoading = createVenue.isPending || updateVenue.isPending || isUploading

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>
          {mode === 'create' ? 'Add New Venue' : 'Edit Venue'}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Venue Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter venue name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Queue Skip Price ($) *</Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="time-zone">Time Zone (IANA) *</Label>
          <Select
            value={formData.timeZone}
            onValueChange={(value) => setFormData({ ...formData, timeZone: value })}
          >
            <SelectTrigger id="time-zone" className="w-full">
              <SelectValue placeholder="Select a timezone" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              {timeZoneOptions.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            Use an IANA timezone string such as <span className="font-medium">America/New_York</span>.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Venue Image *</Label>

          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Venue preview"
                className="w-full h-48 object-cover rounded-md border"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={removeImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-2">
                <label htmlFor="image-upload" className="cursor-pointer">
                  <span className="text-sm text-gray-600">Click to upload venue image</span>
                  <input
                    id="image-upload"
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                JPEG, PNG or WebP (max 5MB)
              </p>
            </div>
          )}

          {!imagePreview && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => document.getElementById('image-upload')?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Select Image
            </Button>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? (isUploading ? 'Uploading...' : 'Saving...')
              : (mode === 'create' ? 'Create Venue' : 'Update Venue')
            }
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}
