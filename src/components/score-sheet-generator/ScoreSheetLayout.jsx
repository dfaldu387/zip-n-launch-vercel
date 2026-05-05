import React from 'react';
import { motion } from 'framer-motion';
import DynamicManeuverText from './DynamicManeuverText';

const ManeuverBox = ({ number, text }) => (
  <div className="relative border-2 border-black flex flex-col h-full bg-white">
    <div className="absolute -top-2.5 -left-2.5 bg-white px-0.5 z-10">
      <span className="text-red-600 font-bold text-base">{number}</span>
    </div>
    <div className="flex-grow p-1.5 pt-3">
      {text && <DynamicManeuverText text={text} />}
    </div>
    <div className="border-t-2 border-black h-7 flex items-center justify-end pr-2">
      <span className="text-[10px] text-gray-400 mr-1">Score</span>
      <span className="border-b border-gray-300 inline-block w-12" />
    </div>
  </div>
);

const ScoreSheetLayout = ({ steps = {}, patternInfo = {}, template = null }) => {
  const maxSteps = 15;
  const boxes = Array.from({ length: maxSteps }, (_, i) => i + 1);

  return (
    <motion.div
      key={template ? template.path : 'default'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-gray-300 p-4 aspect-[8.5/11] w-full max-w-4xl mx-auto shadow-lg printable-area relative"
    >
      {template ? (
        <img-replace src={template.path} alt={`${patternInfo.association} ${patternInfo.className} Score Sheet`} className="absolute inset-0 w-full h-full object-contain" />
      ) : (
        <div className="bg-white w-full h-full" />
      )}

      <div className="absolute inset-0 p-4 flex flex-col">
        <header className="text-center mb-2 shrink-0">
          <h1 className="text-2xl font-bold leading-tight">
            {patternInfo.className || 'Equipatterns'}
          </h1>
          {patternInfo.patternName && (
            <h2 className="text-lg leading-tight">{patternInfo.patternName}</h2>
          )}
          <p className="text-xs text-gray-500 uppercase tracking-wide mt-0.5">Score Sheet</p>
        </header>

        <div className="grid grid-cols-3 grid-rows-5 gap-2 flex-grow min-h-0">
          {boxes.map(boxNumber => (
            <ManeuverBox key={boxNumber} number={boxNumber} text={steps[boxNumber] || ''} />
          ))}
        </div>

        {/* Penalty / Total row */}
        <div className="grid grid-cols-2 gap-2 mt-2 shrink-0">
          <div className="border-2 border-black bg-white h-8 flex items-center px-2">
            <span className="font-bold text-sm">Penalties:</span>
          </div>
          <div className="border-2 border-black bg-white h-8 flex items-center px-2">
            <span className="font-bold text-sm">Total Score:</span>
          </div>
        </div>

        <footer className="flex justify-between text-[10px] text-gray-500 mt-1.5 shrink-0">
          <p>Judge's Signature: _________________________</p>
          <p>Date: ______________</p>
        </footer>
      </div>
    </motion.div>
  );
};

export default ScoreSheetLayout;
