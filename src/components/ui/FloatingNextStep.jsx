import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const FloatingNextStep = ({ isVisible, onClick, text, className }) => {
  return (
    <motion.div
      className={cn("fixed bottom-6 right-6 z-50", className)}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: isVisible ? 0 : 100, opacity: isVisible ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
    >
      <Button
        onClick={onClick}
        size="lg"
        className="shadow-2xl animate-pulse-fast"
      >
        <ArrowDown className="mr-2 h-5 w-5" />
        {text}
      </Button>
    </motion.div>
  );
};