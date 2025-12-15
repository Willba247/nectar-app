export default function InfoLines({ queueSkips, price, isOpen, nextAvailableQueueSkip }: {
    queueSkips: number,
    price: number,
    isOpen: boolean,
    nextAvailableQueueSkip: {
        day: "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | undefined;
        next_available_time: string | undefined;
    } | null | undefined
}) {
    return (
        <div className="space-y-1 mb-4">
            {isOpen ? (
                <>
                    <p className="text-sm text-white">
                        Queue skips available: {queueSkips}
                    </p>
                    <p className="text-sm text-white">
                        Price (THIS DOES NOT INCLUDE ENTRY FEE): ${price.toFixed(2)}
                    </p>
                </>
            ) : (
                <p className="text-sm font-medium text-white bg-gray-700/80 px-6 py-4 rounded-lg shadow-lg backdrop-blur-sm">
                    {nextAvailableQueueSkip ? `Unavailable until ${nextAvailableQueueSkip.day} ${nextAvailableQueueSkip.next_available_time}` : "Unavailable for now"}
                </p>
            )}
        </div>
    )
}
