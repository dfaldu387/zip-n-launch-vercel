import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, Building2, Mail, Phone, ExternalLink, FileText, Home } from 'lucide-react';
import { publicContacts, publicHotel, publicDocuments, websiteHref } from '@/lib/publicPage';

const ROLE_ICONS = { housing: Home, manager: Users, secretary: FileText };

// Same three sections, but laid out inside the Show Details box (Robert's mockup):
// contacts in columns with icons, the hotel as one row, documents as a list.
const InlineSections = ({ contacts, hotel, documents }) => (
    <>
        {contacts.length > 0 && (
            <div>
                <h3 className="font-semibold text-primary mb-2">Contact Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {contacts.map(c => {
                        const Icon = ROLE_ICONS[c.key] || Users;
                        return (
                            <div key={c.key} className="flex items-start gap-3 rounded-lg bg-background/60 p-3">
                                <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Icon className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0 space-y-0.5">
                                    <p className="text-xs font-semibold text-foreground">{c.label}</p>
                                    {c.name && <p className="text-xs text-foreground">{c.name}</p>}
                                    {c.phone && (
                                        <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                                            <Phone className="h-3 w-3" /> {c.phone}
                                        </a>
                                    )}
                                    {c.email && (
                                        <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary break-all">
                                            <Mail className="h-3 w-3" /> {c.email}
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {hotel && (
            <div>
                <h3 className="font-semibold text-primary mb-2 flex items-center gap-2"><Building2 className="h-4 w-4" /> Sponsor Hotel</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-lg bg-background/60 p-3 text-xs">
                    {hotel.name && <div><p className="text-[11px] font-medium text-primary">Hotel Name</p><p className="font-semibold text-foreground">{hotel.name}</p></div>}
                    {hotel.address && <div><p className="text-[11px] font-medium text-primary">Address</p><p className="text-foreground">{hotel.address}</p></div>}
                    {hotel.phone && (
                        <div>
                            <p className="text-[11px] font-medium text-primary">Phone</p>
                            <a href={`tel:${hotel.phone}`} className="text-foreground hover:text-primary">{hotel.phone}</a>
                        </div>
                    )}
                    {hotel.website && (
                        <div className="min-w-0">
                            <p className="text-[11px] font-medium text-primary">Website Link</p>
                            <a href={websiteHref(hotel.website)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{hotel.website}</a>
                        </div>
                    )}
                </div>
            </div>
        )}

        {documents.length > 0 && (
            <div>
                <h3 className="font-semibold text-primary mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> Show Documents</h3>
                <div className="space-y-2">
                    {documents.map(d => (
                        <a
                            key={d.id}
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-3 rounded-lg bg-background/60 px-3 py-2 text-xs font-medium hover:text-primary"
                        >
                            <span className="flex items-center gap-2 min-w-0"><FileText className="h-4 w-4 shrink-0 text-red-500" /> <span className="truncate">{d.name}</span></span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                    ))}
                </div>
            </div>
        )}
    </>
);

// "Contact Information", "Sponsor Hotel" and "Show Documents" for the public show pages.
// `inline` puts them inside an existing box (no cards of their own).
// Shows nothing when the organizer has not filled them in (or has hidden them).
const PublicContactCards = ({ publicPage, general = {}, cardClassName = '', inline = false }) => {
    const contacts = publicContacts(publicPage, general);
    const hotel = publicHotel(publicPage);
    const documents = publicDocuments(publicPage);
    if (contacts.length === 0 && !hotel && documents.length === 0) return null;

    if (inline) return <InlineSections contacts={contacts} hotel={hotel} documents={documents} />;

    return (
        <>
            {documents.length > 0 && (
                <Card className={cardClassName}>
                    <CardHeader><CardTitle className="flex items-center"><FileText className="mr-2" /> Show Documents</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {documents.map(d => (
                            <a
                                key={d.id}
                                href={d.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm font-medium hover:border-primary hover:text-primary"
                            >
                                <span className="flex items-center gap-2 min-w-0"><FileText className="h-4 w-4 shrink-0" /> <span className="truncate">{d.name}</span></span>
                                <ExternalLink className="h-4 w-4 shrink-0" />
                            </a>
                        ))}
                    </CardContent>
                </Card>
            )}

            {contacts.length > 0 && (
                <Card className={cardClassName}>
                    <CardHeader><CardTitle className="flex items-center"><Users className="mr-2" /> Contact Information</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {contacts.map(c => (
                            <div key={c.key} className="space-y-1">
                                <p className="font-semibold text-foreground">{c.label}</p>
                                {c.name && <p className="text-sm text-foreground">{c.name}</p>}
                                {c.phone && (
                                    <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                                        <Phone className="h-3.5 w-3.5" /> {c.phone}
                                    </a>
                                )}
                                {c.email && (
                                    <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary break-all">
                                        <Mail className="h-3.5 w-3.5" /> {c.email}
                                    </a>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {hotel && (
                <Card className={cardClassName}>
                    <CardHeader><CardTitle className="flex items-center"><Building2 className="mr-2" /> Sponsor Hotel</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                        {hotel.name && <p className="font-semibold text-foreground">{hotel.name}</p>}
                        {hotel.address && <p className="text-sm text-muted-foreground">{hotel.address}</p>}
                        {hotel.phone && (
                            <a href={`tel:${hotel.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                                <Phone className="h-3.5 w-3.5" /> {hotel.phone}
                            </a>
                        )}
                        {hotel.website && (
                            <a href={websiteHref(hotel.website)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline break-all">
                                <ExternalLink className="h-3.5 w-3.5" /> {hotel.website}
                            </a>
                        )}
                    </CardContent>
                </Card>
            )}
        </>
    );
};

export default PublicContactCards;
