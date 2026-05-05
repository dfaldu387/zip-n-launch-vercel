import React from 'react';
import { motion } from 'framer-motion';
import { HeartHandshake as Handshake, Building, Users, Briefcase, Mail, Phone, Link as LinkIcon } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import AdminBackButton from '@/components/admin/AdminBackButton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from '@/components/ui/use-toast';

const mockSponsors = [
  { id: 1, name: 'SmartPak', category: 'Tack & Apparel', shows: 5, tier: 'Title Sponsor' },
  { id: 2, name: 'Purina', category: 'Feed', shows: 8, tier: 'Gold Sponsor' },
  { id: 3, name: 'Cinch Jeans', category: 'Apparel', shows: 3, tier: 'Class Sponsor' },
  { id: 4, name: 'Equine Veterinary Associates', category: 'Veterinary', shows: 12, tier: 'Official Vet' },
];

const mockPeople = [
  { id: 1, name: 'Jane Doe', role: 'Show Manager', org: 'Summer Classic Org', email: 'jane.d@example.com', phone: '555-1234' },
  { id: 2, name: 'John Smith', role: 'Course Designer', org: 'Self-employed', email: 'john.s.courses@example.com', phone: null },
  { id: 3, name: 'Emily White', role: 'Show Secretary', org: 'Autumn Gold Futurity', email: 'entries@autumngold.com', phone: '555-5678' },
];

const SponsorshipIntelligencePage = () => {
  const { toast } = useToast();

  const handleActionClick = (message) => {
    toast({
        title: "Feature In Progress",
        description: "🚧 " + message
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
          <Handshake className="mx-auto h-16 w-16 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mt-4 mb-4">Sponsorship Intelligence</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Identify and analyze key sponsors, people, and brands across the horse show industry.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-secondary/50"><CardHeader><CardTitle className="text-sm font-medium">Identified Sponsors</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{mockSponsors.length}</div></CardContent></Card>
            <Card className="bg-secondary/50"><CardHeader><CardTitle className="text-sm font-medium">Key Personnel</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{mockPeople.length}</div></CardContent></Card>
            <Card className="bg-secondary/50"><CardHeader><CardTitle className="text-sm font-medium">Shows Monitored</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">15</div></CardContent></Card>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" /> Top Sponsors & Partners</CardTitle>
              <CardDescription>Organizations frequently identified as sponsors across multiple events.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Organization</TableHead><TableHead>Category</TableHead><TableHead>Events Sponsored</TableHead><TableHead>Highest Tier</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {mockSponsors.map(sponsor => (
                    <TableRow key={sponsor.id}>
                      <TableCell className="font-medium">{sponsor.name}</TableCell>
                      <TableCell><Badge variant="outline">{sponsor.category}</Badge></TableCell>
                      <TableCell>{sponsor.shows}</TableCell>
                      <TableCell>{sponsor.tier}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleActionClick("Viewing sponsor details isn't implemented yet.")}>View Profile</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }} className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Key Personnel & Contacts</CardTitle>
              <CardDescription>Show officials and staff identified from show bills and websites.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Contact</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {mockPeople.map(person => (
                    <TableRow key={person.id}>
                      <TableCell className="font-medium">{person.name}</TableCell>
                      <TableCell><Badge variant="secondary">{person.role}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                            {person.email && <a href={`mailto:${person.email}`} className="flex items-center gap-1 hover:text-primary"><Mail className="h-3 w-3" /> Email</a>}
                            {person.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {person.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleActionClick("Adding contacts isn't implemented yet.")}>Add to Contacts</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>

        <div className="text-center mt-12">
          <AdminBackButton />
        </div>
      </div>
    </div>
  );
};

export default SponsorshipIntelligencePage;