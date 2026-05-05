import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, Award, Shield, FileText, User, DollarSign } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const EditableList = ({ title, icon, items, placeholder, onUpdate, fieldKey }) => {
  const handleItemChange = (index, subField, value) => {
    const newItems = [...items];
    newItems[index][subField] = value;
    onUpdate(fieldKey, newItems);
  };
  const handleAddItem = () => {
    const newItems = [...items, { [placeholder.field1]: '', [placeholder.field2]: '' }];
    onUpdate(fieldKey, newItems);
  };
  const handleRemoveItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    onUpdate(fieldKey, newItems);
  };

  return (
    <div className="p-4 border rounded-lg bg-background/50">
        <h4 className="font-semibold flex items-center mb-3">{icon} {title}</h4>
        <div className="space-y-3">
        {items.map((item, index) => (
            <div key={index} className="flex gap-2 items-center">
            <Input value={item[placeholder.field1]} onChange={(e) => handleItemChange(index, placeholder.field1, e.target.value)} placeholder={placeholder.label1} className="bg-background"/>
            {item[placeholder.field2] !== undefined && (
                <Input value={item[placeholder.field2]} onChange={(e) => handleItemChange(index, placeholder.field2, e.target.value)} placeholder={placeholder.label2} className="bg-background"/>
            )}
            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                <Trash2 className="h-4 w-4 text-destructive"/>
            </Button>
            </div>
        ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={handleAddItem}>
            <PlusCircle className="h-4 w-4 mr-2"/> Add {placeholder.label1}
        </Button>
    </div>
  );
};

export const Step4_Officials = ({ formData, setFormData }) => {
  const handleUpdate = (key, value) => {
    setFormData(prev => ({...prev, [key]: value}));
  };

  return (
    <motion.div key="step4" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <CardHeader>
        <CardTitle>Step 4: Officials, Fees & Policies</CardTitle>
        <CardDescription>Review and edit details extracted by the AI, or add them manually.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full">
            <AccordionItem value="item-1">
                <AccordionTrigger className="text-lg font-semibold">Officials</AccordionTrigger>
                <AccordionContent>
                    <EditableList 
                        title="Show Staff"
                        icon={<Award className="mr-2 h-5 w-5 text-primary"/>}
                        items={formData.officials || []}
                        onUpdate={handleUpdate}
                        fieldKey="officials"
                        placeholder={{ field1: 'role', label1: 'Role (e.g., Judge)', field2: 'name', label2: 'Name' }}
                    />
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
                <AccordionTrigger className="text-lg font-semibold">Fees</AccordionTrigger>
                <AccordionContent>
                    <EditableList 
                        title="Entry & Show Fees"
                        icon={<DollarSign className="mr-2 h-5 w-5 text-primary"/>}
                        items={formData.fees || []}
                        onUpdate={handleUpdate}
                        fieldKey="fees"
                        placeholder={{ field1: 'name', label1: 'Fee Name (e.g., Office Fee)', field2: 'amount', label2: 'Amount ($)' }}
                    />
                </AccordionContent>
            </AccordionItem>
             <AccordionItem value="item-3">
                <AccordionTrigger className="text-lg font-semibold">Policies & Marketing</AccordionTrigger>
                <AccordionContent className="space-y-4">
                    <EditableList 
                        title="Show Policies"
                        icon={<FileText className="mr-2 h-5 w-5 text-primary"/>}
                        items={formData.policies || []}
                        onUpdate={handleUpdate}
                        fieldKey="policies"
                        placeholder={{ field1: 'name', label1: 'Policy Title (e.g., Refund Policy)', field2: 'text', label2: 'Policy Details' }}
                    />
                     <div className="p-4 border rounded-lg bg-background/50">
                        <h4 className="font-semibold flex items-center mb-3"><Shield className="mr-2 h-5 w-5 text-primary"/> Marketing Signals</h4>
                         <div className="space-y-3">
                            <div>
                                <Label>Livestream URL</Label>
                                <Input value={formData.marketing?.livestreamUrl || ''} onChange={(e) => handleUpdate('marketing', {...formData.marketing, livestreamUrl: e.target.value})} placeholder="https://youtube.com/live/..." className="bg-background"/>
                            </div>
                             <div>
                                <Label>Event Hashtags</Label>
                                <Input value={formData.marketing?.hashtags || ''} onChange={(e) => handleUpdate('marketing', {...formData.marketing, hashtags: e.target.value})} placeholder="#ShowName #EquiPatterns" className="bg-background"/>
                            </div>
                         </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </CardContent>
    </motion.div>
  );
};