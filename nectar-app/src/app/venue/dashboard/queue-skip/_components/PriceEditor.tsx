"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PriceEditorProps {
  currentPrice: string;
}

export function PriceEditor({ currentPrice }: PriceEditorProps) {
  const [price, setPrice] = useState(currentPrice);
  const [error, setError] = useState<string | null>(null);
  const utils = api.useUtils();

  const mutation = api.venueManager.updateQueueSkipPrice.useMutation({
    onSuccess: () => {
      setError(null);
      utils.venueManager.getQueueSkipConfig.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const handleSave = () => {
    const num = parseFloat(price);
    if (isNaN(num) || num < 0 || num > 999.99) {
      setError("Price must be between $0 and $999.99");
      return;
    }
    mutation.mutate({ price: num.toFixed(2) });
  };

  const hasChanged = price !== currentPrice;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue Skip Price</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-medium">$</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="999.99"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setError(null);
            }}
            className="w-32"
            placeholder="0.00"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {mutation.isSuccess && (
          <p className="text-sm text-green-600">Price updated successfully!</p>
        )}
        <Button
          onClick={handleSave}
          disabled={mutation.isPending || !hasChanged}
        >
          {mutation.isPending ? "Saving..." : "Save Price"}
        </Button>
      </CardContent>
    </Card>
  );
}
