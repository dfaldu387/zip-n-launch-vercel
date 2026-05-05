import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, User, AlertTriangle, Camera, MapPin, Award, Users, Plus, Trash2, Gavel, Save, Crown, CreditCard, ExternalLink, Receipt } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { fetchAssociations } from '@/lib/associationsData';

// US States list
const US_STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
    "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
    "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri",
    "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York",
    "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
    "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming"
];

// Disciplines list
const DISCIPLINES = [
    "Barrel Racing", "Breakaway Roping", "Cutting", "Dressage", "English Pleasure", 
    "Equitation Over Fences", "Halter", "Horsemanship", "Hunt Seat Equitation", 
    "Hunter Hack", "Hunter Under Saddle", "Jumping", "Pole Bending", 
    "Ranch Riding", "Ranch Trail", "Reining", "Showmanship", 
    "Trail", "Western Dressage", "Western Horsemanship", "Western Pleasure", 
    "Western Riding", "Working Cow Horse", "Working Hunter"
];

// Level designations
const LEVEL_DESIGNATIONS = [
    "Open", "Amateur", "Amateur Select", "Youth 18 & Under", "Youth 13 & Under", 
    "Youth 14-18", "Walk-Trot", "Level 1", "Level 2", "Level 3", 
    "Rookie", "Novice", "Green Horse", "Non-Pro"
];

// Association memberships
const ASSOCIATIONS = [
    { id: "AQHA", name: "AQHA - American Quarter Horse Association" },
    { id: "APHA", name: "APHA - American Paint Horse Association" },
    { id: "ApHC", name: "ApHC - Appaloosa Horse Club" },
    { id: "NSBA", name: "NSBA - National Snaffle Bit Association" },
    { id: "AHA", name: "AHA - Arabian Horse Association" },
    { id: "PtHA", name: "PtHA - Pinto Horse Association" },
    { id: "PHBA", name: "PHBA - Palomino Horse Breeders" },
    { id: "ABRA", name: "ABRA - American Buckskin Registry" },
    { id: "IBHA", name: "IBHA - International Buckskin Horse Assoc" },
    { id: "NRHA", name: "NRHA - National Reining Horse Association" },
    { id: "NRCHA", name: "NRCHA - National Reined Cow Horse Assoc" },
    { id: "POAC", name: "POAC - Pony of the Americas Club" },
    { id: "4-H", name: "4-H" },
    { id: "Open", name: "Open Shows" }
];

// Horse breed/registry options
const HORSE_BREEDS = [
    "Quarter Horse", "Paint Horse", "Appaloosa", "Arabian", "Pinto", 
    "Palomino", "Buckskin", "Morgan", "Thoroughbred", "Warmblood",
    "Mustang", "Tennessee Walker", "Saddlebred", "POA", "Grade/Unregistered", "Other"
];

// Age division eligibility
const AGE_DIVISIONS = [
    "Junior Horse (5 & Under)", "Senior Horse (6 & Over)", "All Ages",
    "2-Year-Old", "3-Year-Old", "Green Horse", "Youth Qualified", "Amateur Qualified"
];

