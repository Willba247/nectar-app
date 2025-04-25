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

                    <div className="bg-gray-800 p-4 rounded-lg mb-4">
                        <p className="font-semibold text-white mb-2">Important Notice:</p>
                        <p>As per our Terms and Conditions, purchasing a Skip Line Pass does not guarantee entry. Each Venue reserves the right to refuse or remove patrons under Victorian law and its policies (e.g., dress code, intoxication, etc.). No refunds will be provided if entry is denied. By purchasing a Skip Line Pass, you acknowledge and accept these conditions.</p>
                    </div>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">1. Acceptance of Terms</h3>
                        <p>By accessing or using Nectar's online platform ("Platform"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not accept these Terms, you must not use the Platform.</p>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">2. Nature of Service</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Nectar provides a service that allows users to pay an additional fee to skip the queue at participating venues, including but not limited to nightclubs ("Venues").</li>
                            <li>Nectar does not guarantee admission to any Venue. Skipping the queue does not override a Venue's legal and operational rights or policies.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">3. Venue Admission</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Each Venue reserves the right to refuse entry or remove patrons in accordance with Victorian law and its own policies (e.g., dress code, intoxication, capacity limits, responsible service of alcohol, or safety concerns).</li>
                            <li>If you are refused entry by a Venue, you acknowledge that you will not receive a refund for any fees paid through Nectar.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">4. Payment and Refunds</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Fees paid to skip the queue are non-refundable, including where a Venue denies entry.</li>
                            <li>You accept all risk associated with the possibility of being denied entry after payment, to the fullest extent permitted by Australian law.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">5. Compliance with Laws and Venue Policies</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>You agree to comply with all applicable laws, including Victorian liquor licensing and health and safety regulations.</li>
                            <li>You must follow all Venue policies, including age and identification requirements.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">6. Limitation of Liability</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>To the extent permitted by law, Nectar will not be liable for any losses, damages, or claims arising out of your use of the Platform or any Venue's refusal of entry.</li>
                            <li>Nothing in these Terms excludes, restricts, or modifies any consumer guarantee or other right under the Australian Consumer Law or any other applicable law that cannot lawfully be excluded.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">7. Privacy</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Nectar may collect personal information necessary to provide its services.</li>
                            <li>By using the Platform, you consent to the collection, use, and disclosure of your personal information in accordance with Nectar's Privacy Policy.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">8. Changes to Terms</h3>
                        <p>Nectar may amend these Terms from time to time. Continued use of the Platform after any such amendment constitutes your acceptance of the updated Terms.</p>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">9. Governing Law</h3>
                        <p>These Terms are governed by and construed in accordance with the laws of Victoria, Australia. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of Victoria, Australia.</p>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-semibold text-white">Contact Us</h3>
                        <p>If you have any questions or concerns about these Terms, please contact Nectar at: wabraham@thenectarapp.com</p>
                    </section>

                    <p className="mt-4">By using the Platform, you acknowledge that you have read, understood, and agree to abide by these Terms and Conditions.</p>
                </div>
            </SheetContent>
        </Sheet>
    );
} 