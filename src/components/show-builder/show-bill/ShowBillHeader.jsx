import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Pencil, Check } from 'lucide-react';

const ShowBillHeader = ({ header, onUpdateHeader }) => {
  const [isEditing, setIsEditing] = useState(false);

  if (!header) return null;

  return (
    <div className="bg-white dark:bg-card border rounded-lg p-6 mb-4 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Show Bill Header</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        </Button>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Show Name</Label>
            <Input value={header.showName} onChange={e => onUpdateHeader('showName', e.target.value)} placeholder="Show Name" />
          </div>
          <div>
            <Label className="text-xs">Dates</Label>
            <Input value={header.dates} onChange={e => onUpdateHeader('dates', e.target.value)} placeholder="e.g., March 15-17, 2026" />
          </div>
          <div>
            <Label className="text-xs">Venue</Label>
            <Input value={header.venue} onChange={e => onUpdateHeader('venue', e.target.value)} placeholder="Venue Name & Address" />
          </div>
          <div>
            <Label className="text-xs">Judges (comma-separated)</Label>
            <Input
              value={(header.judges || []).join(', ')}
              onChange={e => onUpdateHeader('judges', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="Judge 1, Judge 2"
            />
          </div>
          <div>
            <Label className="text-xs">Additional Info</Label>
            <Input value={header.customText} onChange={e => onUpdateHeader('customText', e.target.value)} placeholder="Additional show information..." />
          </div>
        </div>
      ) : (
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">{header.showName || 'Untitled Show'}</h2>
          {header.dates && <p className="text-muted-foreground">{header.dates}</p>}
          {header.venue && <p className="text-muted-foreground">{header.venue}</p>}
          {header.judges?.length > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Judges:</span> {header.judges.join(', ')}
            </p>
          )}
          {header.customText && <p className="text-sm text-muted-foreground italic">{header.customText}</p>}
        </div>
      )}
    </div>
  );
};

export default ShowBillHeader;
