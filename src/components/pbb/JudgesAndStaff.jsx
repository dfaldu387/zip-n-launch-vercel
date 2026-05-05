import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Award, Users, Contact2, ChevronsUpDown, Check, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { ContactInfo } from './ContactInfo';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const staffRoles = [
    { id: 'show_manager', name: 'Show Manager' },
    { id: 'show_secretary', name: 'Show Secretary' },
    { id: 'office_assistant', name: 'Office Assistant', allowMultiple: true },
    { id: 'show_steward', name: 'Show Steward', allowMultiple: true },
    { id: 'trail_course_designer', name: 'Trail Course Designer' },
    { id: 'jump_course_designer', name: 'Jump Course Designer' },
    { id: 'scribe_ring_steward', name: 'Scribe/Ring Steward', allowMultiple: true },
    { id: 'equipment_provider', name: 'Equipment Provider', allowMultiple: true, subCategories: ['General Equipment', 'Jump Equipment', 'Trail Equipment'] },
];

const OtherOfficialsList = ({ officials, onUpdate, isClinicMode, isEducationMode, isReadOnly = false }) => {
    const [open, setOpen] = useState(false);

    const handleRoleSelect = (roleId) => {
        const role = staffRoles.find(r => r.id === roleId);
        if (!role) return;

        const isAlreadyAdded = officials.some(o => o.roleId === roleId);

        if (role.allowMultiple) {
            const newOfficial = {
                id: `${roleId}_${Date.now()}`,
                roleId: role.id,
                role: role.name,
                name: '',
                email: '',
                phone: '',
                subCategory: role.subCategories ? role.subCategories[0] : undefined
            };
            onUpdate('officials', [...officials, newOfficial]);
        } else if (!isAlreadyAdded) {
            const newOfficial = {
                id: role.id,
                roleId: role.id,
                role: role.name,
                name: '',
                email: '',
                phone: '',
                subCategory: role.subCategories ? role.subCategories[0] : undefined
            };
            onUpdate('officials', [...officials, newOfficial]);
        }
        setOpen(false);
    };

    const handleAddAnother = (roleId) => {
        handleRoleSelect(roleId);
    };

    const handleRemoveItem = (id) => {
        onUpdate('officials', officials.filter(o => o.id !== id));
    };
    
    const handleContactUpdate = (id, updatedOfficial) => {
        onUpdate('officials', officials.map(o => o.id === id ? updatedOfficial : o));
    };

    const handleFieldChange = (id, field, value) => {
        onUpdate('officials', officials.map(o => o.id === id ? { ...o, [field]: value } : o));
    };

    const mode = isClinicMode ? 'clinic' : isEducationMode ? 'education' : 'show';
    const staffTitle = {
        show: 'Other Show Staff',
        clinic: 'Other Clinic Staff',
        education: 'Other Contributors'
    };

    if (mode !== 'show') {
         // Fallback for clinic/education mode - simple add
        const handleSimpleAdd = () => {
            if (isReadOnly) return;
            onUpdate('officials', [...officials, { role: '', name: '', email: '', phone: '' }]);
        };
        const handleSimpleChange = (index, field, value) => {
            if (isReadOnly) return;
            const newOfficials = [...officials];
            newOfficials[index] = { ...newOfficials[index], [field]: value };
            onUpdate('officials', newOfficials);
        };
        const handleSimpleRemove = (index) => {
            if (isReadOnly) return;
            onUpdate('officials', officials.filter((_, i) => i !== index));
        };

        return (
             <Card className="bg-background/50">
                <CardHeader>
                    <CardTitle className="flex items-center text-base"><Users className="mr-2 h-5 w-5 text-primary" /> {staffTitle[mode]}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                    {officials.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center">
                        <Input
                            value={item.role}
                            onChange={(e) => handleSimpleChange(index, 'role', e.target.value)}
                            placeholder={mode === 'clinic' ? "Role (e.g., Organizer)" : "Role (e.g., Co-author, Editor)"}
                            className="bg-background"
                            disabled={isReadOnly}
                        />
                        <Input
                            value={item.name}
                            onChange={(e) => handleSimpleChange(index, 'name', e.target.value)}
                            placeholder="Name"
                            className="bg-background"
                            disabled={isReadOnly}
                        />
                        {!isReadOnly && (
                            <Button variant="ghost" size="icon" onClick={() => handleSimpleRemove(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        )}
                        </div>
                    ))}
                    </div>
                    {!isReadOnly && (
                        <Button variant="outline" size="sm" className="w-full" onClick={handleSimpleAdd}>
                            <PlusCircle className="h-4 w-4 mr-2" /> Add Staff Member
                        </Button>
                    )}
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card className="bg-background/50">
            <CardHeader>
                <CardTitle className="flex items-center text-base"><Users className="mr-2 h-5 w-5 text-primary" /> {staffTitle[mode]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 {!isReadOnly && (
                     <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="default" role="combobox" aria-expanded={open} className="w-full justify-between">
                                Add Staff Member...
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Select role for staff member..." />
                                <CommandEmpty>No role found.</CommandEmpty>
                                <CommandGroup>
                                    {staffRoles.map((role) => {
                                        const isSelected = officials.some(o => o.roleId === role.id);
                                        const disabled = isSelected && !role.allowMultiple;
                                        return (
                                            <CommandItem
                                                key={role.id}
                                                value={role.name}
                                                onSelect={() => handleRoleSelect(role.id)}
                                                disabled={disabled}
                                                className={cn(disabled && "opacity-50 cursor-not-allowed")}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", (isSelected && !role.allowMultiple) ? "opacity-100" : "opacity-0")}/>
                                                {role.name}
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </Command>
                        </PopoverContent>
                    </Popover>
                 )}

                <div className="space-y-4">
                    {officials.map((official) => {
                        const roleInfo = staffRoles.find(r => r.id === official.roleId);
                        return (
                            <div key={official.id} className="p-3 border rounded-md bg-background/70 space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="font-semibold">{official.role}</Label>
                                    {!isReadOnly && (
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(official.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>
                                <div className="flex gap-2 items-center">
                                    <Input
                                        value={official.name}
                                        onChange={(e) => handleFieldChange(official.id, 'name', e.target.value)}
                                        placeholder="Name"
                                        className="bg-background"
                                        disabled={isReadOnly}
                                    />
                                    {!isReadOnly && (
                                        <ContactInfo official={official} onUpdate={(updated) => handleContactUpdate(official.id, updated)}>
                                            <Button variant="ghost" size="icon" title="Edit Contact Info" className="hover:bg-primary/10">
                                                <Pencil className="h-4 w-4 text-primary" />
                                            </Button>
                                        </ContactInfo>
                                    )}
                                </div>
                                {roleInfo?.subCategories && (
                                     <Select value={official.subCategory} onValueChange={(value) => handleFieldChange(official.id, 'subCategory', value)} disabled={isReadOnly}>
                                        <SelectTrigger disabled={isReadOnly}><SelectValue placeholder="Select equipment type..." /></SelectTrigger>
                                        <SelectContent>
                                            {roleInfo.subCategories.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        );
                    })}
                     {!isReadOnly && staffRoles.filter(role => role.allowMultiple && officials.some(o => o.roleId === role.id)).map(role => (
                        <Button key={`add-another-${role.id}`} variant="outline" size="sm" className="w-full" onClick={() => handleAddAnother(role.id)}>
                            <PlusCircle className="h-4 w-4 mr-2" /> Add another {role.name}
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export const JudgesAndStaff = ({ formData, setFormData, selectedAssociationIds, isClinicMode = false, isEducationMode = false, isReadOnly = false }) => {
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

  const handleJudgeCountChange = (assocId, count) => {
    if (isReadOnly) return;
    const newCount = parseInt(count, 10) || 0;
    setFormData(prev => {
      const currentAssocJudges = (prev.associationJudges && prev.associationJudges[assocId]) || { count: 0, judges: [] };
      const newJudges = Array.from({ length: newCount }, (_, i) => currentAssocJudges.judges[i] || { name: '', email: '', phone: '' });
      return {
        ...prev,
        associationJudges: {
          ...prev.associationJudges,
          [assocId]: {
            ...currentAssocJudges,
            count: newCount,
            judges: newJudges,
          },
        },
      };
    });
  };

  const handleJudgeChange = (assocId, index, field, value) => {
    if (isReadOnly) return;
    setFormData(prev => {
      const newJudges = [...((prev.associationJudges && prev.associationJudges[assocId]?.judges) || [])];
      const currentJudge = newJudges[index] || {};
      newJudges[index] = { ...currentJudge, [field]: value };
      
      // Auto-fill email and phone if name matches a judge in another association (case-sensitive)
      if (field === 'name' && value && value.trim()) {
        const enteredName = value.trim();
        
        // Search through all other associations for a judge with the same name (case-sensitive match)
        if (prev.associationJudges) {
          Object.keys(prev.associationJudges).forEach(otherAssocId => {
            // Skip the current association
            if (otherAssocId === assocId) return;
            
            const otherJudges = prev.associationJudges[otherAssocId]?.judges || [];
            const matchingJudge = otherJudges.find(judge => 
              judge.name && judge.name.trim() === enteredName
            );
            
            // If found a matching judge with email or phone, auto-fill
            if (matchingJudge && (matchingJudge.email || matchingJudge.phone)) {
              // Only auto-fill if current judge doesn't already have that info
              if (!currentJudge.email && matchingJudge.email) {
                newJudges[index].email = matchingJudge.email;
              }
              if (!currentJudge.phone && matchingJudge.phone) {
                newJudges[index].phone = matchingJudge.phone;
              }
            }
          });
        }
      }
      
      return {
        ...prev,
        associationJudges: {
          ...prev.associationJudges,
          [assocId]: {
            ...(prev.associationJudges && prev.associationJudges[assocId]),
            judges: newJudges,
          },
        },
      };
    });
  };

  const handleJudgeContactUpdate = (assocId, index, updatedJudge) => {
    if (isReadOnly) return;
    setFormData(prev => {
      const newJudges = [...((prev.associationJudges && prev.associationJudges[assocId]?.judges) || [])];
      newJudges[index] = updatedJudge;
      return {
        ...prev,
        associationJudges: {
          ...prev.associationJudges,
          [assocId]: {
            ...(prev.associationJudges && prev.associationJudges[assocId]),
            judges: newJudges,
          },
        },
      };
    });
  };
  
  const handleOfficialsUpdate = (key, value) => {
      if (isReadOnly) return;
      setFormData(prev => ({...prev, [key]: value}));
  };
  
  const mode = isClinicMode ? 'clinic' : isEducationMode ? 'education' : 'show';
  const judgeRoleLabels = {
    show: 'Judges',
    clinic: 'Clinicians',
    education: 'Instructors'
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        {selectedAssociationIds.map(assocId => {
          const assocDetails = associationsData.find(a => a.id === assocId);
          const judgeInfo = (formData.associationJudges && formData.associationJudges[assocId]) || { count: 0, judges: [] };
          return (
            <Card key={assocId} className="bg-background/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center">
                        <Award className="mr-2 h-5 w-5 text-primary" /> {assocDetails?.name || assocId} {judgeRoleLabels[mode]}
                    </div>
                     <Badge variant="secondary">{assocDetails?.id}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Number of {judgeRoleLabels[mode]}</Label>
                  <Select
                    value={String(judgeInfo.count)}
                    onValueChange={(val) => handleJudgeCountChange(assocId, val)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger disabled={isReadOnly}>
                      <SelectValue placeholder={`Select ${judgeRoleLabels[mode].toLowerCase()} count`} />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6].map(num => (
                        <SelectItem key={num} value={String(num)}>{num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {judgeInfo.count > 0 && (
                  <div className="space-y-2 pt-2">
                    <Label>{judgeRoleLabels[mode]} Details</Label>
                    {Array.from({ length: judgeInfo.count }).map((_, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          value={judgeInfo.judges[index]?.name || ''}
                          onChange={(e) => handleJudgeChange(assocId, index, 'name', e.target.value)}
                          placeholder={`${judgeRoleLabels[mode].slice(0,-1)} ${index + 1} Name`}
                          className="bg-background"
                          disabled={isReadOnly}
                        />
                        {!isReadOnly && (
                          <ContactInfo official={judgeInfo.judges[index] || {}} onUpdate={(updated) => handleJudgeContactUpdate(assocId, index, updated)}>
                            <Button variant="ghost" size="icon" title="Edit Contact Info" className="hover:bg-primary/10">
                              <Pencil className="h-4 w-4 text-primary" />
                            </Button>
                          </ContactInfo>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div>
        <OtherOfficialsList
            officials={formData.officials || []}
            onUpdate={handleOfficialsUpdate}
            isClinicMode={isClinicMode}
            isEducationMode={isEducationMode}
            isReadOnly={isReadOnly}
        />
      </div>
    </div>
  );
};