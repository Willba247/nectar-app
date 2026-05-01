"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import toast from "react-hot-toast";

type PayoutPeriod = "weekly" | "fortnightly" | "monthly";

function formatBsb(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function PayoutSettingsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [payoutPeriod, setPayoutPeriod] = useState<PayoutPeriod>("monthly");
  const [accountName, setAccountName] = useState("");
  const [bsb, setBsb] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const { data: settings, isLoading } =
    api.venueManager.getPayoutSettings.useQuery(undefined, {
      enabled: isExpanded,
    });

  // Populate form once data arrives — runs once per open, avoids useEffect loop
  if (settings !== undefined && !hydrated) {
    setPayoutPeriod((settings?.payoutPeriod as PayoutPeriod) ?? "monthly");
    setAccountName(settings?.accountName ?? "");
    setBsb(settings?.bsb ?? "");
    setAccountNumber(settings?.accountNumber ?? "");
    setHydrated(true);
  }

  const utils = api.useUtils();
  const updateSettings = api.venueManager.updatePayoutSettings.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.isFirstTimeSetup
          ? "Payout settings saved. The Nectar team has been notified."
          : "Payout settings updated.",
      );
      void utils.venueManager.getPayoutSettings.invalidate();
    },
    onError: (err) => toast.error(`Failed to save: ${err.message}`),
  });

  const bsbValid = /^\d{3}-\d{3}$/.test(bsb);
  const accountNumberValid = /^\d{6,10}$/.test(accountNumber);
  const formValid =
    accountName.trim().length > 0 && bsbValid && accountNumberValid;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => {
          setIsExpanded((prev) => !prev);
          if (isExpanded) setHydrated(false);
        }}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Payout Settings
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {isExpanded ? "▲ Hide" : "▼ Show"}
          </span>
        </div>
        {!isExpanded && settings && (
          <p className="mt-1 text-xs text-muted-foreground">
            {settings.payoutPeriod.charAt(0).toUpperCase() +
              settings.payoutPeriod.slice(1)}
            {" · BSB "}
            {settings.bsb}
            {" · "}
            {settings.accountName}
          </p>
        )}
        {!isExpanded && !settings && !isLoading && (
          <p className="mt-1 text-xs text-amber-600">Not yet configured</p>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-9 animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="payoutPeriod">Payout Period</Label>
                <Select
                  value={payoutPeriod}
                  onValueChange={(v) => setPayoutPeriod(v as PayoutPeriod)}
                >
                  <SelectTrigger className="mt-1.5" id="payoutPeriod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="accountName">Account Name</Label>
                <Input
                  id="accountName"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Venue Pty Ltd"
                  className="mt-1.5"
                  maxLength={255}
                />
              </div>

              <div>
                <Label htmlFor="bsb">BSB</Label>
                <Input
                  id="bsb"
                  value={bsb}
                  onChange={(e) => setBsb(formatBsb(e.target.value))}
                  placeholder="062-000"
                  className="mt-1.5"
                  maxLength={7}
                />
                {bsb.length > 0 && !bsbValid && (
                  <p className="mt-1 text-xs text-red-500">
                    BSB must be in the format XXX-XXX
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={accountNumber}
                  onChange={(e) =>
                    setAccountNumber(
                      e.target.value.replace(/\D/g, "").slice(0, 10),
                    )
                  }
                  placeholder="12345678"
                  className="mt-1.5"
                  inputMode="numeric"
                />
                {accountNumber.length > 0 && !accountNumberValid && (
                  <p className="mt-1 text-xs text-red-500">
                    Account number must be 6–10 digits
                  </p>
                )}
              </div>

              <Button
                onClick={() =>
                  updateSettings.mutate({
                    payoutPeriod,
                    accountName: accountName.trim(),
                    bsb,
                    accountNumber,
                  })
                }
                disabled={updateSettings.isPending || !formValid}
                className="w-full"
              >
                {updateSettings.isPending
                  ? "Saving..."
                  : "Save Payout Settings"}
              </Button>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
