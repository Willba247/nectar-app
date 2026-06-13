"use client";

import { useState, useEffect } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** All valid times at 15-minute intervals. Value is HH:MM (24-hour, sent to server); label is 12-hour AM/PM for display. */
const TIME_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 96 },
  (_, i) => {
    const h24 = Math.floor(i / 4);
    const m = (i % 4) * 15;
    const value = `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const period = h24 < 12 ? "AM" : "PM";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const label = `${h12}:${String(m).padStart(2, "0")} ${period}`;
    return { value, label };
  },
);

interface TimeSlot {
  id: number;
  startTime: string;
  endTime: string;
  endDayOffset: number;
  customSlots: number | null;
  isActive: boolean;
}

interface TimeSlotEditorProps {
  configDayId: number;
  existingSlot?: TimeSlot;
  onClose: () => void;
}

/**
 * Convert time string "HH:MM" to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function TimeSlotEditor({
  configDayId,
  existingSlot,
  onClose,
}: TimeSlotEditorProps) {
  const [startTime, setStartTime] = useState(existingSlot?.startTime ?? "");
  const [endTime, setEndTime] = useState(existingSlot?.endTime ?? "");
  const [endDayOffset, setEndDayOffset] = useState(
    existingSlot?.endDayOffset ?? 0,
  );
  const [customSlots, setCustomSlots] = useState(
    existingSlot?.customSlots?.toString() ?? "",
  );
  const [isActive, setIsActive] = useState(existingSlot?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect cross-midnight when endTime <= startTime (new slots only).
  // Never runs for existing slots — the user controls the checkbox explicitly
  // when editing, and we must not override their intent.
  useEffect(() => {
    if (existingSlot) return;
    if (startTime && endTime) {
      const startMins = timeToMinutes(startTime);
      const endMins = timeToMinutes(endTime);
      // Auto-tick when end is before/equal to start (e.g. 19:00 → 03:00).
      // Auto-untick when end is clearly after start (same-day combo).
      setEndDayOffset(endMins <= startMins ? 1 : 0);
    }
    // endDayOffset intentionally omitted: this effect must not re-run when the
    // checkbox changes, only when the selected times change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime, endTime]);

  const utils = api.useUtils();

  const addMutation = api.venueManager.updateQueueSkipConfig.useMutation({
    onSuccess: () => {
      void utils.venueManager.getQueueSkipConfig.invalidate();
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const updateMutation = api.venueManager.updateQueueSkipConfig.useMutation({
    onSuccess: () => {
      void utils.venueManager.getQueueSkipConfig.invalidate();
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const handleSave = () => {
    // Ensure both fields have a value. type="time" inputs guarantee HH:MM
    // format on desktop, but some browsers (mobile/Capacitor) return HH:MM:SS
    // — normalise to the first 5 chars so downstream logic stays consistent.
    if (!startTime || !endTime) {
      setError("Please select both a start time and end time");
      return;
    }
    const normStart = startTime.slice(0, 5);
    const normEnd = endTime.slice(0, 5);

    // Validate 15-minute boundary
    const toMins = (t: string) => timeToMinutes(t);
    if (toMins(normStart) % 15 !== 0 || toMins(normEnd) % 15 !== 0) {
      setError("Times must be on a 15-minute boundary (e.g. 19:00, 19:15, 19:30, 19:45)");
      return;
    }

    // Validate cross-midnight logic
    const startMins = timeToMinutes(normStart);
    const endMins = timeToMinutes(normEnd);

    if (endDayOffset === 0 && endMins <= startMins) {
      setError("End time must be after start time for same-day slots");
      return;
    }

    if (endDayOffset === 1 && endMins > startMins) {
      setError(
        "For cross-midnight slots, end time should be before start time (e.g., 19:00 → 02:00)",
      );
      return;
    }

    // Parse custom slots
    let parsedCustomSlots: number | null = null;
    if (customSlots.trim()) {
      parsedCustomSlots = parseInt(customSlots, 10);
      if (
        isNaN(parsedCustomSlots) ||
        parsedCustomSlots < 1 ||
        parsedCustomSlots > 100
      ) {
        setError("Custom slots must be between 1 and 100");
        return;
      }
    }

    if (existingSlot) {
      // Update existing
      updateMutation.mutate({
        action: "update_time",
        configHourId: existingSlot.id,
        startTime: normStart,
        endTime: normEnd,
        endDayOffset,
        customSlots: parsedCustomSlots,
        isActive,
      });
    } else {
      // Add new
      addMutation.mutate({
        action: "add_time",
        configDayId,
        times: [
          {
            startTime: normStart,
            endTime: normEnd,
            endDayOffset,
            customSlots: parsedCustomSlots,
            isActive,
          },
        ],
      });
    }
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-3 rounded border bg-card p-3 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Start Time</Label>
          <Select
            value={startTime}
            onValueChange={(v) => {
              setStartTime(v);
              setError(null);
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">End Time</Label>
          <Select
            value={endTime}
            onValueChange={(v) => {
              setEndTime(v);
              setError(null);
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="crossMidnight"
          checked={endDayOffset === 1}
          onCheckedChange={(checked) => {
            setEndDayOffset(checked ? 1 : 0);
            setError(null);
          }}
        />
        <Label htmlFor="crossMidnight" className="cursor-pointer text-xs">
          Ends next day (cross-midnight)
        </Label>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label className="text-xs">Custom Slots (optional)</Label>
          <Input
            type="number"
            min="1"
            max="100"
            value={customSlots}
            onChange={(e) => {
              setCustomSlots(e.target.value);
              setError(null);
            }}
            placeholder="Use day default"
            className="h-8"
          />
        </div>
        <div className="flex items-center gap-2 pt-4">
          <Label className="text-xs">Active</Label>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : existingSlot ? "Update" : "Add"}
        </Button>
      </div>
    </div>
  );
}
