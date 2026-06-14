"use client";

import { type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FloatingFieldProps = { label: string } & ComponentProps<typeof Input>;

export function FloatingField({
  label,
  className,
  ...props
}: FloatingFieldProps) {
  return (
    <div className="relative">
      <Input
        {...props}
        placeholder=" "
        className={cn(
          "peer h-14 rounded-lg border-white/15 bg-white/5 px-3.5 pb-2 pt-6 text-[15px] text-white placeholder:text-transparent",
          "focus-visible:border-[#0DD2B6] focus-visible:ring-2 focus-visible:ring-[#0DD2B6]/20",
          className,
        )}
      />
      <label
        className={cn(
          "pointer-events-none absolute left-3.5 top-4 text-[15px] text-white/50 transition-all",
          "peer-focus:top-2 peer-focus:text-[10px] peer-focus:tracking-wide peer-focus:text-[#0DD2B6]",
          "peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:tracking-wide",
        )}
      >
        {label}
      </label>
    </div>
  );
}
