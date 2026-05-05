import React from 'react';
import { File as FileIcon, Tag, Type, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const MediaItem = ({ item, onDelete }) => (
  <div className="flex items-center justify-between p-2 rounded-md bg-background/70 border border-border text-sm hover:bg-secondary/20 transition-colors group">
    <div className="flex flex-col gap-1 overflow-hidden">
      <span className="font-medium flex items-center truncate">
        <FileIcon className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
        <span className="truncate" title={item.name}>{item.name}</span>
      </span>
      {item.alt_text && (
        <span className="text-xs text-muted-foreground ml-6 flex items-center truncate">
          <Type className="h-3 w-3 mr-1 flex-shrink-0" /> <span className="truncate" title={item.alt_text}>Alt: {item.alt_text}</span>
        </span>
      )}
      {item.tags && item.tags.length > 0 && (
        <div className="text-xs text-muted-foreground ml-6 flex items-center gap-1 flex-wrap">
          <Tag className="h-3 w-3 mr-1 flex-shrink-0" /> 
          {item.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
        </div>
      )}
    </div>
    {onDelete && (
        <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id, item.file_url);
            }}
        >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
        </Button>
    )}
  </div>
);

export default MediaItem;