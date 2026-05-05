import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Eye, EyeOff, User, MapPin, Award, Users, ChevronRight, ChevronLeft, Plus, Trash2, Camera, AlertTriangle, Sparkles, CheckCircle2, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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

const AuthModal = () => {
    const { isAuthModalOpen, authModalInitialTab, closeAuthModal, signIn, signUp, sendPasswordResetEmail, setSkipAutoClose } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(authModalInitialTab);
    const [view, setView] = useState('tabs'); // 'tabs', 'forgot_password', or 'welcome'
    const [signUpStep, setSignUpStep] = useState(1); // 1: Basic, 2: Profile, 3: Horses, 4: Judge Profile
    const [welcomeName, setWelcomeName] = useState('');
    
    // Form States - Sign In
    const [signInEmail, setSignInEmail] = useState('');
    const [signInPassword, setSignInPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showSignInPassword, setShowSignInPassword] = useState(false);
    
    // Form States - Sign Up Step 1 (Basic)
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [signUpEmail, setSignUpEmail] = useState('');
    const [mobile, setMobile] = useState('');
    const [signUpPassword, setSignUpPassword] = useState('');
    const [showSignUpPassword, setShowSignUpPassword] = useState(false);
    
    // Form States - Sign Up Step 2 (Profile)
    const [profilePicture, setProfilePicture] = useState(null);
    const [state, setState] = useState('');
    const [primaryDisciplines, setPrimaryDisciplines] = useState([]);
    const [levelDesignations, setLevelDesignations] = useState([]);
    const [associationMemberships, setAssociationMemberships] = useState([]);
    
    // Form States - Sign Up Step 3 (Horses)
    const [horses, setHorses] = useState([{
        id: 1,
        name: '',
        breed: '',
        ageDivision: '',
        disciplines: []
    }]);

    // Legal & Compliance States
    const [legalAgreed, setLegalAgreed] = useState(false);
    const [electronicConsent, setElectronicConsent] = useState(false);
    const [riskAck, setRiskAck] = useState(false);

    // Form States - Sign Up Step 4 (Judge Profile)
    const [isCardedJudge, setIsCardedJudge] = useState(false);
    const [cardedAssociations, setCardedAssociations] = useState([]);
    const [publiclyDisplayCards, setPubliclyDisplayCards] = useState(false);

    const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isAuthModalOpen) {
            setView('tabs');
            setActiveTab(authModalInitialTab);
            setSignUpStep(1);
        }
    }, [isAuthModalOpen, authModalInitialTab]);

    const handleSignIn = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        const { error } = await signIn(signInEmail, signInPassword);
        if (!error) {
            toast({ title: "Welcome back!", description: "You've been successfully signed in." });
            closeAuthModal();
        }
        setIsLoading(false);
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        // Only allow signup on step 4 AND when explicitly submitting
        if (signUpStep !== 4 || !isSubmitting) {
            setIsSubmitting(false);
            return;
        }
        if (signUpPassword.length < 6) {
            toast({ title: "Weak Password", description: "Your password must be at least 6 characters long.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
        setIsLoading(true);
        
        // Compile all metadata
        const metadata = {
            firstName,
            lastName,
            mobile,
            state,
            primaryDisciplines,
            levelDesignations,
            associationMemberships,
            horses: horses.filter(h => h.name), // Only include horses with names
            // Judge profile data
            isCardedJudge,
            cardedAssociations: isCardedJudge ? cardedAssociations : [],
            publiclyDisplayCards: isCardedJudge ? publiclyDisplayCards : false
        };
        
        setSkipAutoClose(true);
        const { error } = await signUp(signUpEmail, signUpPassword, metadata);
        if (!error) {
            setWelcomeName(firstName);
            setView('welcome');
            // Send welcome email (fire and forget — don't block signup flow)
            supabase.functions.invoke('send-welcome-email', {
                body: JSON.stringify({
                    userName: firstName,
                    userEmail: signUpEmail,
                }),
            }).catch(err => console.error('Welcome email failed:', err));
        } else {
            setSkipAutoClose(false);
        }
        setIsLoading(false);
        setIsSubmitting(false);
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        await sendPasswordResetEmail(forgotPasswordEmail);
        setIsLoading(false);
        setView('tabs');
    };
    
    const onOpenChange = (open) => {
        if (!open) {
            closeAuthModal();
            // Reset all form fields
            setSignInEmail('');
            setSignInPassword('');
            setRememberMe(false);
            setFirstName('');
            setLastName('');
            setSignUpEmail('');
            setMobile('');
            setSignUpPassword('');
            setForgotPasswordEmail('');
            setIsLoading(false);
            setShowSignInPassword(false);
            setShowSignUpPassword(false);
            setSignUpStep(1);
            setProfilePicture(null);
            setState('');
            setPrimaryDisciplines([]);
            setLevelDesignations([]);
            setAssociationMemberships([]);
            setHorses([{ id: 1, name: '', breed: '', ageDivision: '', disciplines: [] }]);
            setLegalAgreed(false);
            setElectronicConsent(false);
            setRiskAck(false);
            setIsSubmitting(false);
            // Reset judge profile fields
            setIsCardedJudge(false);
            setCardedAssociations([]);
            setPubliclyDisplayCards(false);
        }
    };

    const toggleCardedAssociation = (assocId) => {
        setCardedAssociations(prev => 
            prev.includes(assocId) ? prev.filter(a => a !== assocId) : [...prev, assocId]
        );
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

    const nextStep = () => {
        if (signUpStep === 1) {
            if (!firstName || !lastName || !signUpEmail || !signUpPassword) {
                toast({ title: "Required Fields", description: "Please fill in all required fields.", variant: "destructive" });
                return;
            }
            if (signUpPassword.length < 6) {
                toast({ title: "Weak Password", description: "Password must be at least 6 characters.", variant: "destructive" });
                return;
            }
        }
        setSignUpStep(prev => Math.min(prev + 1, 4));
    };

    const prevStep = () => {
        setSignUpStep(prev => Math.max(prev - 1, 1));
    };
    
    const pageVariants = {
      initial: { opacity: 0, x: 50 },
      in: { opacity: 1, x: 0 },
      out: { opacity: 0, x: -50 },
    };

    const pageTransition = {
      type: 'tween',
      ease: 'anticipate',
      duration: 0.4,
    };

    const renderSignUpStep1 = () => (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label htmlFor="first-name" className="text-xs">First Name *</Label>
                    <Input id="first-name" placeholder="John" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="last-name" className="text-xs">Last Name *</Label>
                    <Input id="last-name" placeholder="Doe" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-9" />
                </div>
            </div>
            <div className="space-y-1">
                <Label htmlFor="email-signup" className="text-xs">Email *</Label>
                <Input id="email-signup" type="email" placeholder="you@example.com" required value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
                <Label htmlFor="mobile" className="text-xs">Mobile Number</Label>
                <Input id="mobile" type="tel" placeholder="(123) 456-7890" value={mobile} onChange={(e) => setMobile(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
                <Label htmlFor="password-signup" className="text-xs">Password *</Label>
                <div className="relative">
                    <Input id="password-signup" type={showSignUpPassword ? "text" : "password"} required value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} className="h-9" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowSignUpPassword(!showSignUpPassword)}>
                        {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">Must be at least 6 characters.</p>
            </div>
        </div>
    );

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

    const renderSignUpStep2 = () => (
        <ScrollArea className="h-[400px] pr-3">
            <div className="space-y-4">
                {/* Profile Picture */}
                <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1"><Camera className="h-3 w-3" /> Profile Picture</Label>
                    <div className="flex items-center gap-3">
                        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30 overflow-hidden">
                            {profilePicture ? (
                                <img src={profilePicture} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                                <User className="h-6 w-6 text-muted-foreground" />
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                id="profile-picture-upload"
                                accept="image/*"
                                onChange={handleProfilePictureChange}
                                className="hidden"
                            />
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm"
                                onClick={() => document.getElementById('profile-picture-upload')?.click()}
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
                <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> State</Label>
                    <Select value={state} onValueChange={setState}>
                        <SelectTrigger className="h-9">
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
                    <Label className="text-xs flex items-center gap-1"><Award className="h-3 w-3" /> Primary Disciplines</Label>
                    <Select 
                        value={primaryDisciplines[primaryDisciplines.length - 1] || ''} 
                        onValueChange={(value) => {
                            if (!primaryDisciplines.includes(value)) {
                                setPrimaryDisciplines(prev => [...prev, value]);
                            }
                        }}
                    >
                        <SelectTrigger className="h-9">
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
                                    variant="default"
                                    className="text-xs py-0.5 px-2 cursor-pointer hover:bg-destructive"
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
                    <Label className="text-xs">Level Designation</Label>
                    <Select 
                        value={levelDesignations[levelDesignations.length - 1] || ''} 
                        onValueChange={(value) => {
                            if (!levelDesignations.includes(value)) {
                                setLevelDesignations(prev => [...prev, value]);
                            }
                        }}
                    >
                        <SelectTrigger className="h-9">
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
                                    variant="default"
                                    className="text-xs py-0.5 px-2 cursor-pointer hover:bg-destructive"
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
                    <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> Association Memberships</Label>
                    <Select 
                        value={associationMemberships[associationMemberships.length - 1] || ''} 
                        onValueChange={(value) => {
                            if (!associationMemberships.includes(value)) {
                                setAssociationMemberships(prev => [...prev, value]);
                            }
                        }}
                    >
                        <SelectTrigger className="h-9">
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
                                    variant="default"
                                    className="text-xs py-0.5 px-2 cursor-pointer hover:bg-destructive"
                                    onClick={(e) => { e.preventDefault(); toggleAssociation(assocId); }}
                                >
                                    {assocId} ×
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </ScrollArea>
    );

    // Judge associations list for Step 3
    const JUDGE_ASSOCIATIONS = [
        { id: "ABRA", name: "ABRA - American Buckskin Registry Association" },
        { id: "IBHA", name: "IBHA - International Buckskin Horse Association" },
        { id: "NSBA", name: "NSBA - National Snaffle Bit Association" },
        { id: "APHA", name: "APHA - American Paint Horse Association" },
        { id: "PtHA", name: "PtHA - Pinto Horse Association of America" },
        { id: "NRCHA", name: "NRCHA - National Reined Cow Horse Association" },
        { id: "4-H", name: "4-H" },
        { id: "VRH", name: "VRH Ranch Horse" },
        { id: "PHBA", name: "PHBA - Palomino Horse Breeders of America" },
        { id: "POAC", name: "POAC - Pony of the Americas Club" },
        { id: "AQHA", name: "AQHA - American Quarter Horse Association" },
        { id: "ApHC", name: "ApHC - Appaloosa Horse Club" },
        { id: "NRHA", name: "NRHA - National Reining Horse Association" },
        { id: "AHA", name: "AHA - Arabian Horse Association" },
        { id: "Open", name: "Open Shows" },
        { id: "SHOT", name: "Shot - Stock Horses Texas" }
    ];

    const renderSignUpStep3 = () => (
        <ScrollArea className="h-[400px] pr-3">
            <div className="space-y-4">
                {/* Section Header */}
                <div className="space-y-1">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Judge Profile Setup & Verification
                    </h4>
                    <p className="text-xs text-muted-foreground">Verify your judge status and carded associations</p>
                </div>

                {/* I am a carded judge checkbox */}
                <div className="flex items-center space-x-2 p-3 rounded-md bg-muted/50 border">
                    <Checkbox 
                        id="carded-judge" 
                        checked={isCardedJudge} 
                        onCheckedChange={setIsCardedJudge} 
                    />
                    <Label htmlFor="carded-judge" className="text-sm font-medium cursor-pointer">
                        I am a carded judge
                    </Label>
                </div>

                {/* Association Selection - Only show if carded judge is checked */}
                {isCardedJudge && (
                    <>
                        <div className="space-y-2">
                            <Label className="text-xs">Association(s)</Label>
                            <p className="text-[10px] text-muted-foreground">Select the associations you are carded with</p>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {JUDGE_ASSOCIATIONS.map(assoc => (
                                    <div key={assoc.id} className="flex items-start space-x-2">
                                        <Checkbox 
                                            id={`judge-assoc-${assoc.id}`}
                                            checked={cardedAssociations.includes(assoc.id)} 
                                            onCheckedChange={() => toggleCardedAssociation(assoc.id)}
                                            className="mt-0.5"
                                        />
                                        <Label 
                                            htmlFor={`judge-assoc-${assoc.id}`} 
                                            className="text-xs font-normal cursor-pointer leading-tight"
                                        >
                                            {assoc.name}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Publicly display checkbox */}
                        <div className="p-3 rounded-md bg-primary/10 border border-primary/20 space-y-1">
                            <div className="flex items-start space-x-2">
                                <Checkbox 
                                    id="publicly-display" 
                                    checked={publiclyDisplayCards} 
                                    onCheckedChange={setPubliclyDisplayCards}
                                    className="mt-0.5"
                                />
                                <div>
                                    <Label htmlFor="publicly-display" className="text-xs font-medium cursor-pointer">
                                        Publicly display my carded associations
                                    </Label>
                                    <p className="text-[10px] text-muted-foreground">
                                        When enabled, your carded associations will be visible to show managers
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Skip note for non-judges */}
                {!isCardedJudge && (
                    <div className="p-3 rounded-md bg-muted/30 border border-dashed">
                        <p className="text-xs text-muted-foreground text-center">
                            Not a judge? No problem! You can skip this step and continue to create your account.
                        </p>
                    </div>
                )}
            </div>
        </ScrollArea>
    );

    const renderSignUpStep4 = () => (
        <ScrollArea className="h-[400px] pr-3">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Your Horses</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addHorse} className="h-7 text-xs">
                        <Plus className="h-3 w-3 mr-1" /> Add Horse
                    </Button>
                </div>

                {horses.map((horse, idx) => (
                    <div key={horse.id} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Horse #{idx + 1}</span>
                            {horses.length > 1 && (
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeHorse(horse.id)}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">Horse Name</Label>
                            <Input 
                                placeholder="Enter horse name" 
                                value={horse.name} 
                                onChange={(e) => updateHorse(horse.id, 'name', e.target.value)}
                                className="h-8"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-xs">Breed / Registry</Label>
                                <Select value={horse.breed} onValueChange={(v) => updateHorse(horse.id, 'breed', v)}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Select breed" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {HORSE_BREEDS.map(b => (
                                            <SelectItem key={b} value={b}>{b}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Age Division</Label>
                                <Select value={horse.ageDivision} onValueChange={(v) => updateHorse(horse.id, 'ageDivision', v)}>
                                    <SelectTrigger className="h-8 text-xs">
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

                        <div className="space-y-1">
                            <Label className="text-xs">Horse's Disciplines</Label>
                            <Select 
                                value={horse.disciplines[horse.disciplines.length - 1] || ''} 
                                onValueChange={(value) => {
                                    if (!horse.disciplines.includes(value)) {
                                        toggleHorseDiscipline(horse.id, value);
                                    }
                                }}
                            >
                                <SelectTrigger className="h-8 text-xs">
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
                                            variant="default"
                                            className="text-[10px] py-0 px-1.5 cursor-pointer hover:bg-destructive"
                                            onClick={(e) => { e.preventDefault(); toggleHorseDiscipline(horse.id, disc); }}
                                        >
                                            {disc} ×
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Legal & Compliance Section */}
                <div className="mt-6 space-y-4 border-t pt-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Legal & Compliance
                    </h4>

                    {/* Checkbox 1: Consolidated Legal Agreement */}
                    <div className="flex items-start space-x-2">
                        <Checkbox id="legal-agreed" checked={legalAgreed} onCheckedChange={setLegalAgreed} className="mt-1" />
                        <Label htmlFor="legal-agreed" className="text-xs font-normal leading-tight text-muted-foreground">
                            I acknowledge and agree that by creating an account and purchasing a membership, I have read, understand, and agree to the: {' '}
                            <a href="/documents/governing/membership-agreement.docx" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Membership Agreement</a>, {' '}
                            <a href="/documents/governing/terms-of-service.docx" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a>, {' '}
                            <a href="/documents/governing/privacy-policy.docx" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a>, {' '}
                            <a href="/documents/governing/licensing-ip-policy.docx" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Licensing & Intellectual Property Policy</a>, {' '}
                            <a href="/documents/governing/refund-policy.docx" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Payment, Renewal & Refund Policy</a>, and {' '}
                            <a href="/documents/governing/communications-sms-policy.docx" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Electronic Communications Consent</a>.
                        </Label>
                    </div>

                    {/* Checkbox 2: Electronic Communications Consent */}
                    <div className="flex items-start space-x-2">
                        <Checkbox id="electronic-consent" checked={electronicConsent} onCheckedChange={setElectronicConsent} className="mt-1" />
                        <Label htmlFor="electronic-consent" className="text-xs font-normal leading-tight text-muted-foreground">
                            I consent to receive transactional communications electronically (email and/or SMS) related to my account, billing, and platform activity.
                        </Label>
                    </div>

                    {/* Checkbox 3: Equine Activity Risk Disclaimer */}
                    <div className="flex items-start space-x-2">
                        <Checkbox id="risk-ack" checked={riskAck} onCheckedChange={setRiskAck} className="mt-1" />
                        <Label htmlFor="risk-ack" className="text-xs font-normal leading-tight text-muted-foreground">
                            I acknowledge and agree that equine activities carry inherent risks and that EquiPatterns.com provides tools and materials only, and does not supervise or control their use.
                        </Label>
                    </div>
                </div>
            </div>
        </ScrollArea>
    );

    return (
        <Dialog open={isAuthModalOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
                <AnimatePresence initial={false} mode="wait">
                    {view === 'tabs' && (
                        <motion.div key="tabs" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}>
                            <DialogHeader className="p-4 pb-0">
                                <DialogTitle className="text-xl font-bold">Welcome!</DialogTitle>
                                <DialogDescription className="text-sm">
                                    Sign in or create an account to unlock all features.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="p-4">
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="signin">Sign In</TabsTrigger>
                                        <TabsTrigger value="signup">Sign Up</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="signin" className="pt-3">
                                        <form onSubmit={handleSignIn} className="space-y-3">
                                            <div className="space-y-1">
                                                <Label htmlFor="email-signin" className="text-xs">Email</Label>
                                                <Input id="email-signin" type="email" placeholder="you@example.com" required value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)} className="h-9" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="password-signin" className="text-xs">Password</Label>
                                                <div className="relative">
                                                    <Input id="password-signin" type={showSignInPassword ? "text" : "password"} required value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} className="h-9" />
                                                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowSignInPassword(!showSignInPassword)}>
                                                        {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox id="remember-me" checked={rememberMe} onCheckedChange={setRememberMe} />
                                                    <Label htmlFor="remember-me" className="text-xs font-normal">Remember me</Label>
                                                </div>
                                                <Button variant="link" type="button" onClick={() => setView('forgot_password')} className="p-0 h-auto text-xs">Forgot password?</Button>
                                            </div>
                                            <Button type="submit" className="w-full" disabled={isLoading}>
                                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign In'}
                                            </Button>
                                        </form>
                                    </TabsContent>
                                    <TabsContent value="signup" className="pt-3">
                                        <form data-signup-form onSubmit={(e) => {
                                            e.preventDefault();
                                            // Only proceed if isSubmitting was set by button click
                                            if (signUpStep === 4 && isSubmitting) {
                                                handleSignUp(e);
                                            }
                                        }}>
                                            {/* Step Indicators */}
                                            <div className="flex items-center justify-center gap-1.5 mb-4">
                                                {[1, 2, 3, 4].map(step => (
                                                    <div key={step} className="flex items-center">
                                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                                                            signUpStep >= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                                        }`}>
                                                            {step}
                                                        </div>
                                                        {step < 4 && <div className={`w-6 h-0.5 mx-0.5 ${signUpStep > step ? 'bg-primary' : 'bg-muted'}`} />}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="text-center mb-3">
                                                <span className="text-xs text-muted-foreground">
                                                    {signUpStep === 1 && "Step 1: Basic Information"}
                                                    {signUpStep === 2 && "Step 2: Exhibitor Profile"}
                                                    {signUpStep === 3 && "Step 3: Judge Profile (Optional)"}
                                                    {signUpStep === 4 && "Step 4: Horse Information"}
                                                </span>
                                            </div>

                                            {signUpStep === 1 && renderSignUpStep1()}
                                            {signUpStep === 2 && renderSignUpStep2()}
                                            {signUpStep === 3 && renderSignUpStep3()}
                                            {signUpStep === 4 && renderSignUpStep4()}

                                            {/* Navigation Buttons */}
                                            <div className="flex gap-2 mt-4">
                                                {signUpStep > 1 && (
                                                    <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
                                                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                                                    </Button>
                                                )}
                                                {signUpStep < 4 ? (
                                                    <Button type="button" onClick={nextStep} className="flex-1">
                                                        Next <ChevronRight className="h-4 w-4 ml-1" />
                                                    </Button>
                                                ) : (
                                                    <Button 
                                                        type="button" 
                                                        className="flex-1" 
                                                        disabled={isLoading || !legalAgreed || !electronicConsent || !riskAck}
                                                        onClick={() => {
                                                            if (!legalAgreed || !electronicConsent || !riskAck) return;
                                                            setIsSubmitting(true);
                                                            setTimeout(() => {
                                                                const form = document.querySelector('form[data-signup-form]');
                                                                if (form) form.requestSubmit();
                                                            }, 0);
                                                        }}
                                                    >
                                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Account'}
                                                    </Button>
                                                )}
                                            </div>

                                            {signUpStep > 1 && (
                                                <p className="text-center text-[10px] text-muted-foreground mt-2">
                                                    You can skip optional fields and complete your profile later.
                                                </p>
                                            )}
                                        </form>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </motion.div>
                    )}
                    {view === 'forgot_password' && (
                        <motion.div key="forgot" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}>
                            <DialogHeader className="p-4 pb-0">
                                <DialogTitle className="text-xl font-bold">Forgot Password?</DialogTitle>
                                <DialogDescription className="text-sm">
                                    Enter your email and we'll send you a link to reset it.
                                </DialogDescription>
                            </DialogHeader>
                             <div className="p-4">
                                <form onSubmit={handleForgotPassword} className="space-y-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="email-forgot" className="text-xs">Email</Label>
                                        <Input id="email-forgot" type="email" placeholder="you@example.com" required value={forgotPasswordEmail} onChange={(e) => setForgotPasswordEmail(e.target.value)} className="h-9" />
                                    </div>
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send Reset Link'}
                                    </Button>
                                    <Button variant="link" type="button" onClick={() => setView('tabs')} className="w-full text-sm">Back to Sign In</Button>
                                </form>
                            </div>
                        </motion.div>
                    )}
                    {view === 'welcome' && (
                        <motion.div
                            key="welcome"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                            <div className="p-8 text-center space-y-5">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                    className="flex justify-center"
                                >
                                    <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                        <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
                                    </div>
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="space-y-2"
                                >
                                    <h2 className="text-2xl font-bold text-foreground">
                                        Welcome to EquiPatterns{welcomeName ? `, ${welcomeName}` : ''}!
                                    </h2>
                                    <p className="text-muted-foreground text-sm">
                                        Your account has been created successfully. You're all set to explore professionally curated patterns, build pattern books, and manage horse shows.
                                    </p>
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6 }}
                                    className="space-y-3 pt-2"
                                >
                                    <Button
                                        className="w-full"
                                        size="lg"
                                        onClick={() => {
                                            closeAuthModal();
                                            navigate('/profile');
                                        }}
                                    >
                                        <User className="mr-2 h-4 w-4" />
                                        View My Profile
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        size="lg"
                                        onClick={() => {
                                            closeAuthModal();
                                            navigate('/choose-a-pattern');
                                        }}
                                    >
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Explore Patterns
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="w-full text-sm text-muted-foreground"
                                        onClick={() => {
                                            closeAuthModal();
                                        }}
                                    >
                                        Continue to Home
                                    </Button>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
};

export default AuthModal;