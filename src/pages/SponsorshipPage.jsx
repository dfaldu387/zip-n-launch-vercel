import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Zap, BarChart, Check, Download, Phone, Eye, Users, FileText, Mail, Tv, Trophy, Loader2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import Footer from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';

const SponsorshipPage = () => {
  const { toast } = useToast();
  const [packages, setPackages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPackages = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        toast({
          title: 'Error fetching sponsorship packages',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setPackages(data);
      }
      setIsLoading(false);
    };

    fetchPackages();
  }, [toast]);

  const placements = [
    { name: 'Homepage Banner', icon: Tv, impressions: '500k/mo', ctr: '0.5%' },
    { name: 'Pattern PDF Cover', icon: FileText, impressions: '48k/mo', ctr: '1.2%' },
    { name: 'Scorecard Frame', icon: Trophy, impressions: '120k/mo', ctr: '0.8%' },
    { name: 'Schedule/Results Pages', icon: BarChart, impressions: '1.2M/mo', ctr: '0.4%' },
    { name: 'Newsletter Masthead', icon: Mail, impressions: '5.2k/send', ctr: '2.5%' },
  ];

  const handleCTAClick = () => {
    // Placeholder — checkout/contact flow to be implemented
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    toast({
      title: "Feature In Progress",
      description: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <div className="bg-background text-foreground">
      <Navigation />

      <main className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl sm:text-6xl font-extrabold text-foreground tracking-tight">
              Be where competitors prepare.
            </h1>
            <p className="mt-4 max-w-3xl mx-auto text-lg sm:text-xl text-muted-foreground">
              Pattern downloads, score sheets, schedules, and results—your brand at every touchpoint.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Button size="lg" onClick={handleCTAClick}>Build My Package</Button>
              <Button size="lg" variant="outline" onClick={handleFormSubmit}>Download Media Kit <Download className="ml-2 h-4 w-4" /></Button>
            </div>
          </motion.div>

          <div className="py-8 px-4 bg-secondary/50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div><p className="text-3xl font-bold text-primary">2.1M</p><p className="text-sm text-muted-foreground">Monthly Impressions</p></div>
              <div><p className="text-3xl font-bold text-primary">48k</p><p className="text-sm text-muted-foreground">Pattern Downloads/mo</p></div>
              <div><p className="text-3xl font-bold text-primary">5.2k</p><p className="text-sm text-muted-foreground">Email Subs (41% Open)</p></div>
              <div><p className="text-3xl font-bold text-primary">37%</p><p className="text-sm text-muted-foreground">Return Users</p></div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-20"
          >
            <h2 className="text-3xl font-bold text-center mb-10">Show, Don't Tell: Our Placements</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {placements.map(p => (
                <Card key={p.name} className="text-center bg-card/50">
                  <CardHeader>
                    <p.icon className="h-8 w-8 mx-auto text-primary mb-2" />
                    <CardTitle className="text-base">{p.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold">{p.impressions}</p>
                    <p className="text-sm text-muted-foreground">Avg. CTR: {p.ctr}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-20 mt-20">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
           ) : (
            <div className="mt-20">
              <h2 className="text-3xl font-bold text-center mb-10">Packages & Pricing</h2>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-stretch">
                {packages.map((pkg, index) => (
                  <motion.div
                    key={pkg.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="flex"
                  >
                    <Card className={`w-full flex flex-col bg-secondary/50 border-2 ${pkg.is_popular ? 'border-primary' : 'border-transparent'}`}>
                      {pkg.is_popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>}
                      {pkg.is_intro_offer && <Badge variant="destructive" className="absolute -top-3 left-1/2 -translate-x-1/2">Intro Offer - 1 Available</Badge>}
                      <CardHeader>
                        <CardTitle className="text-foreground">{pkg.name}</CardTitle>
                        <CardDescription className="text-4xl font-bold text-primary">
                          ${pkg.is_annual_only ? (pkg.annual_price / 100).toLocaleString() : (pkg.base_price / 100).toLocaleString()}
                          <span className="text-sm font-normal text-muted-foreground">/{pkg.is_annual_only ? 'year' : 'mo'}</span>
                        </CardDescription>
                        {!pkg.is_annual_only && pkg.annual_price && <p className="text-xs text-muted-foreground">or ${(pkg.annual_price / 100).toLocaleString()}/year</p>}
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <ul className="space-y-3">
                          {pkg.features.map(feature => (
                            <li key={feature} className="flex items-start gap-3">
                              <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className="text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                      <CardFooter>
                        <Button className="w-full" onClick={handleCTAClick} variant={pkg.is_popular ? 'default' : 'outline'}>
                          {pkg.cta_text || 'Choose Plan'}
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
           )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-20 max-w-4xl mx-auto grid md:grid-cols-2 gap-8"
          >
            <Card className="bg-secondary/50 border-border">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Bespoke Partnerships</CardTitle>
                <CardDescription>For deals over $25,000, let's build something unique together.</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-4">Our team will work with you to create a high-impact package tailored to your marketing goals.</p>
                <Button onClick={handleFormSubmit}><Phone className="mr-2 h-4 w-4" /> Book a Call</Button>
              </CardContent>
            </Card>
            <Card className="bg-secondary/50 border-border">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Have Questions?</CardTitle>
                <CardDescription>Contact our sponsorship team directly for more information.</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-4">We're here to help you understand the opportunities and find the perfect fit for your brand.</p>
                <Button onClick={handleFormSubmit}><Mail className="mr-2 h-4 w-4" /> Contact Us</Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SponsorshipPage;