"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { venueLoginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function VenueLoginPage() {
  const [state, formAction] = useActionState(venueLoginAction, { error: "" });

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-[680px] rounded-xl bg-gradient-to-br from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] p-[3px]">
        <div className="rounded-xl bg-gray-900 p-12">
          <h2 className="mb-8 text-3xl font-semibold text-white">
            Venue Manager Login
          </h2>
          <form action={formAction} className="space-y-6" autoComplete="off">
            <div className="space-y-4">
              <Input
                type="email"
                name="email"
                placeholder="Email"
                required
                autoComplete="username"
                className="h-12 text-lg"
              />
              <Input
                type="password"
                name="password"
                placeholder="Password"
                required
                autoComplete="new-password"
                className="h-12 text-lg"
              />
              {state?.error && (
                <p className="text-sm text-red-500">{state.error}</p>
              )}
            </div>
            <SubmitButton />
          </form>
          <p className="mt-6 text-center text-sm text-gray-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/venue/signup"
              className="text-[#4169E1] underline hover:text-[#FF69B4]"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="h-12 w-full text-lg" disabled={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}
