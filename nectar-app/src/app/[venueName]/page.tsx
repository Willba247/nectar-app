'use client'
import Link from 'next/link';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { api } from '@/trpc/react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { useState } from 'react';
import TermsDialog from '@/components/TermsDialog';
import { useAvailableQueueSkips } from '../hooks/getAvailableQSkips';


export default function VenuePage({ params }: { params: Promise<{ venueName: string }> }) {
    const unwrappedParams = use(params);
    const venueName = unwrappedParams.venueName;
    const { data: venue, isLoading } = api.venue.getVenueById.useQuery({ venueId: venueName });
    const queueSkips = useAvailableQueueSkips(venue);
    const router = useRouter();

    const createCheckoutSession = api.stripe.createCheckoutSession.useMutation();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        sex: '',
        termsAccepted: false,
    });

    const [isLoadingButton, setIsLoadingButton] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoadingButton(true);

        try {
            if (!venue?.price) return;
            const { url, success } = await createCheckoutSession.mutateAsync({
                venueId: venue.id,
                price: venue.price,
                customerData: formData,
                venueName: venue.name,
            });

            if (success && url) {
                router.push(url);
            }
        } catch (error) {
            console.error('Error:', error);
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
                        <div className="w-full h-full bg-gray-800 animate-pulse"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                    </div>

                    {/* Back button skeleton */}
                    <div className="absolute top-4 left-4">
                        <div className="w-10 h-10 rounded-full bg-gray-800 animate-pulse"></div>
                    </div>

                    {/* Venue name skeleton */}
                    <div className="absolute bottom-4 left-4">
                        <div className="h-8 w-48 bg-gray-800 animate-pulse rounded"></div>
                    </div>
                </div>

                {/* Venue details skeleton */}
                <div className="px-4 py-6 max-w-3xl mx-auto">
                    <div className="mb-6">
                        <div className="h-4 w-full bg-gray-800 animate-pulse rounded mb-4"></div>
                        <div className="h-4 w-3/4 bg-gray-800 animate-pulse rounded mb-4"></div>
                        <div className="h-4 w-1/2 bg-gray-800 animate-pulse rounded"></div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-gray-800 p-4 rounded-lg">
                                <div className="h-4 w-24 bg-gray-700 animate-pulse rounded mb-2"></div>
                                <div className="h-8 w-16 bg-gray-700 animate-pulse rounded"></div>
                            </div>
                            <div className="bg-gray-800 p-4 rounded-lg">
                                <div className="h-4 w-16 bg-gray-700 animate-pulse rounded mb-2"></div>
                                <div className="h-8 w-16 bg-gray-700 animate-pulse rounded"></div>
                            </div>
                        </div>
                    </div>

                    {/* Form section skeleton */}
                    <div className="bg-gray-900 p-4 rounded-lg mb-8">
                        <div className="h-6 w-32 bg-gray-800 animate-pulse rounded mb-4"></div>

                        <div className="space-y-4">
                            <div>
                                <div className="h-4 w-16 bg-gray-800 animate-pulse rounded mb-2"></div>
                                <div className="h-10 w-full bg-gray-800 animate-pulse rounded"></div>
                            </div>
                            <div>
                                <div className="h-4 w-24 bg-gray-800 animate-pulse rounded mb-2"></div>
                                <div className="h-10 w-full bg-gray-800 animate-pulse rounded"></div>
                            </div>
                            <div>
                                <div className="h-4 w-12 bg-gray-800 animate-pulse rounded mb-2"></div>
                                <div className="h-10 w-full bg-gray-800 animate-pulse rounded"></div>
                            </div>
                            <div className="h-12 w-full bg-gray-800 animate-pulse rounded"></div>
                        </div>
                    </div>
                </div>
            </main>
        );
    }
    if (!venue) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
                <img
                    src="/venue-not-found.png"
                    alt="Venue not found"
                    className="w-full max-w-md mx-auto mb-6"
                />
                <h1 className="text-3xl font-bold mb-4 text-center">Oops, no venue found</h1>
                <p className="text-gray-400 text-center mb-8">We couldn&apos;t find the venue you&apos;re looking for.</p>
                <Link
                    href="/"
                    className="px-6 py-3 bg-[#0DD2B6] text-white rounded-md hover:bg-[#0DD2B6]/80 transition-colors font-bold flex items-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7m-14 0l2 2m0 0l7 7 7-7" />
                    </svg>
                    Back to Home
                </Link>
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
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                </div>

                {/* Back button */}
                <div className="absolute top-4 left-4">
                    <Link href="/" className="flex items-center text-white p-2 rounded-full bg-black/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                </div>

                {/* Venue name */}
                <h1 className="absolute bottom-4 left-4 text-3xl sm:text-4xl font-bold">{venue?.name}</h1>
            </div>

            {/* Venue details */}
            <div className="px-4 py-6 max-w-3xl mx-auto">
                <div className="mb-6">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-800 p-4 rounded-lg">
                            <p className="text-sm text-gray-400">Queue skips available</p>
                            <p className="text-2xl font-bold">{queueSkips}</p>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-lg">
                            <p className="text-sm text-gray-400">Price</p>
                            <p className="text-2xl font-bold">${venue?.price}</p>
                        </div>
                    </div>
                </div>

                {/* Form section */}
                <div className="bg-gray-900 p-4 rounded-lg mb-8">
                    <h2 className="text-xl font-bold mb-4">Skip The Queue</h2>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <div className="flex items-center gap-2">
                                <label className="block text-sm mb-1">Name</label>
                                <span className="text-red-500 text-sm">*</span>
                            </div>
                            <input required placeholder="Full Name" type="text" className="w-full px-3 py-2 bg-gray-800 rounded-md border border-gray-700 focus:outline-none focus:border-[#0DD2B6]" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <label className="block text-sm mb-1">Email Address</label>
                                <span className="text-red-500 text-sm">*</span>
                            </div>
                            <input required placeholder="Email" type="email" className="w-full px-3 py-2 bg-gray-800 rounded-md border border-gray-700 focus:outline-none focus:border-[#0DD2B6]" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <label className="block text-sm mb-1">Sex</label>
                                <span className="text-red-500 text-sm">*</span>
                            </div>
                            <Select value={formData.sex} onValueChange={(value) => setFormData({ ...formData, sex: value })}>
                                <SelectTrigger className="w-full px-3 py-2 bg-gray-800 rounded-md border border-gray-700 focus:outline-none focus:border-[#0DD2B6] text-base">
                                    <SelectValue placeholder="Select One" />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border border-gray-700 text-white">
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                    <SelectItem value="non-binary">Non-binary</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="terms"
                                checked={formData.termsAccepted}
                                onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                                className="w-4 h-4 text-[#0DD2B6] bg-gray-800 border-gray-700 rounded focus:ring-[#0DD2B6] focus:ring-offset-gray-800"
                            />
                            <label htmlFor="terms" className="text-sm text-gray-400">
                                I agree to the <TermsDialog />
                            </label>
                        </div>

                        <button
                            type="submit"
                            className={`w-full py-3 px-4 rounded-md transition-colors font-bold ${isLoadingButton || !formData.name || !formData.email || !formData.sex || !formData.termsAccepted ? 'bg-gray-500 cursor-not-allowed text-gray-400' : 'bg-[#0DD2B6] hover:bg-[#0DD2B6]/80'
                                }`}
                            disabled={isLoadingButton || !formData.name || !formData.email || !formData.sex || !formData.termsAccepted}
                        >
                            {isLoadingButton ? 'Processing...' : 'Purchase Queue Skip'}
                        </button>
                    </form>
                </div>

            </div>
        </main>
    );
}

