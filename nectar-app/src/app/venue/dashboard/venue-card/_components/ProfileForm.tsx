"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import toast from "react-hot-toast";

// Common IANA timezone identifiers for Australian venues (+ UTC fallback)
const TIMEZONE_OPTIONS = [
  { value: "Australia/Melbourne", label: "Melbourne / Sydney (AEDT/AEST)" },
  { value: "Australia/Brisbane", label: "Brisbane (AEST, no DST)" },
  { value: "Australia/Adelaide", label: "Adelaide (ACDT/ACST)" },
  { value: "Australia/Perth", label: "Perth (AWST)" },
  { value: "Australia/Darwin", label: "Darwin (ACST, no DST)" },
  { value: "Australia/Hobart", label: "Hobart (AEDT/AEST)" },
  { value: "Pacific/Auckland", label: "Auckland (NZDT/NZST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Chicago", label: "Chicago (CT)" },
  { value: "America/Denver", label: "Denver (MT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "UTC", label: "UTC" },
];

interface ProfileFormProps {
  profile: {
    name: string;
    description: string | null;
    streetAddress: string | null;
    entryFee: string | null;
    priceDisplayMode: string | null;
    timeZone: string;
  };
  onSave: () => void;
}

export function ProfileForm({ profile, onSave }: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description ?? "");
  const [streetAddress, setStreetAddress] = useState(
    profile.streetAddress ?? "",
  );
  const [entryFee, setEntryFee] = useState(profile.entryFee ?? "");
  const [priceDisplayMode, setPriceDisplayMode] = useState(
    profile.priceDisplayMode ?? "queue_skip_only",
  );
  const [timeZone, setTimeZone] = useState(profile.timeZone);

  const updateName = api.venueManager.updateVenueName.useMutation({
    onSuccess: () => {
      toast.success("Venue name saved");
      onSave();
      router.refresh();
    },
    onError: (err) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const updateDescription = api.venueManager.updateVenueDescription.useMutation(
    {
      onSuccess: () => {
        toast.success("Description saved");
        onSave();
      },
      onError: (err) => {
        toast.error(`Failed to save: ${err.message}`);
      },
    },
  );

  const updateStreetAddress = api.venueManager.updateStreetAddress.useMutation({
    onSuccess: () => {
      toast.success("Street address saved");
      onSave();
    },
    onError: (err) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const updateTimeZone = api.venueManager.updateTimeZone.useMutation({
    onSuccess: () => {
      toast.success("Timezone saved");
      onSave();
    },
    onError: (err) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const updatePriceDisplay = api.venueManager.updatePriceDisplay.useMutation({
    onSuccess: () => {
      toast.success("Pricing settings saved");
      onSave();
    },
    onError: (err) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const handleSaveName = () => {
    updateName.mutate({ name: name.trim() });
  };

  const handleSaveDescription = () => {
    updateDescription.mutate({ description: description || null });
  };

  const handleSaveStreetAddress = () => {
    // Auto-detect the browser timezone so the venue's timezone stays in sync
    // with the manager's physical location (they're always at the venue).
    const detectedTimeZone =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined;
    updateStreetAddress.mutate({
      streetAddress: streetAddress || null,
      detectedTimeZone,
    });
  };

  const handleSaveTimeZone = () => {
    updateTimeZone.mutate({ timeZone });
  };

  const handleSavePricing = () => {
    updatePriceDisplay.mutate({
      entryFee: entryFee || null,
      priceDisplayMode: priceDisplayMode as
        | "queue_skip_only"
        | "entry_fee_only"
        | "both",
    });
  };

  return (
    <div className="space-y-6">
      {/* Venue Name Card */}
      <Card>
        <CardHeader>
          <CardTitle>Venue Name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="venueName">Name</Label>
            <Input
              id="venueName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Rooftop Bar"
              className="mt-1.5"
              maxLength={100}
            />
            <p className="text-muted-foreground mt-1 text-xs"></p>
          </div>
          <Button
            onClick={handleSaveName}
            disabled={updateName.isPending || name.trim().length === 0}
          >
            {updateName.isPending ? "Saving..." : "Save Name"}
          </Button>
        </CardContent>
      </Card>

      {/* Description Card */}
      <Card>
        <CardHeader>
          <CardTitle>Venue Description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell customers about your venue..."
              className="mt-1.5 min-h-[100px]"
              maxLength={1000}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              {description.length}/1000
            </p>
          </div>
          <Button
            onClick={handleSaveDescription}
            disabled={updateDescription.isPending}
          >
            {updateDescription.isPending ? "Saving..." : "Save Description"}
          </Button>
        </CardContent>
      </Card>

      {/* Street Address Card */}
      <Card>
        <CardHeader>
          <CardTitle>Street Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="streetAddress">Address</Label>
            <Input
              id="streetAddress"
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              placeholder="123 Example St, Melbourne VIC 3000"
              className="mt-1.5"
              maxLength={255}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Shown on your venue card so customers can find you.
            </p>
          </div>
          <Button
            onClick={handleSaveStreetAddress}
            disabled={updateStreetAddress.isPending}
          >
            {updateStreetAddress.isPending ? "Saving..." : "Save Address"}
          </Button>
        </CardContent>
      </Card>

      {/* Timezone Card */}
      <Card>
        <CardHeader>
          <CardTitle>Venue Timezone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="timeZone">Timezone</Label>
            <Select value={timeZone} onValueChange={setTimeZone}>
              <SelectTrigger className="mt-1.5" id="timeZone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground mt-1 text-xs">
              All queue skip times are evaluated in this timezone. It is set
              automatically when you save your street address — only change this
              if your venue is in a different timezone to your browser.
            </p>
          </div>
          <Button
            onClick={handleSaveTimeZone}
            disabled={updateTimeZone.isPending}
          >
            {updateTimeZone.isPending ? "Saving..." : "Save Timezone"}
          </Button>
        </CardContent>
      </Card>

      {/* Pricing Card */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Display</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="entryFee">Entry Fee ($)</Label>
            <Input
              id="entryFee"
              type="number"
              step="0.01"
              min="0"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              placeholder="0.00"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="displayMode">Display Mode</Label>
            <Select
              value={priceDisplayMode}
              onValueChange={setPriceDisplayMode}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="queue_skip_only">
                  Queue Skip Price Only
                </SelectItem>
                <SelectItem value="entry_fee_only">Entry Fee Only</SelectItem>
                <SelectItem value="both">Show Both Prices</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSavePricing}
            disabled={updatePriceDisplay.isPending}
          >
            {updatePriceDisplay.isPending
              ? "Saving..."
              : "Save Pricing Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
