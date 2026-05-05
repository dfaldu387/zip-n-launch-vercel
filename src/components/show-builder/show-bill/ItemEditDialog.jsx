import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X, PlusCircle } from 'lucide-react';

const ItemEditDialog = ({ item, dayId, arenaId, allClassItems, associationsData, onSave, onClose, unplacedClasses }) => {
  const [title, setTitle] = useState(item?.title || '');
  const [duration, setDuration] = useState(item?.duration || '');
  const [content, setContent] = useState(item?.content || '');
  const [classes, setClasses] = useState(item?.classes || []);
  const [classSearch, setClassSearch] = useState('');

  const availableClasses = useMemo(() => {
    const currentBoxClasses = new Set(classes);
    const available = [
      ...unplacedClasses,
      ...allClassItems.filter(c => currentBoxClasses.has(c.id)),
    ];
    // Deduplicate
    const seen = new Set();
    return available.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [unplacedClasses, allClassItems, classes]);

  const filteredAvailable = useMemo(() => {
    if (!classSearch) return availableClasses.filter(c => !classes.includes(c.id));
    return availableClasses
      .filter(c => !classes.includes(c.id))
      .filter(c => c.name.toLowerCase().includes(classSearch.toLowerCase()));
  }, [availableClasses, classes, classSearch]);

  const handleSave = () => {
    const updates = { title };
    if (item.type === 'break') updates.duration = duration;
    if (item.type === 'custom') updates.content = content;
    if (item.type === 'classBox') updates.classes = classes;
    onSave(dayId, arenaId, item.id, updates);
    onClose();
  };

  const addClass = (classId) => {
    setClasses(prev => [...prev, classId]);
  };

  const removeClass = (classId) => {
    setClasses(prev => prev.filter(id => id !== classId));
  };

  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Edit {item.type === 'classBox' ? 'Class Box' : item.type === 'sectionHeader' ? 'Section Header' : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter title..." />
          </div>

          {item.type === 'break' && (
            <div>
              <Label>Duration</Label>
              <Input value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g., 15 min, 1 hour" />
            </div>
          )}

          {item.type === 'custom' && (
            <div>
              <Label>Content</Label>
              <Input value={content} onChange={e => setContent(e.target.value)} placeholder="Additional details..." />
            </div>
          )}

          {item.type === 'classBox' && (
            <div>
              <Label className="mb-2 block">Classes in this box ({classes.length})</Label>

              {classes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3 p-2 border rounded-md bg-muted/30">
                  {classes.map(classId => {
                    const cls = allClassItems.find(c => c.divisionId === classId);
                    const assoc = associationsData?.find(a => a.id === cls?.assocId);
                    return (
                      <Badge key={classId} variant={assoc?.color || 'secondary'} className="flex items-center gap-1 pr-1">
                        {cls?.name || classId}
                        <button onClick={() => removeClass(classId)} className="ml-1 hover:bg-black/10 rounded-full p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search available classes..." className="pl-8" value={classSearch} onChange={e => setClassSearch(e.target.value)} />
              </div>

              <ScrollArea className="h-[200px] border rounded-md p-2">
                {filteredAvailable.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No available classes</p>
                )}
                <div className="space-y-1">
                  {filteredAvailable.map(cls => {
                    const assoc = associationsData?.find(a => a.id === cls.assocId);
                    return (
                      <button
                        key={cls.id}
                        onClick={() => addClass(cls.id)}
                        className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left text-sm"
                      >
                        <PlusCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{cls.name}</span>
                        {assoc && <Badge variant={assoc.color || 'secondary'} className="text-xs px-1 py-0 ml-auto shrink-0">{assoc.abbreviation}</Badge>}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ItemEditDialog;