const ProfilePage = () => {
    const { user, loading, updateUserProfile, openAuthModal, isSubscribed, subscriptionTier, subscriptionStatus } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { subscription, openBillingPortal, loading: subLoading } = useSubscription();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [billingLoading, setBillingLoading] = useState(false);
    
    // Basic Info
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [mobile, setMobile] = useState('');

    // Exhibitor Profile
    const [profilePicture, setProfilePicture] = useState(null);
    const [state, setState] = useState('');
    const [primaryDisciplines, setPrimaryDisciplines] = useState([]);
    const [levelDesignations, setLevelDesignations] = useState([]);
    const [associationMemberships, setAssociationMemberships] = useState([]);

    // Horse Information
    const [horses, setHorses] = useState([{
        id: 1,
        name: '',
        breed: '',
        ageDivision: '',
        disciplines: []
    }]);
    
    // Judge Profile State
    const [isCardedJudge, setIsCardedJudge] = useState(false);
    const [cardedAssociations, setCardedAssociations] = useState([]);
    const [displayCardedAssociationsPublicly, setDisplayCardedAssociationsPublicly] = useState(false);
    const [associationsData, setAssociationsData] = useState([]);
    const [isSavingJudgeProfile, setIsSavingJudgeProfile] = useState(false);

    // Fetch associations for judge profile
    useEffect(() => {
        const loadAssociations = async () => {
            const data = await fetchAssociations();
            setAssociationsData(data || []);
        };
        loadAssociations();
    }, []);

    useEffect(() => {
        if (!loading && !user) {
            // Redirect or show login prompt if not logged in
        } else if (user) {
            const meta = user.user_metadata || {};
            setFirstName(meta.firstName || meta.first_name || '');
            setLastName(meta.lastName || meta.last_name || '');
            setMobile(meta.mobile || '');
            
            // Profile
            // setProfilePicture(meta.profilePicture || null); // Ignoring for now as it's just base64 usually
            setState(meta.state || '');
            setPrimaryDisciplines(meta.primaryDisciplines || []);
            setLevelDesignations(meta.levelDesignations || []);
            setAssociationMemberships(meta.associationMemberships || []);
            
            // Horses
            if (meta.horses && Array.isArray(meta.horses)) {
                setHorses(meta.horses.map((h, i) => ({ ...h, id: h.id || Date.now() + i })));
            } else {
                setHorses([{ id: Date.now(), name: '', breed: '', ageDivision: '', disciplines: [] }]);
            }
            
            // Judge Profile
            setIsCardedJudge(meta.isCardedJudge || false);
            setCardedAssociations(meta.cardedAssociations || []);
            setDisplayCardedAssociationsPublicly(meta.displayCardedAssociationsPublicly || false);
        }
    }, [user, loading, navigate]);

    // Helpers
    const handleProfilePictureChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePicture(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleDiscipline = (disc) => {
        setPrimaryDisciplines(prev => 
            prev.includes(disc) ? prev.filter(d => d !== disc) : [...prev, disc]
        );
    };

    const toggleLevel = (level) => {
        setLevelDesignations(prev => 
            prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
        );
    };

    const toggleAssociation = (assoc) => {
        setAssociationMemberships(prev => 
            prev.includes(assoc) ? prev.filter(a => a !== assoc) : [...prev, assoc]
        );
    };

    const addHorse = () => {
        setHorses(prev => [...prev, {
            id: Date.now(),
            name: '',
            breed: '',
            ageDivision: '',
            disciplines: []
        }]);
    };

    const removeHorse = (id) => {
        if (horses.length > 1) {
            setHorses(prev => prev.filter(h => h.id !== id));
        }
    };

    const updateHorse = (id, field, value) => {
        setHorses(prev => prev.map(h => 
            h.id === id ? { ...h, [field]: value } : h
        ));
    };

    const toggleHorseDiscipline = (horseId, disc) => {
        setHorses(prev => prev.map(h => {
            if (h.id === horseId) {
                const newDiscs = h.disciplines.includes(disc) 
                    ? h.disciplines.filter(d => d !== disc)
                    : [...h.disciplines, disc];
                return { ...h, disciplines: newDiscs };
            }
            return h;
        }));
    };
    
    // Judge Profile helpers
    const toggleCardedAssociation = (assocId) => {
        setCardedAssociations(prev => 
            prev.includes(assocId) ? prev.filter(a => a !== assocId) : [...prev, assocId]
        );
    };
    
    const handleSaveJudgeProfile = async () => {
        if (!user) return;
        
        setIsSavingJudgeProfile(true);
        try {
            const metadata = {
                ...user.user_metadata,
                isCardedJudge,
                cardedAssociations,
                displayCardedAssociationsPublicly
            };
            
            await updateUserProfile(metadata);
            toast({
                title: 'Profile Updated',
                description: 'Your judge profile has been saved successfully.',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save judge profile. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSavingJudgeProfile(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        const metadata = {
            firstName: firstName,
            lastName: lastName,
            first_name: firstName,
            last_name: lastName,
            mobile: mobile,
            full_name: `${firstName} ${lastName}`.trim(),
            state,
            primaryDisciplines,
            levelDesignations,
            associationMemberships,
            horses: horses.filter(h => h.name)
        };

        if (profilePicture) {
            // metadata.profilePicture = profilePicture; // Optional: save if needed
        }

        await updateUserProfile(metadata);
        setIsSubmitting(false);
        return true;
    };

    const handleSaveAndExit = async () => {
        setIsSubmitting(true);
        const metadata = {
            firstName, lastName, first_name: firstName, last_name: lastName,
            mobile, full_name: `${firstName} ${lastName}`.trim(),
            state, primaryDisciplines, levelDesignations, associationMemberships,
            horses: horses.filter(h => h.name)
        };
        await updateUserProfile(metadata);
        setIsSubmitting(false);
        navigate('/');
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="container mx-auto px-4 py-8 text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <Card className="max-w-lg mx-auto">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-center gap-2"><AlertTriangle className="h-6 w-6 text-destructive" /> Access Denied</CardTitle>
                                <CardDescription>You need to be logged in to edit your profile.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="mb-4">Please log in or create an account to continue.</p>
                                <Button onClick={() => openAuthModal('login')}>
                                    <User className="mr-2 h-4 w-4" /> Login / Sign Up
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>
                </main>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Edit Profile - EquiPatterns</title>
                <meta name="description" content="Manage your profile details." />
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="container mx-auto px-4 py-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="max-w-4xl mx-auto"
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-3xl">Edit Profile</CardTitle>
                                <CardDescription>Update your personal information. Your email is <span className="font-semibold">{user.email}</span>.</CardDescription>
                            </CardHeader>
                            <form onSubmit={handleSubmit}>
                                <CardContent className="space-y-8">
                                    
                                    {/* Section 1: Basic Information */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="first-name">First Name</Label>
                                                <Input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="last-name">Last Name</Label>
                                                <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="mobile">Mobile Number</Label>
                                            <Input id="mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="(123) 456-7890" />
                                        </div>
                                    </div>

                                    {/* Section 2: Exhibitor Profile */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold border-b pb-2">Exhibitor Profile</h3>
                                        
                                        {/* Profile Picture */}
                                        <div className="space-y-2">
                                            <Label className="text-sm flex items-center gap-1"><Camera className="h-4 w-4" /> Profile Picture</Label>
                                            <div className="flex items-center gap-3">
                                                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30 overflow-hidden">
                                                    {profilePicture ? (
                                                        <img src={profilePicture} alt="Profile" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <User className="h-8 w-8 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="file"
                                                        id="profile-picture-upload-page"
                                                        accept="image/*"
                                                        onChange={handleProfilePictureChange}
                                                        className="hidden"
                                                    />
                                                    <Button 
                                                        type="button" 
                                                        variant="outline" 
                                                        size="sm"
                                                        onClick={() => document.getElementById('profile-picture-upload-page')?.click()}
                                                    >
                                                        {profilePicture ? 'Change Photo' : 'Upload Photo'}
                                                    </Button>
                                                    {profilePicture && (
                                                        <Button 
                                                            type="button" 
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={() => setProfilePicture(null)}
                                                        >
                                                            Remove
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* State */}
                                        <div className="space-y-2">
                                            <Label className="text-sm flex items-center gap-1"><MapPin className="h-4 w-4" /> State</Label>
                                            <Select value={state} onValueChange={setState}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select your state" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {US_STATES.map(s => (
                                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Primary Disciplines */}
                                        <div className="space-y-2">
                                            <Label className="text-sm flex items-center gap-1"><Award className="h-4 w-4" /> Primary Disciplines</Label>
                                            <Select 
                                                value={primaryDisciplines[primaryDisciplines.length - 1] || ''} 
                                                onValueChange={(value) => {
                                                    if (!primaryDisciplines.includes(value)) {
                                                        setPrimaryDisciplines(prev => [...prev, value]);
                                                    }
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select disciplines" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {DISCIPLINES.map(disc => (
                                                        <SelectItem key={disc} value={disc} disabled={primaryDisciplines.includes(disc)}>
                                                            {disc} {primaryDisciplines.includes(disc) && '✓'}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {primaryDisciplines.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {primaryDisciplines.map(disc => (
                                                        <Badge 
                                                            key={disc}
                                                            variant="secondary"
                                                            className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                                            onClick={(e) => { e.preventDefault(); toggleDiscipline(disc); }}
                                                        >
                                                            {disc} ×
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Level Designations */}
                                        <div className="space-y-2">
                                            <Label className="text-sm">Level Designation</Label>
                                            <Select 
                                                value={levelDesignations[levelDesignations.length - 1] || ''} 
                                                onValueChange={(value) => {
                                                    if (!levelDesignations.includes(value)) {
                                                        setLevelDesignations(prev => [...prev, value]);
                                                    }
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select level designations" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {LEVEL_DESIGNATIONS.map(level => (
                                                        <SelectItem key={level} value={level} disabled={levelDesignations.includes(level)}>
                                                            {level} {levelDesignations.includes(level) && '✓'}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {levelDesignations.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {levelDesignations.map(level => (
                                                        <Badge 
                                                            key={level}
                                                            variant="secondary"
                                                            className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                                            onClick={(e) => { e.preventDefault(); toggleLevel(level); }}
                                                        >
                                                            {level} ×
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Association Memberships */}
                                        <div className="space-y-2">
                                            <Label className="text-sm flex items-center gap-1"><Users className="h-4 w-4" /> Association Memberships</Label>
                                            <Select 
                                                value={associationMemberships[associationMemberships.length - 1] || ''} 
                                                onValueChange={(value) => {
                                                    if (!associationMemberships.includes(value)) {
                                                        setAssociationMemberships(prev => [...prev, value]);
                                                    }
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select associations" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ASSOCIATIONS.map(assoc => (
                                                        <SelectItem key={assoc.id} value={assoc.id} disabled={associationMemberships.includes(assoc.id)}>
                                                            {assoc.name} {associationMemberships.includes(assoc.id) && '✓'}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {associationMemberships.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {associationMemberships.map(assocId => (
                                                        <Badge 
                                                            key={assocId}
                                                            variant="secondary"
                                                            className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                                            onClick={(e) => { e.preventDefault(); toggleAssociation(assocId); }}
                                                        >
                                                            {assocId} ×
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Section 3: Judge Profile Setup & Verification */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                                            <Gavel className="h-5 w-5" />
                                            Judge Profile Setup & Verification
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Verify your judge status and carded associations
                                        </p>
                                        
                                        <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/30">
                                            <Checkbox
                                                id="is-carded-judge"
                                                checked={isCardedJudge}
                                                onCheckedChange={(checked) => setIsCardedJudge(checked)}
                                            />
                                            <Label htmlFor="is-carded-judge" className="text-base font-medium cursor-pointer">
                                                I am a carded judge
                                            </Label>
                                        </div>

                                        {isCardedJudge && (
                                            <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-medium">Association(s)</Label>
                                                    <p className="text-xs text-muted-foreground mb-2">
                                                        Select the associations you are carded with
                                                    </p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {associationsData.map(assoc => (
                                                            <div key={assoc.id} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`carded-assoc-${assoc.id}`}
                                                                    checked={cardedAssociations.includes(assoc.id)}
                                                                    onCheckedChange={() => toggleCardedAssociation(assoc.id)}
                                                                />
                                                                <Label 
                                                                    htmlFor={`carded-assoc-${assoc.id}`} 
                                                                    className="text-sm cursor-pointer"
                                                                >
                                                                    {assoc.name || assoc.id}
                                                                </Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {cardedAssociations.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {cardedAssociations.map(assocId => {
                                                                const assoc = associationsData.find(a => a.id === assocId);
                                                                return (
                                                                    <Badge 
                                                                        key={assocId}
                                                                        variant="secondary"
                                                                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                                                        onClick={(e) => { e.preventDefault(); toggleCardedAssociation(assocId); }}
                                                                    >
                                                                        {assoc?.name || assocId} ×
                                                                    </Badge>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/20">
                                                    <Checkbox
                                                        id="display-carded-publicly"
                                                        checked={displayCardedAssociationsPublicly}
                                                        onCheckedChange={(checked) => setDisplayCardedAssociationsPublicly(checked)}
                                                    />
                                                    <div className="flex-1">
                                                        <Label htmlFor="display-carded-publicly" className="text-sm font-medium cursor-pointer">
                                                            Publicly display my carded associations
                                                        </Label>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            When enabled, your carded associations will be visible to show managers
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <Button 
                                                    type="button"
                                                    onClick={handleSaveJudgeProfile} 
                                                    disabled={isSavingJudgeProfile}
                                                    className="w-full sm:w-auto"
                                                >
                                                    {isSavingJudgeProfile ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Saving...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save className="mr-2 h-4 w-4" />
                                                            Save Judge Profile
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Section 4: Membership & Subscription */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                                            <Crown className="h-5 w-5" />
                                            Membership & Subscription
                                        </h3>

                                        {isSubscribed ? (
                                            <Card className="bg-green-500/10 border-green-500/30">
                                                <CardContent className="p-4 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-semibold text-foreground">
                                                                {subscriptionTier === 'founding_insider' && 'Founding Insider'}
                                                                {subscriptionTier === 'founding_member' && 'Founding Member'}
                                                                {subscriptionTier === 'standard' && 'Standard Member'}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">Status: Active</p>
                                                            {subscription?.current_period_end && (
                                                                <p className="text-sm text-muted-foreground">
                                                                    Renews: {new Date(subscription.current_period_end).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <Badge className="bg-green-600">Active</Badge>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={billingLoading}
                                                        onClick={async () => {
                                                            setBillingLoading(true);
                                                            try {
                                                                await openBillingPortal();
                                                            } catch (error) {
                                                                toast({
                                                                    title: 'Error',
                                                                    description: error.message,
                                                                    variant: 'destructive',
                                                                });
                                                                setBillingLoading(false);
                                                            }
                                                        }}
                                                    >
                                                        {billingLoading ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <CreditCard className="mr-2 h-4 w-4" />
                                                        )}
                                                        Manage Billing
                                                        <ExternalLink className="ml-2 h-3 w-3" />
                                                    </Button>
                                                    <Button type="button" variant="ghost" size="sm" asChild>
                                                        <Link to="/billing-history">
                                                            <Receipt className="mr-2 h-4 w-4" />
                                                            View Billing History
                                                        </Link>
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        ) : (
                                            <Card className="bg-muted/30">
                                                <CardContent className="p-4 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-medium">No active membership</p>
                                                            <p className="text-sm text-muted-foreground">Subscribe to unlock all features</p>
                                                        </div>
                                                        <Button type="button" variant="default" size="sm" asChild>
                                                            <a href="/pricing">View Plans</a>
                                                        </Button>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="sm" asChild>
                                                        <Link to="/billing-history">
                                                            <Receipt className="mr-2 h-4 w-4" />
                                                            View Billing History
                                                        </Link>
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        )}
                                    </div>

                                    {/* Section 5: Horse Information */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <h3 className="text-lg font-semibold">Horse Information</h3>
                                            <Button type="button" variant="outline" size="sm" onClick={addHorse}>
                                                <Plus className="h-4 w-4 mr-1" /> Add Horse
                                            </Button>
                                        </div>

                                        <div className="space-y-4">
                                            {horses.map((horse, idx) => (
                                                <Card key={horse.id} className="bg-muted/30">
                                                    <CardContent className="p-4 space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-medium text-muted-foreground">Horse #{idx + 1}</span>
                                                            {horses.length > 1 && (
                                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeHorse(horse.id)}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label>Horse Name</Label>
                                                            <Input 
                                                                placeholder="Enter horse name" 
                                                                value={horse.name} 
                                                                onChange={(e) => updateHorse(horse.id, 'name', e.target.value)}
                                                            />
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label>Breed / Registry</Label>
                                                                <Select value={horse.breed} onValueChange={(v) => updateHorse(horse.id, 'breed', v)}>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select breed" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {HORSE_BREEDS.map(b => (
                                                                            <SelectItem key={b} value={b}>{b}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Age Division</Label>
                                                                <Select value={horse.ageDivision} onValueChange={(v) => updateHorse(horse.id, 'ageDivision', v)}>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select division" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {AGE_DIVISIONS.map(d => (
                                                                            <SelectItem key={d} value={d}>{d}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label>Horse's Disciplines</Label>
                                                            <Select 
                                                                value={horse.disciplines[horse.disciplines.length - 1] || ''} 
                                                                onValueChange={(value) => {
                                                                    if (!horse.disciplines.includes(value)) {
                                                                        toggleHorseDiscipline(horse.id, value);
                                                                    }
                                                                }}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select disciplines" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {DISCIPLINES.map(disc => (
                                                                        <SelectItem key={disc} value={disc} disabled={horse.disciplines.includes(disc)}>
                                                                            {disc} {horse.disciplines.includes(disc) && '✓'}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            {horse.disciplines.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {horse.disciplines.map(disc => (
                                                                        <Badge 
                                                                            key={disc}
                                                                            variant="secondary"
                                                                            className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                                                            onClick={(e) => { e.preventDefault(); toggleHorseDiscipline(horse.id, disc); }}
                                                                        >
                                                                            {disc} ×
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>

                                </CardContent>
                                <CardFooter className="flex justify-end gap-3">
                                    <Button type="submit" disabled={isSubmitting} size="lg" variant="outline">
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
                                    </Button>
                                    <Button type="button" disabled={isSubmitting} size="lg" onClick={handleSaveAndExit}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save & Exit'}
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    </motion.div>
                </main>
            </div>
        </>
    );
};

export default ProfilePage;