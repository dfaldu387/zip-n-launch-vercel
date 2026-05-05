import React, { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const EquipmentPicker = ({ open, onOpenChange, onSelect, excludeIds = [], fetchUserEquipment }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      const results = await fetchUserEquipment(searchTerm);
      setItems(results || []);
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, open, fetchUserEquipment]);

  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setItems([]);
    }
  }, [open]);

  const handleSelect = (item) => {
    onSelect(item);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Select Equipment</DialogTitle>
          <DialogDescription>Search and select from your equipment inventory.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or category..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[300px] mt-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{searchTerm ? 'No equipment matches your search.' : 'No equipment in your inventory yet.'}</p>
              <p className="text-sm mt-2">
                <Link to="/horse-show-manager/equipment" className="text-primary underline" onClick={() => onOpenChange(false)}>
                  Add equipment first
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {items.map(item => {
                const isExcluded = excludeIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => !isExcluded && handleSelect(item)}
                    disabled={isExcluded}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {item.total_qty_owned} {item.unit_type}
                      </Badge>
                      {isExcluded && (
                        <Badge variant="secondary" className="text-xs">Added</Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default EquipmentPicker;
