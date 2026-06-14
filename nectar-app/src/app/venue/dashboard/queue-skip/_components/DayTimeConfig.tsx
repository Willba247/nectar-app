"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DayConfigCard } from "./DayConfigCard";
import dynamic from "next/dynamic";

const AddDayDialog = dynamic(
  () => import("./AddDayDialog").then((mod) => mod.AddDayDialog),
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

interface DayTimeConfigProps {
  days: DayConfig[];
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function DayTimeConfig({ days }: DayTimeConfigProps) {
  const [isAddingDay, setIsAddingDay] = useState(false);

  const configuredDays = new Set(days.map((d) => d.dayOfWeek));
  const availableDays = [0, 1, 2, 3, 4, 5, 6].filter(
    (d) => !configuredDays.has(d),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Active Days & Times</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddingDay(true)}
          disabled={availableDays.length === 0}
        >
          + Add Day
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {days.length === 0 ? (
          <p className="text-muted-foreground">
            No days configured. Add a day to get started.
          </p>
        ) : (
          days
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((day) => (
              <DayConfigCard
                key={day.id}
                day={day}
                dayName={DAY_NAMES[day.dayOfWeek]!}
              />
            ))
        )}
      </CardContent>

      {isAddingDay && (
        <AddDayDialog
          availableDays={availableDays}
          dayNames={DAY_NAMES}
          onClose={() => setIsAddingDay(false)}
        />
      )}
    </Card>
  );
}
