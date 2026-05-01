"use client";

import { api } from "@/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PanicConfirmDialogProps {
  currentState: boolean;
  onClose: () => void;
}

export function PanicConfirmDialog({
  currentState,
  onClose,
}: PanicConfirmDialogProps) {
  const utils = api.useUtils();

  const mutation = api.venueManager.setPanicOff.useMutation({
    onSuccess: () => {
      utils.venueManager.getQueueSkipConfig.invalidate();
      onClose();
    },
  });

  const newState = !currentState;

  const handleConfirm = () => {
    mutation.mutate({ enabled: newState });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {newState ? "Enable Queue Skip?" : "Disable Queue Skip?"}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {newState ? (
            <p>
              This will <strong>re-enable</strong> queue skip purchases.
              Customers will be able to buy queue skips again.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="font-medium text-red-600">
                This will <strong>disable</strong> all new queue skip purchases
                immediately.
              </p>
              <p className="text-sm text-muted-foreground">
                Existing reservations will remain valid. This action is logged
                for auditing.
              </p>
            </div>
          )}
        </div>

        {mutation.error && (
          <p className="text-sm text-red-500">{mutation.error.message}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={newState ? "default" : "destructive"}
            onClick={handleConfirm}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Processing..." : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
