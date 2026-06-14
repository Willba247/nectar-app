"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddDayDialogProps {
  availableDays: number[];
  dayNames: string[];
  onClose: () => void;
}

export function AddDayDialog({
  availableDays,
  dayNames,
  onClose,
}: AddDayDialogProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(
    availableDays[0] ?? null,
  );
  const [slotsPerHour, setSlotsPerHour] = useState("10");
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();

  const mutation = api.venueManager.updateQueueSkipConfig.useMutation({
    onSuccess: () => {
      void utils.venueManager.getQueueSkipConfig.invalidate();
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const handleAdd = () => {
    if (selectedDay === null) {
      setError("Please select a day");
      return;
    }

    const slots = parseInt(slotsPerHour, 10);
    if (isNaN(slots) || slots < 1 || slots > 100) {
      setError("Slots per 15 min must be between 1 and 100");
      return;
    }

    mutation.mutate({
      action: "add_day",
      dayOfWeek: selectedDay,
      slotsPerHour: slots,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Day Configuration</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Day of Week</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableDays.map((dayNum) => (
                <Button
                  key={dayNum}
                  variant={selectedDay === dayNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDay(dayNum)}
                >
                  {dayNames[dayNum]}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>Queue Skips Available per 15 min</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={slotsPerHour}
              onChange={(e) => {
                setSlotsPerHour(e.target.value);
                setError(null);
              }}
              className="mt-1 w-32"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Max queue skips available per 15-minute window
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={mutation.isPending}>
            {mutation.isPending ? "Adding..." : "Add Day"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
