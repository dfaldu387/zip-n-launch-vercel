import React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wand2, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const MediaGrid = ({ media, onSelect, currentSelectionId }) => {
    return (
        <div className="grid grid-cols-3 gap-2">
            {media.map((item) => (
                <div
                    key={item.id}
                    className="relative group cursor-pointer"
                    onClick={() => onSelect(item)}
                >
                    <div className={`aspect-video rounded-md bg-secondary overflow-hidden ring-2 ${currentSelectionId === item.id ? 'ring-primary' : 'ring-transparent group-hover:ring-primary/50'} transition-all`}>
                        <img src={item.file_url} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    {currentSelectionId === item.id && (
                        <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                            <CheckCircle className="h-4 w-4 text-primary-foreground" />
                        </div>
                    )}
                    <p className="text-xs text-center mt-1 truncate" title={item.name}>{item.name}</p>
                </div>
            ))}
        </div>
    );
};

const MediaSelector = ({ targetId, label, description, currentAssignment, availableMedia, onAssignmentChange, defaultImage }) => {
  const { toast } = useToast();

  const handleSelect = (mediaItem) => {
    onAssignmentChange(targetId, mediaItem);
  };
  
  const handleDefaultSelect = () => {
    onAssignmentChange(targetId, { id: null, file_url: defaultImage });
  };
  
  const handleAISuggest = () => {
    toast({
        title: "AI Suggestions",
        description: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    })
  }

  const hasMedia = (category) => {
      if (!category) return false;
      if (Array.isArray(category)) return category.length > 0;
      return Object.values(category).some(subCat => Array.isArray(subCat) && subCat.length > 0);
  }

  return (
    <Card className="bg-background/50 border-border/50">
        <CardHeader className="pb-4">
            <CardTitle className="text-lg">{label}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-full sm:w-48 flex-shrink-0">
                <div className="aspect-video rounded-lg bg-secondary overflow-hidden">
                    <img src={currentAssignment?.url || defaultImage} alt={`Current preview for ${label}`} className="w-full h-full object-cover" />
                </div>
            </div>
            <div className="flex-grow w-full">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal truncate">
                            <span className="truncate">{currentAssignment?.id ? availableMedia.GeneralMedia.find(m=>m.id === currentAssignment.id)?.name || 'Custom Selection' : 'Default Image'}</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0" align="start">
                        <div className="p-4 flex justify-between items-center border-b">
                            <h4 className="font-medium">Select Media</h4>
                            <Button variant="ghost" size="sm" onClick={handleAISuggest}><Wand2 className="h-4 w-4 mr-2" /> AI Suggest</Button>
                        </div>
                        <Tabs defaultValue="backgrounds" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="backgrounds" disabled={!hasMedia(availableMedia.Backgrounds)}>Backgrounds</TabsTrigger>
                                <TabsTrigger value="patterns" disabled={!hasMedia(availableMedia.PatternMedia)}>Patterns</TabsTrigger>
                                <TabsTrigger value="general" disabled={!hasMedia(availableMedia.GeneralMedia)}>General</TabsTrigger>
                            </TabsList>
                            <ScrollArea className="h-72">
                                <TabsContent value="backgrounds" className="p-4">
                                    <div className="space-y-4">
                                        {Object.entries(availableMedia.Backgrounds || {}).map(([subCat, media]) =>
                                            media.length > 0 && (
                                                <div key={subCat}>
                                                    <h5 className="font-semibold text-sm mb-2">{subCat}</h5>
                                                    <MediaGrid media={media} onSelect={handleSelect} currentSelectionId={currentAssignment?.id} />
                                                </div>
                                            )
                                        )}
                                    </div>
                                </TabsContent>
                                <TabsContent value="patterns" className="p-4">
                                     <div className="space-y-4">
                                        {Object.entries(availableMedia.PatternMedia || {}).map(([subCat, media]) =>
                                            media.length > 0 && (
                                                <div key={subCat}>
                                                    <h5 className="font-semibold text-sm mb-2">{subCat}</h5>
                                                    <MediaGrid media={media} onSelect={handleSelect} currentSelectionId={currentAssignment?.id} />
                                                </div>
                                            )
                                        )}
                                    </div>
                                </TabsContent>
                                <TabsContent value="general" className="p-4">
                                    <MediaGrid media={availableMedia.GeneralMedia || []} onSelect={handleSelect} currentSelectionId={currentAssignment?.id} />
                                </TabsContent>
                            </ScrollArea>
                        </Tabs>
                         <div className="p-2 border-t text-center">
                            <Button variant="ghost" size="sm" onClick={handleDefaultSelect}>Reset to Default</Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </CardContent>
    </Card>
  );
};

export default MediaSelector;