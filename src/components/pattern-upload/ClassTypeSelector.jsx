import React from 'react';
import { motion } from 'framer-motion';
import { PlusCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';

const DISCIPLINE_OPTIONS = [
  'Custom Patterns (AQHA)',
  'English Trail',
];

const ClassTypeSelector = ({ classType, setClassType, customClassType, setCustomClassType }) => {
  const isCustomDiscipline = classType === 'new-discipline';

  return (
    <div className="space-y-2">
      <Label htmlFor="classType" className="font-semibold">Discipline Type</Label>
      <Select value={classType} onValueChange={setClassType}>
        <SelectTrigger id="classType" className="w-full">
          <SelectValue placeholder="Select a discipline type" />
        </SelectTrigger>
        <SelectContent>
          {DISCIPLINE_OPTIONS.map(type => (
            <SelectItem key={type} value={type}>{type}</SelectItem>
          ))}
          {/* Hidden temporarily — "New Discipline" option preserved for future use
          <SelectSeparator />
          <SelectItem value="new-discipline">
            <div className="flex items-center">
              <PlusCircle className="mr-2 h-4 w-4" /> New Discipline...
            </div>
          </SelectItem>
          */}
        </SelectContent>
      </Select>
      {/* Hidden temporarily — custom discipline input preserved for future use
      {isCustomDiscipline && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.2 }}>
          <Input
            value={customClassType}
            onChange={(e) => setCustomClassType(e.target.value)}
            placeholder="Enter custom discipline name"
            className="mt-2"
          />
        </motion.div>
      )}
      */}
    </div>
  );
};

export default ClassTypeSelector;
