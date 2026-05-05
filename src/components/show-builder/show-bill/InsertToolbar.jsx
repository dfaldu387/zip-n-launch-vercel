import React from 'react';
import { Button } from '@/components/ui/button';
import { Award, Coffee, Tractor, Type, Star, ListPlus } from 'lucide-react';

const InsertToolbar = ({ onInsert, onBulkAdd }) => {
  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-dashed">
      <Button variant="outline" size="sm" onClick={() => onInsert('classBox')}>
        <Award className="h-3.5 w-3.5 mr-1.5" />Class Box
      </Button>
      <Button variant="outline" size="sm" onClick={() => onInsert('break')}>
        <Coffee className="h-3.5 w-3.5 mr-1.5" />Break
      </Button>
      <Button variant="outline" size="sm" onClick={() => onInsert('drag')}>
        <Tractor className="h-3.5 w-3.5 mr-1.5" />Drag
      </Button>
      <Button variant="outline" size="sm" onClick={() => onInsert('sectionHeader')}>
        <Type className="h-3.5 w-3.5 mr-1.5" />Section Header
      </Button>
      <Button variant="outline" size="sm" onClick={() => onInsert('custom')}>
        <Star className="h-3.5 w-3.5 mr-1.5" />Custom
      </Button>
      {onBulkAdd && (
        <Button variant="outline" size="sm" onClick={onBulkAdd} className="ml-auto border-primary/30 text-primary hover:bg-primary/5">
          <ListPlus className="h-3.5 w-3.5 mr-1.5" />Bulk Add
        </Button>
      )}
    </div>
  );
};

export default InsertToolbar;
