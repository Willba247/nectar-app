"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { venueSignupAction, type SignupState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function VenueSignupPage() {
  const [state, formAction] = useActionState<SignupState | undefined, FormData>(
    venueSignupAction,
    undefined,
  );
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [venueName, setVenueName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [clientError, setClientError] = useState("");

  function handleNext() {
    setClientError("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setClientError("Please enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setClientError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setClientError("Passwords do not match");
      return;
    }
    setStep(2);
  }

  function handleBack() {
    setClientError("");
    setStep(1);
  }

  function handleSubmitValidation() {
    setClientError("");
    if (!venueName.trim()) {
      setClientError("Venue name is required");
      return false;
    }
    if (!streetAddress.trim()) {
      setClientError("Street address is required");
      return false;
    }
    return true;
  }

  // Show success message if email confirmation is required
  if (state?.message) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-[680px] rounded-xl bg-gradient-to-br from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] p-[3px]">
          <div className="rounded-xl bg-gray-900 p-12 text-center">
            <h2 className="mb-4 text-3xl font-semibold text-white">
              Almost there!
            </h2>
            <p className="mb-6 text-lg text-[#0DD2B6]">{state.message}</p>
            <Link
              href="/venue/login"
              className="text-lg text-[#4169E1] underline hover:text-[#FF69B4]"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-[680px] rounded-xl bg-gradient-to-br from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] p-[3px]">
        <div className="rounded-xl bg-gray-900 p-12">
          <h2 className="mb-2 text-3xl font-semibold text-white">
            Create Venue Account
          </h2>
          <p className="mb-8 text-sm text-gray-400">Step {step} of 2</p>

          {state?.error && (
            <div className="mb-6 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {state.error}
            </div>
          )}
          {clientError && (
            <div className="mb-6 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {clientError}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12 text-lg"
                />
                <Input
                  type="password"
                  placeholder="Password (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-12 text-lg"
                />
                <Input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-12 text-lg"
                />
              </div>
              <Button
                type="button"
                onClick={handleNext}
                className="h-12 w-full text-lg"
              >
                Next
              </Button>
            </div>
          ) : (
            <form
              action={(formData) => {
                if (!handleSubmitValidation()) return;
                formAction(formData);
              }}
              className="space-y-6"
            >
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="password" value={password} />
              <div className="space-y-4">
                <Input
                  name="venueName"
                  placeholder="Venue Name"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  required
                  maxLength={100}
                  className="h-12 text-lg"
                />
                <Input
                  name="streetAddress"
                  placeholder="Street Address"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  required
                  maxLength={255}
                  className="h-12 text-lg"
                />
              </div>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="h-12 flex-1 text-lg"
                >
                  Back
                </Button>
                <SubmitButton />
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{" "}
            <Link
              href="/venue/login"
              className="text-[#4169E1] underline hover:text-[#FF69B4]"
            >
              Sign in
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
    <Button type="submit" className="h-12 flex-1 text-lg" disabled={pending}>
      {pending ? "Creating..." : "Create Account"}
    </Button>
  );
}
