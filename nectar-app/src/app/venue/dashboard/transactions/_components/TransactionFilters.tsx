"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface TransactionFiltersProps {
  filter: "all" | "paid";
  dateStart?: Date;
  dateEnd?: Date;
  search: string;
  limit: 25 | 50 | 100;
  onFilterChange: (newFilters: {
    filter?: "all" | "paid";
    dateStart?: Date;
    dateEnd?: Date;
    search?: string;
    limit?: 25 | 50 | 100;
  }) => void;
  onClear: () => void;
}

export function TransactionFilters({
  filter,
  dateStart,
  dateEnd,
  search,
  limit,
  onFilterChange,
  onClear,
}: TransactionFiltersProps) {
  const [localDateStart, setLocalDateStart] = useState(
    dateStart ? dateStart.toISOString().split("T")[0] : "",
  );
  const [localDateEnd, setLocalDateEnd] = useState(
    dateEnd ? dateEnd.toISOString().split("T")[0] : "",
  );

  const handleDateStartChange = (value: string) => {
    setLocalDateStart(value);
    if (value) {
      const date = new Date(value);
      date.setHours(0, 0, 0, 0);
      onFilterChange({ dateStart: date });
    } else {
      onFilterChange({ dateStart: undefined });
    }
  };

  const handleDateEndChange = (value: string) => {
    setLocalDateEnd(value);
    if (value) {
      const date = new Date(value);
      date.setHours(0, 0, 0, 0);
      onFilterChange({ dateEnd: date });
    } else {
      onFilterChange({ dateEnd: undefined });
    }
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      {/* Filter Row 1: Status */}
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <Label htmlFor="filter" className="mb-2 block text-sm font-medium">
            Status
          </Label>
          <Select
            value={filter}
            onValueChange={(value) =>
              onFilterChange({ filter: value as "all" | "paid" })
            }
          >
            <SelectTrigger id="filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <Label htmlFor="limit" className="mb-2 block text-sm font-medium">
            Rows per page
          </Label>
          <Select
            value={String(limit)}
            onValueChange={(value) =>
              onFilterChange({ limit: Number(value) as 25 | 50 | 100 })
            }
          >
            <SelectTrigger id="limit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          onClick={onClear}
          className="whitespace-nowrap"
        >
          Clear Filters
        </Button>
      </div>

      {/* Filter Row 2: Date Range */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="dateStart" className="mb-2 block text-sm font-medium">
            Start Date
          </Label>
          <Input
            id="dateStart"
            type="date"
            value={localDateStart}
            onChange={(e) => handleDateStartChange(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="dateEnd" className="mb-2 block text-sm font-medium">
            End Date
          </Label>
          <Input
            id="dateEnd"
            type="date"
            value={localDateEnd}
            onChange={(e) => handleDateEndChange(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="search" className="mb-2 block text-sm font-medium">
            Search by email or name
          </Label>
          <Input
            id="search"
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            className="w-full"
          />
        </div>
      </div>

      {/* Note */}
      <p className="text-xs text-muted-foreground">
        Search is a single-field search; searches email OR name
      </p>
    </div>
  );
}
