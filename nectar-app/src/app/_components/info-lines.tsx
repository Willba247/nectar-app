export default function InfoLines({ queueSkips, price, isOpen }: { queueSkips: number, price: number, isOpen: boolean }) {
    console.log("queueSkips", queueSkips);
    return (
        <div className="space-y-1 mb-4">
            {isOpen ? (
                <>
                    <p className="text-sm text-white">
                        Queue skips available: {queueSkips}
                    </p>
                    <p className="text-sm text-white">
                        Price: ${price.toFixed(2)}
                    </p>
                </>
            ) : (
                <p className="text-sm text-gray-900 bg-gray-300 p-4 rounded-md">
                    Unavailable until the next hour
                </p>
            )}
        </div>
    )
}
