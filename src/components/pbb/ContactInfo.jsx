import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

export const ContactInfo = ({ official, onUpdate, children }) => {
  const [availableRoles, setAvailableRoles] = React.useState([]);
  const [name, setName] = React.useState(official.name || '');
  const [email, setEmail] = React.useState(official.email || '');
  const [phone, setPhone] = React.useState(official.phone || '');
  const [selectedRole, setSelectedRole] = React.useState(official.roleId || '');
  const [isOpen, setIsOpen] = React.useState(false);
  const [isCheckingUser, setIsCheckingUser] = React.useState(false);
  const [existingUser, setExistingUser] = React.useState(null);
  const { toast } = useToast();

  // Fetch roles from Supabase on mount
  React.useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from('roles')
          .select('role_code, name')
          .order('name');
        
        if (error) throw error;
        
        if (data) {
          const rolesOptions = data.map(role => ({
            value: role.role_code,
            label: role.name
          }));
          setAvailableRoles(rolesOptions);
        }
      } catch (error) {
        console.error('Error fetching roles:', error);
        toast({
          title: 'Error',
          description: 'Failed to load roles',
          variant: 'destructive'
        });
      }
    };
    
    fetchRoles();
  }, [toast]);

  const checkUserExists = async (emailValue) => {
    if (!emailValue || !emailValue.includes('@')) return;
    
    setIsCheckingUser(true);
    try {
      // Check if user exists in profiles table
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('email', emailValue)
        .single();

      if (profiles && !error) {
        setExistingUser(profiles);
        setName(profiles.full_name || name);
        toast({
          title: 'User Found',
          description: `Found existing user: ${profiles.full_name}`,
        });
      } else {
        setExistingUser(null);
      }
    } catch (error) {
      console.error('Error checking user:', error);
      setExistingUser(null);
    } finally {
      setIsCheckingUser(false);
    }
  };

  const handleEmailBlur = () => {
    if (email !== official.email) {
      checkUserExists(email);
    }
  };

  const handleSave = async () => {
    const roleName = availableRoles.find(r => r.value === selectedRole)?.label || official.role;
    
    // Capture current values before any async operations
    const currentName = name;
    const currentEmail = email;
    const currentPhone = phone;
    
    // If user doesn't exist and email is provided, create the user
    if (!existingUser && currentEmail && currentEmail.includes('@')) {
      try {
        const { data, error } = await supabase.functions.invoke('create-staff-user', {
          body: {
            email: currentEmail,
            name: currentName,
            role: roleName
          }
        });

        if (error) throw error;

        if (data?.created) {
          toast({
            title: 'User Created',
            description: `New user account created for ${currentName}. Login credentials sent to ${currentEmail}.`,
          });
        }
      } catch (error) {
        console.error('Error creating user:', error);
        toast({
          title: 'Error',
          description: 'Failed to create user account. Contact information saved.',
          variant: 'destructive'
        });
      }
    }

    const updatedOfficial = {
      ...official,
      name: currentName,
      email: currentEmail,
      phone: currentPhone,
      roleId: selectedRole,
      role: roleName,
      existingUserId: existingUser?.id,
    };
    
    // Close dialog first, then update to avoid state sync issues
    setIsOpen(false);
    onUpdate(updatedOfficial);
  };

  React.useEffect(() => {
    setName(official.name || '');
    setEmail(official.email || '');
    setPhone(official.phone || '');
    setSelectedRole(official.roleId || '');
    setExistingUser(null);
  }, [official, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Contact Info</DialogTitle>
          <DialogDescription>
            Add or update the contact details for this staff member. System will check if they're an existing user.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="Full Name"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <div className="col-span-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={handleEmailBlur}
                  className="flex-1"
                  placeholder="name@example.com"
                />
                {isCheckingUser && <Loader2 className="w-4 h-4 animate-spin mt-2" />}
              </div>
              {existingUser && (
                <Badge variant="outline" className="text-xs">
                  ✓ Existing user found
                </Badge>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">
              Phone
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="col-span-3"
              placeholder="(555) 123-4567"
            />
          </div>

          {existingUser && existingUser.role && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs text-muted-foreground">
                Current Role
              </Label>
              <div className="col-span-3">
                <Badge variant="secondary">{existingUser.role}</Badge>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isCheckingUser}>
            {isCheckingUser ? 'Checking...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};