import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Facebook, Instagram } from 'lucide-react';
import logoImage from '@/assets/logo.png';

const Footer = () => {
  const associations = [
    { name: 'AQHA', image: 'American Quarter Horse Association logo' },
    { name: 'APHA', image: 'American Paint Horse Association logo' },
    { name: 'NSBA', image: 'National Snaffle Bit Association logo' },
    { name: 'NRHA', image: 'National Reining Horse Association logo' },
    { name: 'USEF', image: 'United States Equestrian Federation logo' },
  ];

  return (
    <footer className="bg-background border-t border-border">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div className="space-y-4 md:col-span-2 lg:col-span-1">
            <Link to="/" className="flex items-center text-foreground">
              <img src={logoImage} alt="EquiPatterns Logo" className="h-12 w-auto" />
            </Link>
            <p className="text-muted-foreground text-sm">
              The Professional Platform for Horse Show Patterns and Event Management.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-muted-foreground hover:text-primary"><Twitter className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary"><Facebook className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary"><Instagram className="h-5 w-5" /></a>
            </div>
          </div>
          <div>
            <p className="font-semibold text-foreground">Quick Links</p>
            <ul className="mt-4 space-y-2">
              <li><Link to="/pattern-hub" className="text-muted-foreground hover:text-primary text-sm">Choose A Pattern</Link></li>
              <li><Link to="/pattern-book-builder" className="text-muted-foreground hover:text-primary text-sm">Pattern Book Builder</Link></li>
              <li><Link to="/events" className="text-muted-foreground hover:text-primary text-sm">Events</Link></li>
              <li><Link to="/events/past" className="text-muted-foreground hover:text-primary text-sm">Past Events</Link></li>
              <li><Link to="/admin" className="text-muted-foreground hover:text-primary text-sm">Admin Portal</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground">Resources</p>
            <ul className="mt-4 space-y-2">
              <li><Link to="/contributor-portal" className="text-muted-foreground hover:text-primary text-sm">Contributor Portal</Link></li>
              <li><Link to="/social-media" className="text-muted-foreground hover:text-primary text-sm">Social Feed</Link></li>
              <li><Link to="/advertisement" className="text-muted-foreground hover:text-primary text-sm">Advertisement</Link></li>
              <li><Link to="/database-schema" className="text-muted-foreground hover:text-primary text-sm">Database Schema</Link></li>
            </ul>
          </div>
          <div>
             <p className="font-semibold text-foreground">Supported Associations</p>
            <div className="flex flex-wrap gap-4 mt-4">
              {associations.map(assoc => (
                <div key={assoc.name} title={assoc.name} className="h-10 w-10 flex items-center justify-center bg-secondary rounded-full text-xs text-muted-foreground">
                  {assoc.name}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-border pt-8 text-center">
          <p className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} EquiPatterns. All Rights Reserved. All patterns are subject to reuse and licensing agreements.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;