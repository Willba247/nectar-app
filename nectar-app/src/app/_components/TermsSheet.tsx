import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export default function TermsDialog() {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="link" className="text-[#0DD2B6] hover:underline p-0 h-auto">
                    Terms and Conditions
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] bg-gray-900 text-white border-gray-800 px-2">
                <SheetHeader>
                    <SheetTitle className="text-2xl font-bold text-white">Terms and Conditions</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 text-sm text-gray-300 overflow-y-auto pr-4">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">1. Queue Skip Service</h3>
                        <p>By purchasing a queue skip, you agree to the following terms:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Queue skips are non-refundable once used</li>
                            <li>Queue skips are valid for single use only</li>
                            <li>Venue staff reserve the right to refuse entry at their discretion</li>
                            <li>Queue skips do not guarantee immediate entry during peak times</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">2. User Responsibilities</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>You must provide accurate personal information</li>
                            <li>You must be of legal age to enter the venue</li>
                            <li>You must comply with venue dress code and entry requirements</li>
                            <li>You must present valid ID when requested</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">3. Venue Policies</h3>
                        <p>Each venue maintains its own policies regarding:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Dress code requirements</li>
                            <li>Age restrictions</li>
                            <li>Entry requirements</li>
                            <li>Behavioral expectations</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">4. Liability</h3>
                        <p>We are not responsible for:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Venue capacity issues</li>
                            <li>Venue closures or cancellations</li>
                            <li>Personal injury or property damage</li>
                            <li>Any disputes with venue staff</li>
                        </ul>
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
} 