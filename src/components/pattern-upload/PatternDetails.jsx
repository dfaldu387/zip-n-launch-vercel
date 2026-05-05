import React from 'react';
import { Layers } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ClassTypeSelector from './ClassTypeSelector';

const PatternDetails = ({ patternSetName, setPatternSetName, classType, setClassType, customClassType, setCustomClassType }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><Layers className="mr-2 h-6 w-6 text-primary" /> Pattern Set Details</CardTitle>
        <CardDescription>Define the name and class type for your pattern set.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="patternSetName" className="font-semibold">Pattern Set Name</Label>
          <Input id="patternSetName" value={patternSetName} onChange={(e) => setPatternSetName(e.target.value)} placeholder="E.g., Championship Horsemanship Finals 2025" />
        </div>
        <ClassTypeSelector
          classType={classType}
          setClassType={setClassType}
          customClassType={customClassType}
          setCustomClassType={setCustomClassType}
        />
      </CardContent>
    </Card>
  );
};

export default PatternDetails;