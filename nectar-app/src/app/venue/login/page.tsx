"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { venueLoginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { AuthShell } from "../_components/AuthShell";
import { FloatingField } from "../_components/FloatingField";

export default function VenueLoginPage() {
  const [state, formAction] = useActionState(venueLoginAction, { error: "" });

  return (
    <AuthShell
      mode="login"
      title="Welcome back"
      subtitle="Sign in to your venue dashboard."
    >
      <form action={formAction} className="space-y-4" autoComplete="off">
        <FloatingField
          type="email"
          name="email"
          label="Email"
          required
          autoComplete="username"
        />
        <FloatingField
          type="password"
          name="password"
          label="Password"
          required
          autoComplete="new-password"
        />
        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        <SubmitButton />
      </form>
    </AuthShell>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="mt-2 h-12 w-full rounded-lg bg-gradient-to-r from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] bg-[length:200%_100%] text-base font-semibold text-white transition-[background-position] duration-500 hover:bg-[position:100%_0] disabled:opacity-60"
    >
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}
