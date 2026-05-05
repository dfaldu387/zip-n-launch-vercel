import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GripVertical, FileText, Eye, Download } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useToast } from '@/components/ui/use-toast';

const SortableItem = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex items-center gap-2 p-3 bg-background border rounded-lg">
      <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
      {children}
    </div>
  );
};

const PacketBuilderPage = () => {
  const { toast } = useToast();
  const [availablePages, setAvailablePages] = useState([
    { id: 'p1', title: 'Trail Pattern 1', type: 'Pattern' },
    { id: 'p2', title: 'Horsemanship Pattern 3', type: 'Pattern' },
    { id: 's1', title: 'Trail Score Sheet', type: 'ScoreSheet' },
    { id: 'p3', title: 'Showmanship Pattern 2', type: 'Pattern' },
  ]);
  const [packetPages, setPacketPages] = useState([]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = active.data.current?.sortable.containerId;
    const overContainer = over.data.current?.sortable.containerId;

    if (activeContainer === overContainer) {
      // Reorder within the same list
      const list = activeContainer === 'available' ? availablePages : packetPages;
      const setList = activeContainer === 'available' ? setAvailablePages : setPacketPages;
      const oldIndex = list.findIndex(item => item.id === active.id);
      const newIndex = list.findIndex(item => item.id === over.id);
      if (oldIndex !== newIndex) {
        setList(arrayMove(list, oldIndex, newIndex));
      }
    } else {
      // Move between lists
      const sourceList = activeContainer === 'available' ? availablePages : packetPages;
      const destList = overContainer === 'available' ? availablePages : packetPages;
      const setSourceList = activeContainer === 'available' ? setAvailablePages : setPacketPages;
      const setDestList = overContainer === 'available' ? setAvailablePages : setPacketPages;
      
      const activeItem = sourceList.find(item => item.id === active.id);
      setSourceList(sourceList.filter(item => item.id !== active.id));
      
      const overIndex = destList.findIndex(item => item.id === over.id);
      const newDestList = [...destList];
      newDestList.splice(overIndex, 0, activeItem);
      setDestList(newDestList);
    }
  };

  const handleAction = (title) => {
    toast({ title: `${title} feature coming soon!` });
  };

  return (
    <>
      <Helmet>
        <title>Packet Builder - EquiPatterns</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-4xl font-extrabold tracking-tight">Packet Builder</h1>
            <p className="text-lg text-muted-foreground">Drag and drop pages to build your custom packet.</p>
          </motion.div>

          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" onClick={() => handleAction('Apply Theme')}><Eye className="mr-2 h-4 w-4" /> Apply Theme</Button>
            <Button variant="outline" onClick={() => handleAction('Preview')}><Eye className="mr-2 h-4 w-4" /> Preview</Button>
            <Button onClick={() => handleAction('Render PDF')}><Download className="mr-2 h-4 w-4" /> Render PDF</Button>
          </div>

          <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card>
                <CardHeader><CardTitle>Available Pages</CardTitle></CardHeader>
                <CardContent>
                  <SortableContext items={availablePages.map(p => p.id)} strategy={verticalListSortingStrategy} id="available">
                    <div className="space-y-2 min-h-[300px]">
                      {availablePages.map(page => (
                        <SortableItem key={page.id} id={page.id}>
                          <FileText className="h-5 w-5 text-primary" />
                          <span className="font-medium">{page.title}</span>
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Packet Content</CardTitle></CardHeader>
                <CardContent>
                  <SortableContext items={packetPages.map(p => p.id)} strategy={verticalListSortingStrategy} id="packet">
                    <div className="space-y-2 min-h-[300px] p-2 border-dashed border-2 rounded-md">
                      {packetPages.map(page => (
                        <SortableItem key={page.id} id={page.id}>
                          <FileText className="h-5 w-5 text-primary" />
                          <span className="font-medium">{page.title}</span>
                        </SortableItem>
                      ))}
                      {packetPages.length === 0 && <p className="text-center text-muted-foreground py-12">Drop pages here</p>}
                    </div>
                  </SortableContext>
                </CardContent>
              </Card>
            </div>
          </DndContext>
        </main>
      </div>
    </>
  );
};

export default PacketBuilderPage;