import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, PlusCircle, Edit, Trash2, Package } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const PackageForm = ({ packageData, onSave, onCancel, isSaving }) => {
    const [formData, setFormData] = useState({
        name: '',
        base_price: 0,
        annual_price: 0,
        features: '',
        is_active: true,
        is_popular: false,
        is_intro_offer: false,
        is_annual_only: false,
        cta_text: '',
        sort_order: 0,
    });

    useEffect(() => {
        if (packageData) {
            setFormData({
                ...packageData,
                base_price: packageData.base_price ? packageData.base_price / 100 : 0,
                annual_price: (packageData.annual_price || 0) / 100,
                features: (packageData.features || []).join('\n'),
            });
        } else {
             setFormData({
                name: '',
                base_price: 0,
                annual_price: 0,
                features: '',
                is_active: true,
                is_popular: false,
                is_intro_offer: false,
                is_annual_only: false,
                cta_text: '',
                sort_order: 0,
            });
        }
    }, [packageData]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSave = {
            ...formData,
            base_price: formData.is_annual_only ? null : Math.round(parseFloat(formData.base_price) * 100),
            annual_price: formData.annual_price ? Math.round(parseFloat(formData.annual_price) * 100) : null,
            features: formData.features.split('\n').filter(f => f.trim() !== ''),
        };
        onSave(dataToSave);
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2"><Label htmlFor="name">Package Name</Label><Input id="name" name="name" value={formData.name} onChange={handleChange} required /></div>
            <div className="space-y-2"><Label htmlFor="base_price">Monthly Price ($)</Label><Input id="base_price" name="base_price" type="number" step="0.01" value={formData.base_price} onChange={handleChange} disabled={formData.is_annual_only} /></div>
            <div className="space-y-2"><Label htmlFor="annual_price">Annual Price ($)</Label><Input id="annual_price" name="annual_price" type="number" step="0.01" value={formData.annual_price} onChange={handleChange} /></div>
            <div className="col-span-2 space-y-2"><Label htmlFor="features">Features (one per line)</Label><Textarea id="features" name="features" value={formData.features} onChange={handleChange} rows={5} /></div>
            <div className="space-y-2"><Label htmlFor="cta_text">CTA Button Text</Label><Input id="cta_text" name="cta_text" value={formData.cta_text} onChange={handleChange} placeholder="e.g., Get Started" /></div>
            <div className="space-y-2"><Label htmlFor="sort_order">Sort Order</Label><Input id="sort_order" name="sort_order" type="number" value={formData.sort_order} onChange={handleChange} /></div>
            <div className="col-span-2 grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2"><Checkbox id="is_active" name="is_active" checked={formData.is_active} onCheckedChange={c => setFormData(p => ({...p, is_active: c}))} /><Label htmlFor="is_active">Active</Label></div>
                <div className="flex items-center space-x-2"><Checkbox id="is_popular" name="is_popular" checked={formData.is_popular} onCheckedChange={c => setFormData(p => ({...p, is_popular: c}))} /><Label htmlFor="is_popular">Most Popular</Label></div>
                <div className="flex items-center space-x-2"><Checkbox id="is_intro_offer" name="is_intro_offer" checked={formData.is_intro_offer} onCheckedChange={c => setFormData(p => ({...p, is_intro_offer: c}))} /><Label htmlFor="is_intro_offer">Intro Offer</Label></div>
                <div className="flex items-center space-x-2"><Checkbox id="is_annual_only" name="is_annual_only" checked={formData.is_annual_only} onCheckedChange={c => setFormData(p => ({...p, is_annual_only: c}))} /><Label htmlFor="is_annual_only">Annual Only</Label></div>
            </div>
            <DialogFooter className="col-span-2">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Package</Button>
            </DialogFooter>
        </form>
    );
};


const AdminSponsorshipPackagesPage = () => {
    const [packages, setPackages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPackage, setEditingPackage] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const fetchPackages = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('packages').select('*').order('sort_order', { ascending: true });
        if (error) {
            toast({ title: 'Error fetching packages', description: error.message, variant: 'destructive' });
        } else {
            setPackages(data);
        }
        setIsLoading(false);
    }, [toast]);

    useEffect(() => { fetchPackages(); }, [fetchPackages]);

    const handleSavePackage = async (formData) => {
        setIsSaving(true);
        const { id, ...upsertData } = formData;
        
        const query = id 
            ? supabase.from('packages').update(upsertData).eq('id', id)
            : supabase.from('packages').insert([upsertData]);

        const { error } = await query.select();
        
        if (error) {
            toast({ title: 'Error saving package', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Package Saved!', description: `"${formData.name}" has been successfully saved.` });
            setIsFormOpen(false);
            setEditingPackage(null);
            fetchPackages();
        }
        setIsSaving(false);
    };

    const handleDeletePackage = async (packageToDelete) => {
        if (!packageToDelete) return;
        const { error } = await supabase.from('packages').delete().eq('id', packageToDelete.id);
        if (error) {
            toast({ title: 'Error deleting package', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Package Deleted', description: `"${packageToDelete.name}" has been deleted.` });
            fetchPackages();
        }
    };

    const openForm = (pkg = null) => {
        setEditingPackage(pkg);
        setIsFormOpen(true);
    };

    return (
        <>
            <Helmet><title>Admin: Sponsorship Packages</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="container mx-auto px-4 py-6">
                    <div className="flex items-center justify-between mb-4">
                        <AdminBackButton />
                        <div className="text-center flex-1">
                            <h1 className="text-2xl md:text-3xl font-bold">Sponsorship Packages</h1>
                            <p className="text-sm text-muted-foreground">Manage sponsorship tiers and pricing.</p>
                        </div>
                        <Button onClick={() => openForm()}><PlusCircle className="mr-2 h-4 w-4" /> Add Package</Button>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-20"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {packages.map(pkg => (
                                <Card key={pkg.id} className="flex flex-col">
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <CardTitle>{pkg.name}</CardTitle>
                                            <div className={`w-3 h-3 rounded-full ${pkg.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                        </div>
                                        <CardDescription>
                                            {pkg.is_annual_only 
                                                ? `$${(pkg.annual_price / 100).toLocaleString()}/year` 
                                                : pkg.base_price 
                                                    ? `$${(pkg.base_price / 100).toLocaleString()}/mo`
                                                    : 'Contact for price'
                                            }
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                            {(pkg.features || []).map((f, i) => <li key={i}>{f}</li>)}
                                        </ul>
                                    </CardContent>
                                    <CardFooter className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openForm(pkg)}><Edit className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete the "{pkg.name}" package. This action cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeletePackage(pkg)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                    {packages.length === 0 && !isLoading && <div className="text-center py-20 text-muted-foreground">No sponsorship packages found. Click "Add Package" to create one.</div>}
                </main>
            </div>
            
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingPackage ? 'Edit' : 'Create'} Sponsorship Package</DialogTitle>
                        <DialogDescription>Fill in the details for the sponsorship tier.</DialogDescription>
                    </DialogHeader>
                    <PackageForm packageData={editingPackage} onSave={handleSavePackage} onCancel={() => setIsFormOpen(false)} isSaving={isSaving} />
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AdminSponsorshipPackagesPage;