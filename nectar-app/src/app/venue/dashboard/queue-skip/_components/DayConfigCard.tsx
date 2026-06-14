"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import dynamic from "next/dynamic";

const TimeSlotEditor = dynamic(
  () => import("./TimeSlotEditor").then((mod) => mod.TimeSlotEditor),
  { ssr: false },
);

interface TimeSlot {
  id: number;
  startTime: string;
  endTime: string;
  endDayOffset: number;
  customSlots: number | null;
  isActive: boolean;
}

interface DayConfig {
  id: number;
  dayOfWeek: number;
  slotsPerHour: number;
  isActive: boolean;
  times: TimeSlot[];
}

interface DayConfigCardProps {
  day: DayConfig;
  dayName: string;
}

export function DayConfigCard({ day, dayName }: DayConfigCardProps) {
  const [isAddingTime, setIsAddingTime] = useState(false);
  const [editingTimeId, setEditingTimeId] = useState<number | null>(null);
  const [slotsPerHour, setSlotsPerHour] = useState(String(day.slotsPerHour));
  const utils = api.useUtils();

  const updateDayMutation = api.venueManager.updateQueueSkipConfig.useMutation({
    onSuccess: () => utils.venueManager.getQueueSkipConfig.invalidate(),
  });

  const deleteDayMutation = api.venueManager.updateQueueSkipConfig.useMutation({
    onSuccess: () => utils.venueManager.getQueueSkipConfig.invalidate(),
  });

  const deleteTimeMutation = api.venueManager.updateQueueSkipConfig.useMutation(
    {
      onSuccess: () => utils.venueManager.getQueueSkipConfig.invalidate(),
    },
  );

  const handleToggleActive = (isActive: boolean) => {
    updateDayMutation.mutate({
      action: "update_day",
      configDayId: day.id,
      dayIsActive: isActive,
    });
  };

  const handleUpdateSlots = () => {
    const slots = parseInt(slotsPerHour, 10);
    if (isNaN(slots) || slots < 1 || slots > 100) return;
    if (slots === day.slotsPerHour) return;

    updateDayMutation.mutate({
      action: "update_day",
      configDayId: day.id,
      slotsPerHour: slots,
    });
  };

  const handleDeleteDay = () => {
    if (confirm(`Remove ${dayName}? All time slots will be deleted.`)) {
      deleteDayMutation.mutate({
        action: "delete_day",
        configDayId: day.id,
      });
    }
  };

  const handleDeleteTime = (timeId: number) => {
    if (confirm("Delete this time slot?")) {
      deleteTimeMutation.mutate({
        action: "delete_time",
        configHourId: timeId,
      });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{dayName}</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Active</span>
            <Switch
              checked={day.isActive}
              onCheckedChange={handleToggleActive}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteDay}
            className="text-red-600 hover:text-red-700"
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm">Queue Skips Available/15 min:</Label>
        <Input
          type="number"
          min="1"
          max="100"
          value={slotsPerHour}
          onChange={(e) => setSlotsPerHour(e.target.value)}
          onBlur={handleUpdateSlots}
          className="w-20"
        />
      </div>

      <div className="space-y-2 border-l-2 border-border pl-4">
        <h4 className="text-sm font-medium text-muted-foreground">Time Slots</h4>
        {day.times.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time slots configured</p>
        ) : (
          day.times.map((slot) =>
            editingTimeId === slot.id ? (
              <TimeSlotEditor
                key={slot.id}
                configDayId={day.id}
                existingSlot={slot}
                onClose={() => setEditingTimeId(null)}
              />
            ) : (
              <div
                key={slot.id}
                className="flex items-center justify-between rounded bg-muted px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={
                      slot.isActive ? "" : "text-muted-foreground line-through"
                    }
                  >
                    {slot.startTime} - {slot.endTime}
                    {slot.endDayOffset === 1 && (
                      <span className="ml-1 text-xs text-blue-600">
                        (+1 day)
                      </span>
                    )}
                  </span>
                  {slot.customSlots && (
                    <span className="text-xs text-muted-foreground">
                      ({slot.customSlots} slots)
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingTimeId(slot.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTime(slot.id)}
                    className="text-red-600"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ),
          )
        )}
        {isAddingTime ? (
          <TimeSlotEditor
            configDayId={day.id}
            onClose={() => setIsAddingTime(false)}
          />
        ) : (
          <Button
            variant="link"
            size="sm"
            onClick={() => setIsAddingTime(true)}
            className="p-0"
          >
            + Add Time Slot
          </Button>
        )}
      </div>
    </div>
  );
}
