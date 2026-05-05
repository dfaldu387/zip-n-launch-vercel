import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MapPin, Link as LinkIcon, UploadCloud } from 'lucide-react';
import { LogoUploader } from './LogoUploader';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

export const GeneralVenueStep = ({ formData, setFormData }) => {
    const { showId } = useParams();
    const { toast } = useToast();
    const [associationsData, setAssociationsData] = useState([]);

    useEffect(() => {
        const fetchAssociations = async () => {
            const { data, error } = await supabase.from('associations').select('*');
            if (error) {
                toast({ title: 'Error fetching associations', description: error.message, variant: 'destructive' });
            } else {
                setAssociationsData(data);
            }
        };
        fetchAssociations();
    }, [toast]);

    const handleDetailChange = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            showDetails: {
                ...prev.showDetails,
                [section]: {
                    ...(prev.showDetails?.[section] || {}),
                    [field]: value
                }
            }
        }));
    };
    
    const handleAssociationLogoUpload = (assocId, url) => {
        setFormData(prev => {
            const currentLogos = prev.showDetails?.general?.associationLogos || {};
            return {
                ...prev,
                showDetails: {
                    ...prev.showDetails,
                    general: {
                        ...(prev.showDetails?.general || {}),
                        associationLogos: {
                            ...currentLogos,
                            [assocId]: url,
                        },
                    },
                },
            };
        });
    };

    const handleSanctionIdChange = (assocId, value) => {
        setFormData(prev => ({
            ...prev,
            showDetails: {
                ...prev.showDetails,
                general: {
                    ...(prev.showDetails?.general || {}),
                    sanctionIds: {
                        ...(prev.showDetails?.general?.sanctionIds || {}),
                        [assocId]: value
                    }
                }
            }
        }));
    };
    
    const handleLogoUpload = (section, field, url) => {
        handleDetailChange(section, field, url);
    };

    const renderTextarea = (section, field, label, placeholder) => (
        <div className="space-y-1.5">
            <Label htmlFor={`${section}-${field}`}>{label}</Label>
            <Textarea
                id={`${section}-${field}`}
                value={formData.showDetails?.[section]?.[field] || ''}
                onChange={e => handleDetailChange(section, field, e.target.value)}
                placeholder={placeholder}
            />
        </div>
    );

    const selectedAssociations = Object.keys(formData.associations || {}).filter(id => formData.associations[id] && id !== 'custom');
    const customAssociationName = formData.associations?.custom && formData.customAssociations?.[0] ? formData.customAssociations[0] : null;

    let showType = [...selectedAssociations.map(id => associationsData.find(a => a.id === id)?.name), customAssociationName].filter(Boolean).join(' / ');
    if (formData.associations?.NSBA) {
        const nsbaType = formData.nsbaApprovalType === 'dual' ? 'Dual-Approved' : (formData.nsbaApprovalType === 'standalone' ? 'Standalone' : 'Dual & Standalone');
        showType = showType.replace('NSBA', `NSBA (${nsbaType})`);
    }

    const getAssociationName = (id) => associationsData.find(a => a.id === id)?.name || id;

    const handleArenaNameChange = (index, value) => {
        setFormData(prev => {
            const arenas = [...(prev.showDetails?.venue?.arenas || [])];
            arenas[index] = { ...(arenas[index] || {}), id: `arena-${index + 1}`, name: value };
            return {
                ...prev,
                showDetails: {
                    ...prev.showDetails,
                    venue: {
                        ...(prev.showDetails?.venue || {}),
                        arenas,
                    },
                },
            };
        });
    };

    const arenaCount = parseInt(formData.showDetails?.venue?.numberOfArenas) || 0;

    const openMap = (mapType) => {
        const address = formData.showDetails?.venue?.address;
        if (!address) return;
        const encodedAddress = encodeURIComponent(address);
        const url = mapType === 'google'
            ? `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
            : `http://maps.apple.com/?q=${encodedAddress}`;
        window.open(url, '_blank');
    };

    return (
        <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>Step 2: General & Venue</CardTitle>
                <CardDescription>Enter the basic details for your show, populated from your association selections.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="p-6 border rounded-lg bg-background/50">
                    <h4 className="font-semibold text-xl mb-4 text-primary">General Show Identity</h4>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Type of Show</Label>
                            <Input value={showType || 'Select associations in Step 1'} readOnly />
                        </div>

                        {selectedAssociations.length > 0 &&
                        <div className="space-y-4 pt-2">
                             <Label>Association Details</Label>
                            {selectedAssociations.map(assocId => (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-center" key={assocId}>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={`sanctionId-${assocId}`}>{getAssociationName(assocId)} Sanction ID</Label>
                                        <Input
                                            id={`sanctionId-${assocId}`}
                                            value={formData.showDetails?.general?.sanctionIds?.[assocId] || ''}
                                            onChange={e => handleSanctionIdChange(assocId, e.target.value)}
                                            placeholder={`Enter ${getAssociationName(assocId)} ID`}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>{getAssociationName(assocId)} Logo</Label>
                                        <LogoUploader
                                            fieldId={`association_${assocId}`}
                                            currentLogoUrl={formData.showDetails?.general?.associationLogos?.[assocId] || ''}
                                            onUploadComplete={(url) => handleAssociationLogoUpload(assocId, url)}
                                            showId={showId}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        }
                         {customAssociationName &&
                            <div className="space-y-4 pt-2">
                                <Label>Custom Association Details</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-center">
                                     <div className="space-y-1.5">
                                        <Label htmlFor="sanctionId-custom">{customAssociationName} Sanction ID</Label>
                                        <Input
                                            id="sanctionId-custom"
                                            value={formData.showDetails?.general?.sanctionIds?.custom || ''}
                                            onChange={e => handleSanctionIdChange('custom', e.target.value)}
                                            placeholder={`Enter ${customAssociationName} ID`}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>{customAssociationName} Logo</Label>
                                        <LogoUploader
                                            fieldId="association_custom"
                                            currentLogoUrl={formData.showDetails?.general?.associationLogos?.custom || ''}
                                            onUploadComplete={(url) => handleAssociationLogoUpload('custom', url)}
                                            showId={showId}
                                        />
                                    </div>
                                </div>
                            </div>
                         }
                        
                        <div>
                            <Label>Event Host / Sponsoring Association</Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 items-center">
                                <Input className="md:col-span-1" value={formData.showDetails?.general?.eventHost || ''} onChange={(e) => handleDetailChange('general', 'eventHost', e.target.value)} placeholder="e.g., State QHA" />
                                <Input className="md:col-span-1" type="email" value={formData.showDetails?.general?.eventHostEmail || ''} onChange={(e) => handleDetailChange('general', 'eventHostEmail', e.target.value)} placeholder="Host's Email" />
                                <LogoUploader
                                    fieldId="eventHost"
                                    currentLogoUrl={formData.showDetails?.general?.eventHostLogo}
                                    onUploadComplete={(url) => handleLogoUpload('general', 'eventHostLogo', url)}
                                    showId={showId}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="website">Official Show Website</Label>
                            <Input id="website" type="url" value={formData.showDetails?.general?.website || ''} onChange={(e) => handleDetailChange('general', 'website', e.target.value)} placeholder="https://example.com/show" />
                        </div>
                    </div>
                </div>
                <div className="p-6 border rounded-lg bg-background/50">
                    <h4 className="font-semibold text-xl mb-4 text-primary">Venue Information</h4>
                    <div className="space-y-4">
                        <div>
                            <Label>Venue</Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 items-center">
                                <Input className="md:col-span-1" value={formData.showDetails?.venue?.facilityName || ''} onChange={(e) => handleDetailChange('venue', 'facilityName', e.target.value)} placeholder="Venue Name" />
                                <Input className="md:col-span-1" type="url" value={formData.showDetails?.venue?.venueWebsite || ''} onChange={(e) => handleDetailChange('venue', 'venueWebsite', e.target.value)} placeholder="Venue Website" />
                                <LogoUploader
                                    fieldId="venue"
                                    currentLogoUrl={formData.showDetails?.venue?.venueLogo}
                                    onUploadComplete={(url) => handleLogoUpload('venue', 'venueLogo', url)}
                                    showId={showId}
                                />
                            </div>
                        </div>
                        
                        <div>
                            <Label htmlFor="address">Address</Label>
                            <div className="flex items-center gap-2">
                                <Input id="address" value={formData.showDetails?.venue?.address || ''} onChange={(e) => handleDetailChange('venue', 'address', e.target.value)} placeholder="123 Horse Ranch Rd, Anytown, USA" />
                                <Button variant="outline" size="icon" onClick={() => openMap('google')} title="Open in Google Maps">
                                    <MapPin className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" onClick={() => openMap('apple')} title="Open in Apple Maps">
                                    <img-replace src="/apple-logo.svg" alt="Apple Maps" className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        
                        {renderTextarea('venue', 'directions', 'Directions / Parking Instructions', 'e.g., Trailer parking is located at the north entrance...')}
                    </div>
                </div>

                <div className="p-6 border rounded-lg bg-background/50">
                    <h4 className="font-semibold text-xl mb-4 text-primary">Facility Details</h4>
                    <div className="space-y-4">
                        <div>
                            <Label>Capacity</Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
                                <Input type="number" min="0" value={formData.showDetails?.venue?.numberOfStalls || ''} onChange={(e) => handleDetailChange('venue', 'numberOfStalls', e.target.value)} placeholder="Number of Stalls" />
                                <Input type="number" min="0" value={formData.showDetails?.venue?.numberOfRVSpots || ''} onChange={(e) => handleDetailChange('venue', 'numberOfRVSpots', e.target.value)} placeholder="Number of RV Spots" />
                                <Input type="number" min="0" value={formData.showDetails?.venue?.numberOfArenas || ''} onChange={(e) => handleDetailChange('venue', 'numberOfArenas', e.target.value)} placeholder="Number of Arenas" />
                            </div>
                        </div>

                        {arenaCount > 0 && (
                            <div>
                                <Label>Arena Names</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-2">
                                    {Array.from({ length: arenaCount }, (_, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground whitespace-nowrap w-20">Arena {i + 1}</span>
                                            <Input
                                                value={formData.showDetails?.venue?.arenas?.[i]?.name || ''}
                                                onChange={(e) => handleArenaNameChange(i, e.target.value)}
                                                placeholder={`e.g., Main Arena`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border rounded-lg bg-background/50">
                    <h4 className="font-semibold text-xl mb-4 text-primary">Lodging</h4>
                    <div className="space-y-4">
                        <div>
                            <Label>Host Hotel</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 items-center">
                                <Textarea value={formData.showDetails?.venue?.hostHotel || ''} onChange={(e) => handleDetailChange('venue', 'hostHotel', e.target.value)} placeholder="Hotel name & info (e.g., Stay at The Equestrian Inn, use code HORSESHOW25...)" />
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Input type="url" value={formData.showDetails?.venue?.hostHotelBookingLink || ''} onChange={(e) => handleDetailChange('venue', 'hostHotelBookingLink', e.target.value)} placeholder="Booking Link" />
                                        <Button variant="outline" size="icon" asChild>
                                            <a href={formData.showDetails?.venue?.hostHotelBookingLink || '#'} target="_blank" rel="noopener noreferrer" title="Open Booking Link">
                                                <LinkIcon className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    </div>
                                    <LogoUploader
                                        fieldId="hotel"
                                        currentLogoUrl={formData.showDetails?.venue?.hotelLogo}
                                        onUploadComplete={(url) => handleLogoUpload('venue', 'hotelLogo', url)}
                                        showId={showId}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </motion.div>
    );
};