import Link from "next/link";

export default function PaymentSuccess() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
            <img
                src="/payment-success.png"
                alt="Payment Success"
                className="w-full max-w-md mx-auto mb-6"
            />
            <h1 className="text-3xl font-bold mb-4 text-center">Payment Success!</h1>
            <p className="text-gray-400 text-center mb-8">Your queue skip has been sent to your inbox.</p>
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
    )
}
