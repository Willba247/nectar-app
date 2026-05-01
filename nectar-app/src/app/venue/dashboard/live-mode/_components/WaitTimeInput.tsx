"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";

interface WaitTimeInputProps {
  onSuccess: () => void;
}

const QUICK_INCREMENTS = [-5, 5, 10, 15] as const;

export function WaitTimeInput({ onSuccess }: WaitTimeInputProps) {
  const [waitTime, setWaitTime] = useState(0);

  const mutation = api.venueManager.submitDemandSignal.useMutation({
    onSuccess,
  });

  const clamp = (val: number) => Math.min(999, Math.max(0, val));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWaitTime(clamp(parseInt(e.target.value, 10) || 0));
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="mb-2 text-sm font-semibold text-slate-700">
        How long is the queue right now?
      </p>

      <div className="mb-3 flex items-center gap-3">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={999}
          value={waitTime}
          onChange={handleChange}
          className="w-full rounded-xl border-2 border-indigo-500 bg-slate-50 py-3 text-center text-3xl font-bold text-slate-900 focus:outline-none"
        />
        <span className="whitespace-nowrap text-sm font-semibold text-slate-700">
          min wait
        </span>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {QUICK_INCREMENTS.map((delta) => (
          <button
            key={delta}
            type="button"
            onClick={() => setWaitTime((prev) => clamp(prev + delta))}
            className="rounded-lg bg-slate-100 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 active:bg-slate-300"
          >
            {delta > 0 ? `+${delta}` : delta}
          </button>
        ))}
      </div>

      {mutation.error && (
        <p className="mb-2 text-sm text-red-600">{mutation.error.message}</p>
      )}

      <Button
        className="w-full py-5 text-base font-bold"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ waitTimeMinutes: waitTime })}
      >
        {mutation.isPending ? "Updating..." : "Update Price"}
      </Button>
    </div>
  );
}
