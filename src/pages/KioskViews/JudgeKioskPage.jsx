import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { FileText, Clock, Users } from 'lucide-react';

const JudgeKioskPage = () => {
  return (
    <>
      <Helmet>
        <title>Judge Kiosk - EquiPatterns</title>
      </Helmet>
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-4xl text-center"
        >
          <header className="mb-12">
            <h1 className="text-6xl font-bold mb-2">Class 101: Open Trail</h1>
            <p className="text-3xl text-gray-400">Current Time: {new Date().toLocaleTimeString()}</p>
          </header>

          <main className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="bg-gray-800 p-8 rounded-lg">
              <h2 className="text-4xl font-bold mb-4 flex items-center"><FileText className="mr-3 h-10 w-10" /> Current Pattern</h2>
              <div className="text-2xl space-y-2">
                <p>Pattern: AQHA Trail Pattern #5</p>
                <p>Status: <span className="text-green-400 font-semibold">In Use</span></p>
              </div>
            </div>
            <div className="bg-gray-800 p-8 rounded-lg">
              <h2 className="text-4xl font-bold mb-4 flex items-center"><Users className="mr-3 h-10 w-10" /> Next Class</h2>
              <div className="text-2xl space-y-2">
                <p>Class 102: Amateur Showmanship</p>
                <p>Starts in: <span className="text-yellow-400 font-semibold">15 minutes</span></p>
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

export default JudgeKioskPage;