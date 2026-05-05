import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Shield, Key, User, Mail, Phone, Globe, Clock, Lock, Smartphone, AlertCircle, Check, FileText, Eye, Download } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

const AccountSecurityPage = () => {
  const { user, updateUserProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // 2FA States
  const [twoFactorEmail, setTwoFactorEmail] = useState(false);
  const [twoFactorSMS, setTwoFactorSMS] = useState(false);
  const [twoFactorApp, setTwoFactorApp] = useState(false);
  
  // Account Details States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('');
  const [country, setCountry] = useState('');
  
  // Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [backupEmail, setBackupEmail] = useState('');
  const [backupPhone, setBackupPhone] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.user_metadata?.first_name || '');
      setLastName(user.user_metadata?.last_name || '');
      setOrganizationName(user.user_metadata?.organization_name || '');
      setEmail(user.email || '');
      setPhone(user.user_metadata?.phone || '');
      setTimezone(user.user_metadata?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
      setCountry(user.user_metadata?.country || '');
      setBackupEmail(user.user_metadata?.backup_email || '');
      setBackupPhone(user.user_metadata?.backup_phone || '');
      setTwoFactorEmail(user.user_metadata?.two_factor_email || false);
      setTwoFactorSMS(user.user_metadata?.two_factor_sms || false);
      setTwoFactorApp(user.user_metadata?.two_factor_app || false);
    }
  }, [user]);

  const handleSaveAccountDetails = async () => {
    setIsLoading(true);
    try {
      await updateUserProfile({
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        organization_name: organizationName,
        phone,
        timezone,
        country,
      });
      toast({ title: 'Success', description: 'Account details updated successfully.' });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave2FASettings = async () => {
    setIsLoading(true);
    try {
      await updateUserProfile({
        two_factor_email: twoFactorEmail,
        two_factor_sms: twoFactorSMS,
        two_factor_app: twoFactorApp,
      });
      toast({ title: 'Success', description: '2FA settings updated successfully.' });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'New passwords do not match.', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: 'Success', description: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRecoveryOptions = async () => {
    setIsLoading(true);
    try {
      await updateUserProfile({
        backup_email: backupEmail,
        backup_phone: backupPhone,
      });
      toast({ title: 'Success', description: 'Recovery options updated successfully.' });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const timezones = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'Europe/London',
    'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'
  ];

  const countries = [
    'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France',
    'Japan', 'China', 'Brazil', 'Mexico', 'India', 'Other'
  ];

  const governingDocuments = [
    { name: 'Membership Agreement', file: 'membership-agreement.docx' },
    { name: 'Terms of Service', file: 'terms-of-service.docx' },
    { name: 'Privacy Policy', file: 'privacy-policy.docx' },
    { name: 'Payment, Renewal & Refund Policy', file: 'refund-policy.docx' },
    { name: 'Licensing & Intellectual Property Policy', file: 'licensing-ip-policy.docx' },
    { name: 'Electronic Communications Consent', file: 'communications-sms-policy.docx' },
    { name: 'Creator Content Policy', file: 'creator-content-policy.docx' },
    { name: 'Horse Show Management Agreement', file: 'horse-show-management-agreement.docx' },
    { name: 'Pattern Licensing Agreement', file: 'pattern-licensing-agreement.docx' },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Please log in to access account settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Account & Security - EquiPatterns</title>
      </Helmet>
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-8">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Account & Security</h1>
              <p className="text-muted-foreground">Manage your account settings and security preferences</p>
            </div>
          </div>

          <Tabs defaultValue="2fa" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-[650px]">
              <TabsTrigger value="2fa" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                <span className="hidden sm:inline">2-Step Verification</span>
                <span className="sm:hidden">2FA</span>
              </TabsTrigger>
              <TabsTrigger value="account" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Account Details</span>
                <span className="sm:hidden">Account</span>
              </TabsTrigger>
              <TabsTrigger value="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span className="hidden sm:inline">Password & Recovery</span>
                <span className="sm:hidden">Password</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Documents</span>
                <span className="sm:hidden">Docs</span>
              </TabsTrigger>
            </TabsList>

            {/* 2-Step Verification Tab */}
            <TabsContent value="2fa">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Login & 2-Step Verification
                  </CardTitle>
                  <CardDescription>
                    Add an extra layer of security to your account by enabling two-factor authentication
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Email Verification</p>
                        <p className="text-sm text-muted-foreground">Receive codes via email</p>
                      </div>
                    </div>
                    <Switch checked={twoFactorEmail} onCheckedChange={setTwoFactorEmail} />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">SMS Verification</p>
                        <p className="text-sm text-muted-foreground">Receive codes via text message</p>
                      </div>
                    </div>
                    <Switch checked={twoFactorSMS} onCheckedChange={setTwoFactorSMS} />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Authenticator App</p>
                        <p className="text-sm text-muted-foreground">Use Google Authenticator or similar</p>
                      </div>
                    </div>
                    <Switch checked={twoFactorApp} onCheckedChange={setTwoFactorApp} />
                  </div>

                  <Button onClick={handleSave2FASettings} disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save 2FA Settings'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Account Details Tab */}
            <TabsContent value="account">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Account Details
                  </CardTitle>
                  <CardDescription>
                    Update your personal and organization information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organizationName">Organization Name</Label>
                    <Input
                      id="organizationName"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="Enter organization name (optional)"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">Contact support to change email</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="timezone" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Time Zone
                      </Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          {timezones.map((tz) => (
                            <SelectItem key={tz} value={tz}>{tz.replace('_', ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Country
                      </Label>
                      <Select value={country} onValueChange={setCountry}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {countries.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={handleSaveAccountDetails} disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Account Details'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Password & Recovery Tab */}
            <TabsContent value="password">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Change Password
                    </CardTitle>
                    <CardDescription>
                      Update your password to keep your account secure
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                      />
                    </div>
                    <Button onClick={handleChangePassword} disabled={isLoading || !newPassword || !confirmPassword}>
                      {isLoading ? 'Changing...' : 'Change Password'}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Recovery Options
                    </CardTitle>
                    <CardDescription>
                      Set up backup contact methods for account recovery
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="backupEmail">Backup Email</Label>
                      <Input
                        id="backupEmail"
                        type="email"
                        value={backupEmail}
                        onChange={(e) => setBackupEmail(e.target.value)}
                        placeholder="Enter backup email address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="backupPhone">Backup Phone</Label>
                      <Input
                        id="backupPhone"
                        type="tel"
                        value={backupPhone}
                        onChange={(e) => setBackupPhone(e.target.value)}
                        placeholder="Enter backup phone number"
                      />
                    </div>
                    <Button onClick={handleSaveRecoveryOptions} disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Save Recovery Options'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            {/* Documents Tab */}
            <TabsContent value="documents">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Governing Documents
                  </CardTitle>
                  <CardDescription>
                    View and download EquiPatterns governing policies and agreements
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {governingDocuments.map((doc) => (
                      <div
                        key={doc.file}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{doc.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`/documents/governing/${doc.file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-accent transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </a>
                          <a
                            href={`/documents/governing/${doc.file}`}
                            download
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-accent transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
};

export default AccountSecurityPage;
