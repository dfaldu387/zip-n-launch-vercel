import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Upload, PlusCircle } from 'lucide-react';
import MediaItem from '@/components/MediaItem';

const MediaFolder = ({
  icon,
  title,
  description,
  onUploadClick,
  onAddSubfolder,
  children,
  defaultOpen = false,
  mediaItems = [],
  onDelete,
}) => {
  const IconComponent = icon;
  return (
    <Accordion type="single" collapsible defaultValue={defaultOpen ? 'item-1' : ''}>
      <AccordionItem value="item-1" className="border-b-0">
        <AccordionTrigger className="hover:no-underline bg-secondary/30 hover:bg-secondary/50 rounded-t-lg px-4 py-3">
          <div className="flex items-center space-x-3">
            <IconComponent className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold text-base text-left">{title}</h3>
              <p className="text-xs text-muted-foreground text-left">{description}</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="p-4 bg-background/50 border border-t-0 rounded-b-lg">
          <div className="space-y-4">
            {children}
            {mediaItems.length > 0 && (
              <div className="space-y-2 mt-4">
                {mediaItems.map((item) => (
                  <MediaItem key={item.id} item={item} onDelete={onDelete} />
                ))}
              </div>
            )}
            {onUploadClick && (
              <div className="flex items-center gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={onUploadClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload to {title}
                </Button>
                {onAddSubfolder && (
                   <Button size="sm" variant="ghost" onClick={onAddSubfolder}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Subfolder
                  </Button>
                )}
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default MediaFolder;