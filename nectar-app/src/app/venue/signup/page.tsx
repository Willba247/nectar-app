"use client";

import { useState, useEffect, useRef, useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import gsap from "gsap";
import { venueSignupAction, type SignupState } from "./actions";
import { Button } from "@/components/ui/button";
import { AuthShell } from "../_components/AuthShell";
import { FloatingField } from "../_components/FloatingField";
import { useMotionSafe } from "../_components/useMotionSafe";

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

  const stepScope = useRef<HTMLDivElement>(null);
  const { allowMotion } = useMotionSafe();

  useEffect(() => {
    if (!allowMotion || !stepScope.current) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-step-anim]", {
        x: step === 2 ? 24 : -24,
        opacity: 0,
        duration: 0.4,
        stagger: 0.05,
        ease: "power3.out",
      });
    }, stepScope);
    return () => ctx.revert();
  }, [step, allowMotion]);

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

  // Success: email confirmation required.
  if (state?.message) {
    return (
      <AuthShell mode="signup" title="Almost there!" showTabs={false}>
        <p className="text-[15px] leading-relaxed text-[#0DD2B6]">
          {state.message}
        </p>
        <Link
          href="/venue/login"
          className="mt-6 inline-block text-sm text-[#4169E1] underline hover:text-[#FF69B4]"
        >
          Back to login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      mode="signup"
      title="Create venue account"
      subtitle={`Step ${step} of 2`}
    >
      {(state?.error ?? clientError) && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {state?.error ?? clientError}
        </div>
      )}

      <div ref={stepScope}>
        {step === 1 ? (
          <div className="space-y-4">
            <div data-step-anim>
              <FloatingField
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div data-step-anim>
              <FloatingField
                type="password"
                label="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div data-step-anim>
              <FloatingField
                type="password"
                label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <Button
              type="button"
              onClick={handleNext}
              data-step-anim
              className="h-12 w-full rounded-lg bg-gradient-to-r from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] bg-[length:200%_100%] text-base font-semibold text-white transition-[background-position] duration-500 hover:bg-[position:100%_0]"
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
            className="space-y-4"
          >
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="password" value={password} />
            <div data-step-anim>
              <FloatingField
                name="venueName"
                label="Venue name"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div data-step-anim>
              <FloatingField
                name="streetAddress"
                label="Street address"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <div className="flex gap-3" data-step-anim>
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="h-12 flex-1 rounded-lg border-white/20 bg-transparent text-base text-white hover:bg-white/10"
              >
                Back
              </Button>
              <SubmitButton />
            </div>
          </form>
        )}
      </div>
    </AuthShell>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-12 flex-[1.4] rounded-lg bg-gradient-to-r from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] bg-[length:200%_100%] text-base font-semibold text-white transition-[background-position] duration-500 hover:bg-[position:100%_0] disabled:opacity-60"
    >
      {pending ? "Creating..." : "Create Account"}
    </Button>
  );
}
