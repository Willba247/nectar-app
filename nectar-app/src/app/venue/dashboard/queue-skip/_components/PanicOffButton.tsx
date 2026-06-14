"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

const PanicConfirmDialog = dynamic(
  () => import("./PanicConfirmDialog").then((mod) => mod.PanicConfirmDialog),
  { ssr: false },
);

interface PanicOffButtonProps {
  enabled: boolean;
}

export function PanicOffButton({ enabled }: PanicOffButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Emergency Controls</h3>
          <p className="text-sm text-muted-foreground">
            {enabled
              ? "Queue skip purchases are currently ENABLED"
              : "Queue skip purchases are currently DISABLED"}
          </p>
        </div>

        <Button
          variant={enabled ? "destructive" : "default"}
          size="lg"
          className={enabled ? "" : "bg-green-600 hover:bg-green-700"}
          onClick={() => setShowConfirm(true)}
        >
          {enabled ? "🛑 Disable Queue Skip" : "✅ Enable Queue Skip"}
        </Button>
      </div>

      {showConfirm && (
        <PanicConfirmDialog
          currentState={enabled}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
