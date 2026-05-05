import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Edit, User, CheckSquare } from 'lucide-react';

const ScribeKioskPage = () => {
  return (
    <>
      <Helmet>
        <title>Scribe Kiosk - EquiPatterns</title>
      </Helmet>
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-4xl text-center"
        >
          <header className="mb-12">
            <h1 className="text-6xl font-bold mb-2">Scribe Station: Arena 1</h1>
            <p className="text-3xl text-gray-400">Class: Open Trail</p>
          </header>

          <main className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="bg-gray-800 p-8 rounded-lg">
              <h2 className="text-4xl font-bold mb-4 flex items-center"><User className="mr-3 h-10 w-10" /> Current Exhibitor</h2>
              <div className="text-2xl space-y-2">
                <p>Back #: <span className="font-bold text-yellow-400">245</span></p>
                <p>Horse: Zips Hot Chocolate</p>
              </div>
            </div>
            <div className="bg-gray-800 p-8 rounded-lg">
              <h2 className="text-4xl font-bold mb-4 flex items-center"><CheckSquare className="mr-3 h-10 w-10" /> Scribe Actions</h2>
              <div className="text-2xl space-y-4">
                <p>Score Sheet: <span className="text-green-400 font-semibold">Active</span></p>
                <button className="text-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg w-full">
                  Mark Completion Notes
                </button>
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

export default ScribeKioskPage;