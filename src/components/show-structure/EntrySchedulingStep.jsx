import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export const EntrySchedulingStep = ({ formData, setFormData }) => {
    const handleDetailChange = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            showDetails: {
                ...prev.showDetails,
                [section]: {
                    ...(prev.showDetails[section] || {}),
                    [field]: value
                }
            }
        }));
    };

    const renderTextarea = (section, field, label, placeholder) => (
        <div className="space-y-2">
            <Label htmlFor={`${section}-${field}`}>{label}</Label>
            <Textarea 
                id={`${section}-${field}`}
                value={formData.showDetails?.[section]?.[field] || ''} 
                onChange={e => handleDetailChange(section, field, e.target.value)} 
                placeholder={placeholder}
            />
        </div>
    );

    return (
        <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>Step 6: General Information</CardTitle>
                <CardDescription>Exhibitor requirements, entry policies, health & safety, scheduling notes, and special events. This information can be shared on the website and with exhibitors.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="p-4 border rounded-lg bg-background/50">
                    <h4 className="font-semibold text-lg mb-3">Membership & Eligibility</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderTextarea('membership', 'exhibitorReqs', 'Exhibitor Requirements', 'e.g., Must be current member of AQHA...')}
                        {renderTextarea('membership', 'horseReqs', 'Horse Requirements', 'e.g., Must have registration papers...')}
                        {renderTextarea('membership', 'dualApprovedNote', 'Dual-Approved Classes Note', 'e.g., One ride, two credits. How entries/fees work...')}
                        {renderTextarea('membership', 'healthPaperwork', 'Equine Health Paperwork', 'Coggins, health certificate requirements...')}
                    </div>
                </div>

                <div className="p-4 border rounded-lg bg-background/50">
                    <h4 className="font-semibold text-lg mb-3">Entry Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderTextarea('entry', 'deadlines', 'Entry Deadline(s)', 'Pre-entry vs post-entry dates and cut-offs...')}
                        {renderTextarea('entry', 'scratchPolicy', 'Scratch Policy / Refund Policy', 'e.g., No refunds after closing date...')}
                        {renderTextarea('entry', 'paymentMethods', 'Payment Methods', 'Cash, check, credit card (with % fee)...')}
                    </div>
                </div>

                <div className="p-4 border rounded-lg bg-background/50">
                    <h4 className="font-semibold text-lg mb-3">Show Office & Admin</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderTextarea('officeAdmin', 'officeHours', 'Office Hours', 'e.g., 7am - 5pm daily')}
                        {renderTextarea('officeAdmin', 'officeLocation', 'Office Location', 'e.g., North end of main barn')}
                        {renderTextarea('officeAdmin', 'checkInReqs', 'Check-in Requirements', 'Exhibitor packet, back numbers, stall assignments...')}
                        {renderTextarea('officeAdmin', 'patternsDist', 'Patterns Distribution', 'Posted online, via QR code, office copies...')}
                        {renderTextarea('officeAdmin', 'resultsPosting', 'Results Posting', 'Where, how often, NSBA/breed reporting timelines...')}
                    </div>
                </div>

                 <div className="p-4 border rounded-lg bg-background/50">
                    <h4 className="font-semibold text-lg mb-3">Scheduling Notes</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderTextarea('scheduling', 'startTimes', 'Daily Start Times', 'e.g., 8:00 AM daily...')}
                        {renderTextarea('scheduling', 'orderOfGo', 'Order of Go / Working Orders', 'e.g., Posted one hour before class starts...')}
                        {renderTextarea('scheduling', 'dragTimes', 'Drag Times / Breaks', 'e.g., After every 5 classes...')}
                        {renderTextarea('scheduling', 'concurrentNotes', 'Concurrent Class Notes', 'Dual-approved or dual-group classes info...')}
                        {renderTextarea('scheduling', 'quietHours', 'Quiet Hours', 'e.g., 10 PM to 6 AM')}
                    </div>
                </div>

                <div className="p-4 border rounded-lg bg-background/50">
                    <h4 className="font-semibold text-lg mb-3">Health, Safety & Legal</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderTextarea('healthSafety', 'healthReqs', 'Equine Health Requirements', 'Negative Coggins, vaccinations, vet inspection...')}
                        {renderTextarea('healthSafety', 'emergencyContacts', 'Emergency Contacts', 'Vet on call, farrier, EMT, show office phone...')}
                        {renderTextarea('healthSafety', 'liability', 'Liability Release Statement', 'Standard assumption of risk language...')}
                        {renderTextarea('healthSafety', 'insurance', 'Insurance Requirements', 'If breed or venue requires...')}
                        {renderTextarea('healthSafety', 'facilityRules', 'Facility Rules', 'No dogs off leash, golf cart restrictions, smoking policy...')}
                    </div>
                </div>

                <div className="p-4 border rounded-lg bg-background/50">
                    <h4 className="font-semibold text-lg mb-3">Special Events</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderTextarea('specialEvents', 'clinics', 'Clinics / Schooling Sessions', 'Details, times, costs...')}
                        {renderTextarea('specialEvents', 'socialEvents', 'Exhibitor Party / Social Events', 'Date, time, location...')}
                        {renderTextarea('specialEvents', 'meetings', 'Youth / Amateur Meetings', 'Details...')}
                        {renderTextarea('specialEvents', 'fundraisers', 'Silent Auctions / Fundraisers', 'Details...')}
                        {renderTextarea('specialEvents', 'banquets', 'Banquets / Awards Dinners', 'Details...')}
                    </div>
                </div>
            </CardContent>
        </motion.div>
    );
};