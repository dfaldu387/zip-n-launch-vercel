import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ListPlus } from 'lucide-react';

const BulkAddDialog = ({ open, onOpenChange, onBulkAdd }) => {
  const [text, setText] = useState('');
  const [noPattern, setNoPattern] = useState(false);

  const parsedLines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const handleAdd = () => {
    if (parsedLines.length === 0) return;
    onBulkAdd(parsedLines, { noPattern });
    setText('');
    setNoPattern(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5" />
            Bulk Add Classes
          </DialogTitle>
          <DialogDescription>
            Paste or type class names, one per line. Each line will be created as a separate class entry in the schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="bulk-classes" className="text-sm font-medium">
              Class Names
            </Label>
            <Textarea
              id="bulk-classes"
              placeholder={`Ranch Riding Junior 8-13 Intro\nRanch Riding Junior 8-13 Limited\nRanch Riding Junior 8-13 Advanced\nRanch Riding Senior 14-18 Intro\nShow Hack\nPleasure Driving`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              className="mt-1.5 font-mono text-sm"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="no-pattern"
              checked={noPattern}
              onCheckedChange={setNoPattern}
            />
            <Label htmlFor="no-pattern" className="font-normal text-sm">
              Non-pattern classes (no pattern configuration required)
            </Label>
          </div>

          {parsedLines.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-md border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Preview</span>
                <Badge variant="secondary">{parsedLines.length} classes</Badge>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {parsedLines.map((line, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="font-bold text-primary w-5 text-right">{i + 1}.</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={parsedLines.length === 0}>
            Add {parsedLines.length} {parsedLines.length === 1 ? 'Class' : 'Classes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAddDialog;
