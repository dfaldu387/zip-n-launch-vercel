import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Mic, List, Users } from 'lucide-react';

const AnnouncerKioskPage = () => {
  return (
    <>
      <Helmet>
        <title>Announcer Kiosk - EquiPatterns</title>
      </Helmet>
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-6xl text-center"
        >
          <header className="mb-12">
            <h1 className="text-6xl font-bold mb-2">Announcer's Booth</h1>
            <p className="text-3xl text-gray-400">Live Schedule & Summaries</p>
          </header>

          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
            <div className="bg-gray-800 p-8 rounded-lg lg:col-span-2">
              <h2 className="text-4xl font-bold mb-4 flex items-center"><Mic className="mr-3 h-10 w-10" /> Now In Arena</h2>
              <div className="text-3xl space-y-2">
                <p>Class: <span className="font-bold text-yellow-400">Open Trail</span></p>
                <p>Pattern Summary: Walk over logs, sidepass, back through L.</p>
                <p>Exhibitors: 15</p>
              </div>
            </div>
            <div className="bg-gray-800 p-8 rounded-lg">
              <h2 className="text-4xl font-bold mb-4 flex items-center"><List className="mr-3 h-10 w-10" /> Order of Go</h2>
              <ul className="text-2xl space-y-2">
                <li>#245 - John Smith</li>
                <li className="text-yellow-400">#301 - Jane Doe (On Deck)</li>
                <li>#112 - Emily Jones (In the Hole)</li>
              </ul>
            </div>
             <div className="bg-gray-800 p-8 rounded-lg lg:col-span-3">
              <h2 className="text-4xl font-bold mb-4 flex items-center"><Users className="mr-3 h-10 w-10" /> Up Next</h2>
              <div className="text-3xl space-y-2">
                <p>Class: Amateur Showmanship</p>
                <p>Starts in: Approx. 25 minutes</p>
              </div>
            </div>
          </main>

          <footer className="mt-12 text-gray-500 text-xl">
            EquiPatterns Kiosk Mode
          </footer>
        </motion.div>
      </div>
    </>
  );
};

export default AnnouncerKioskPage;