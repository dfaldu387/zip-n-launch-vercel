import React, { useMemo, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

const PatternTagDisplay = ({ selectedDivisions, onRemoveTag }) => {
  const { toast } = useToast();
  const [associationsData, setAssociationsData] = useState([]);

  useEffect(() => {
    const fetchAssociations = async () => {
        const { data, error } = await supabase.from('associations').select('*');
        if (error) {
            toast({ title: 'Error fetching associations', description: error.message, variant: 'destructive' });
        } else {
            setAssociationsData(data);
        }
    };
    fetchAssociations();
  }, [toast]);

  const getAssociationName = (assocId) => {
    const assoc = associationsData.find(a => a.id === assocId);
    return assoc ? assoc.name.split(' - ')[0] : assocId;
  };

  if (!selectedDivisions || Object.keys(selectedDivisions).length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {Object.entries(selectedDivisions).map(([assocId, levels]) => (
        levels.length > 0 && (
          <div key={assocId} className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground mr-2">{getAssociationName(assocId)}:</span>
            {levels.map(level => (
              <Badge key={level} variant="outline" className="font-normal text-xs py-0.5 pl-2 pr-1">
                <span className="mr-1">{level}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 rounded-full"
                  onClick={() => onRemoveTag(assocId, level)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )
      ))}
    </div>
  );
};

export default PatternTagDisplay;