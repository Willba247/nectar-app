"use client";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { useState } from "react";
import TermsDialog from "@/components/TermsDialog";
import { useAvailableQueueSkips } from "../hooks/useAvailableQSkips";

export default function VenuePage({
  params,
}: {
  params: Promise<{ venueName: string }>;
}) {
  const unwrappedParams = use(params);
  const venueName = unwrappedParams.venueName;
  const { data: venue, isLoading } = api.venue.getVenueById.useQuery({
    venueId: venueName,
  });
  const { queueSkips, isOpen, nextAvailableQueueSkip } =
    useAvailableQueueSkips(venue);
  const router = useRouter();

  const createCheckoutSession = api.stripe.createCheckoutSession.useMutation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    confirmEmail: "",
    sex: "",
    termsAccepted: false,
    receivePromo: true,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isLoadingButton, setIsLoadingButton] = useState(false);
  const disabled =
    isLoadingButton ||
    !formData.name ||
    !formData.email ||
    !formData.sex ||
    !formData.termsAccepted ||
    formData.email !== formData.confirmEmail;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingButton(true);
    setErrorMessage(null);

    try {
      if (!venue?.price) return;
      const { url, success } = await createCheckoutSession.mutateAsync({
        venueId: venue.id,
        price: venue.price,
        timeZone: venue.time_zone, // Pass timezone for accurate slot calculation
        customerData: formData,
        venueName: venue.name,
      });

      if (success && url) {
        router.push(url);
      }
    } catch (error) {
      console.error("Error:", error);

      // Handle sold out error
      if (error && typeof error === "object" && "data" in error) {
        const errorData = error.data as { code?: string };
        if (errorData.code === "CONFLICT") {
          const errorMessage =
            error && typeof error === "object" && "message" in error
              ? String(error.message)
              : "All queue skips for this time period are sold out. Please try again in a few minutes.";
          setErrorMessage(errorMessage);
        } else {
          setErrorMessage(
            "An error occurred while processing your request. Please try again.",
          );
        }
      } else {
        setErrorMessage(
          "An error occurred while processing your request. Please try again.",
        );
      }
    } finally {
      setIsLoadingButton(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-black text-white">
        {/* Header skeleton */}
        <div className="relative">
          <div className="relative h-64 sm:h-80 md:h-96">
            <div className="h-full w-full animate-pulse bg-gray-800"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
          </div>

          {/* Back button skeleton */}
          <div className="absolute top-4 left-4">
            <div className="h-10 w-10 animate-pulse rounded-full bg-gray-800"></div>
          </div>

          {/* Venue name skeleton */}
          <div className="absolute bottom-4 left-4">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-800"></div>
          </div>
        </div>

        {/* Venue details skeleton */}
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="mb-6">
            <div className="mb-4 h-4 w-full animate-pulse rounded bg-gray-800"></div>
            <div className="mb-4 h-4 w-3/4 animate-pulse rounded bg-gray-800"></div>
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-800"></div>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-800 p-4">
                <div className="mb-2 h-4 w-24 animate-pulse rounded bg-gray-700"></div>
                <div className="h-8 w-16 animate-pulse rounded bg-gray-700"></div>
              </div>
              <div className="rounded-lg bg-gray-800 p-4">
                <div className="mb-2 h-4 w-16 animate-pulse rounded bg-gray-700"></div>
                <div className="h-8 w-16 animate-pulse rounded bg-gray-700"></div>
              </div>
            </div>
          </div>

          {/* Form section skeleton */}
          <div className="mb-8 rounded-lg bg-gray-900 p-4">
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-gray-800"></div>

            <div className="space-y-4">
              <div>
                <div className="mb-2 h-4 w-16 animate-pulse rounded bg-gray-800"></div>
                <div className="h-10 w-full animate-pulse rounded bg-gray-800"></div>
              </div>
              <div>
                <div className="mb-2 h-4 w-24 animate-pulse rounded bg-gray-800"></div>
                <div className="h-10 w-full animate-pulse rounded bg-gray-800"></div>
              </div>
              <div>
                <div className="mb-2 h-4 w-12 animate-pulse rounded bg-gray-800"></div>
                <div className="h-10 w-full animate-pulse rounded bg-gray-800"></div>
              </div>
              <div className="h-12 w-full animate-pulse rounded bg-gray-800"></div>
            </div>
          </div>
        </div>
      </main>
    );
  }
  if (!venue) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-white">
        <img
          src="/venue-not-found.png"
          alt="Venue not found"
          className="mx-auto mb-6 w-full max-w-md"
        />
        <h1 className="mb-4 text-center text-3xl font-bold">
          Oops, no venue found
        </h1>
        <p className="mb-8 text-center text-gray-400">
          We couldn&apos;t find the venue you&apos;re looking for.
        </p>
        <Link
          href="/"
          className="flex items-center rounded-md bg-[#0DD2B6] px-6 py-3 font-bold text-white transition-colors hover:bg-[#0DD2B6]/80"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-2 h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7m-14 0l2 2m0 0l7 7 7-7"
            />
          </svg>
          Back to Home
        </Link>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black p-4 text-white">
        <>
          <img
            src="/nectar-logo.png"
            alt="Nectar Logo"
            className="mb-8 h-auto w-32"
          />
          <h1 className="mb-6 max-w-2xl text-center text-4xl font-bold">
            Queue Skips for{" "}
            <span className="text-[#0DD2B6]">{venue?.name}</span> are currently
            unavailable
          </h1>
          <div className="flex flex-col items-center space-y-8">
            <p className="rounded-xl border border-gray-700/50 bg-gray-800/80 px-8 py-5 text-base font-medium text-white shadow-lg backdrop-blur-sm">
              {nextAvailableQueueSkip ? (
                <>
                  <span className="mb-1 block text-gray-400">
                    Next available queue skip:
                  </span>
                  <span className="text-xl font-semibold text-[#0DD2B6]">
                    {nextAvailableQueueSkip.day}{" "}
                    {nextAvailableQueueSkip.next_available_time}
                  </span>
                </>
              ) : (
                "Unavailable for now"
              )}
            </p>
            <Link
              href="/"
              className="group flex items-center rounded-xl bg-[#0DD2B6] px-8 py-4 font-bold text-white shadow-lg transition-all duration-300 hover:bg-[#0DD2B6]/80 hover:shadow-[#0DD2B6]/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mr-2 h-5 w-5 transform transition-transform duration-300 group-hover:-translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Home
            </Link>
          </div>
        </>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header with back button */}
      <div className="relative">
        {/* Full-width image with overlay */}
        <div className="relative h-64 sm:h-80 md:h-96">
          <img
            src={venue?.image_url}
            alt={venue?.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
        </div>

        {/* Back button */}
        <div className="absolute top-4 left-4">
          <Link
            href="/"
            className="flex items-center rounded-full bg-black/50 p-2 text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
        </div>

        {/* Venue name */}
        <h1 className="absolute bottom-4 left-4 text-3xl font-bold sm:text-4xl">
          {venue?.name}
        </h1>
      </div>

      {/* Venue details */}
      <div className="mx-auto max-w-3xl px-4 pb-6">
        <div className="mb-6">
          <p className="py-2">
            Purchase a pass to skip the line tonight, passes delivered instantly
            via email, show the pass at the VIP Entrance
          </p>
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-800 p-4">
              <p className="text-sm text-gray-400">Queue skips available</p>
              <p className="text-2xl font-bold">{queueSkips}</p>
            </div>
            <div className="rounded-lg bg-gray-800 p-4">
              <p className="text-sm text-gray-400">
                Price (this DOES NOT include entry fee)
              </p>
              <p className="text-2xl font-bold">${venue?.price}</p>
            </div>
          </div>
        </div>

        {/* Form section */}
        <div className="mb-8 rounded-lg bg-gray-900 p-4">
          <h2 className="mb-4 text-xl font-bold">Skip The Queue</h2>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <div className="flex items-center gap-2">
                <label className="mb-1 block text-sm">Name</label>
                <span className="text-sm text-red-500">*</span>
              </div>
              <input
                required
                placeholder="Full Name"
                type="text"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 focus:border-[#0DD2B6] focus:outline-none"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <label className="mb-1 block text-sm">Email Address</label>
                <span className="text-sm text-red-500">*</span>
              </div>
              <input
                required
                placeholder="Email"
                type="email"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 focus:border-[#0DD2B6] focus:outline-none"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <label className="mb-1 block text-sm">
                  Confirm Email Address
                </label>
                <span className="text-sm text-red-500">*</span>
              </div>
              {formData.email !== formData.confirmEmail && (
                <div className="text-sm text-red-500">Emails do not match</div>
              )}
              <input
                required
                placeholder="Confirm Email"
                type="email"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 focus:border-[#0DD2B6] focus:outline-none"
                value={formData.confirmEmail}
                onChange={(e) =>
                  setFormData({ ...formData, confirmEmail: e.target.value })
                }
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <label className="mb-1 block text-sm">Sex</label>
                <span className="text-sm text-red-500">*</span>
              </div>
              <Select
                value={formData.sex}
                onValueChange={(value) =>
                  setFormData({ ...formData, sex: value })
                }
              >
                <SelectTrigger className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-base focus:border-[#0DD2B6] focus:outline-none">
                  <SelectValue placeholder="Select One" />
                </SelectTrigger>
                <SelectContent className="border border-gray-700 bg-gray-800 text-white">
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="non-binary">Non-binary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="receivePromo"
                checked={formData.receivePromo}
                onChange={(e) =>
                  setFormData({ ...formData, receivePromo: e.target.checked })
                }
              />
              <label htmlFor="receivePromo" className="text-sm text-gray-400">
                I consent to receiving promotional emails from {venue?.name}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="terms"
                checked={formData.termsAccepted}
                onChange={(e) =>
                  setFormData({ ...formData, termsAccepted: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-[#0DD2B6] focus:ring-[#0DD2B6] focus:ring-offset-gray-800"
              />
              <label htmlFor="terms" className="text-sm text-gray-400">
                I agree to the <TermsDialog />
              </label>
            </div>

            {errorMessage && (
              <div className="rounded-md border border-red-500 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              className={`w-full rounded-md px-4 py-3 font-bold transition-colors ${
                disabled
                  ? "cursor-not-allowed bg-gray-500 text-gray-400"
                  : "bg-[#0DD2B6] hover:bg-[#0DD2B6]/80"
              }`}
              disabled={disabled}
            >
              {isLoadingButton ? "Processing..." : "Purchase Queue Skip"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
