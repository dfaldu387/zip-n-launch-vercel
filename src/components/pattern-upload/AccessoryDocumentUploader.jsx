import React from 'react';
import { useDropzone } from 'react-dropzone';
import { Paperclip, Upload, FileText, Trash2, Link2, Wrench, Ruler } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const DocumentCategory = ({ title, icon, type, docs, onAdd, onRemove, onUpdate, patterns, hierarchyOrder, description }) => {
  const onDrop = (acceptedFiles) => {
    acceptedFiles.forEach(file => onAdd(file, type));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'application/msword': ['.doc', '.docx'] },
  });

  const uploadedPatterns = hierarchyOrder.filter(h => patterns[h.id]);
  const categoryDocs = docs.filter(doc => doc.type === type);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold text-lg flex items-center">{icon} {title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <div {...getRootProps()} className={`p-4 border-2 border-dashed rounded-md text-center cursor-pointer hover:border-primary transition-colors ${isDragActive ? 'border-primary bg-primary/10' : ''}`}>
        <input {...getInputProps()} />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Drop files here, or click to upload</p>
      </div>

      {categoryDocs.length > 0 && (
        <div className="space-y-3">
          {categoryDocs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-2 border rounded-md bg-background">
              <FileText className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex-grow">
                <p className="font-medium text-sm truncate">{doc.file.name}</p>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs" disabled={uploadedPatterns.length === 0}>
                    <Link2 className="mr-2 h-3 w-3" />
                    Link ({doc.linkedPatternIds.length})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0">
                  <div className="p-4 space-y-2">
                    <p className="text-sm font-medium">Link to which patterns?</p>
                    {uploadedPatterns.map(h => (
                      <div key={h.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`link-${doc.id}-${h.id}`}
                          checked={doc.linkedPatternIds.includes(h.id)}
                          onCheckedChange={(checked) => {
                            const newLinkedIds = checked
                              ? [...doc.linkedPatternIds, h.id]
                              : doc.linkedPatternIds.filter(pid => pid !== h.id);
                            onUpdate(doc.id, { linkedPatternIds: newLinkedIds });
                          }}
                        />
                        <Label htmlFor={`link-${doc.id}-${h.id}`} className="text-sm font-normal cursor-pointer truncate">
                          {patterns[h.id]?.name || h.title}
                        </Label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => onRemove(doc.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AccessoryDocumentUploader = ({ accessoryDocs, onAdd, onRemove, onUpdate, patterns, hierarchyOrder }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><Paperclip className="mr-2 h-6 w-6 text-primary" /> Accessory Documents</CardTitle>
        <CardDescription>Upload build sheets, equipment lists, or other related documents for your patterns.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <DocumentCategory
          title="Build Sheets (BS)"
          icon={<Ruler className="mr-2 h-5 w-5" />}
          type="build_sheet"
          docs={accessoryDocs}
          onAdd={onAdd}
          onRemove={onRemove}
          onUpdate={onUpdate}
          patterns={patterns}
          hierarchyOrder={hierarchyOrder}
          description="Documents detailing measurements, dimensions, or construction specifics for patterns (e.g., Hunter Hack, Trail)."
        />
        <DocumentCategory
          title="Equipment Lists (EL)"
          icon={<Wrench className="mr-2 h-5 w-5" />}
          type="equipment_list"
          docs={accessoryDocs}
          onAdd={onAdd}
          onRemove={onRemove}
          onUpdate={onUpdate}
          patterns={patterns}
          hierarchyOrder={hierarchyOrder}
          description="Lists of required or suggested equipment for specific patterns or classes."
        />
        <DocumentCategory
          title="Related Documents (AD)"
          icon={<FileText className="mr-2 h-5 w-5" />}
          type="related_document"
          docs={accessoryDocs}
          onAdd={onAdd}
          onRemove={onRemove}
          onUpdate={onUpdate}
          patterns={patterns}
          hierarchyOrder={hierarchyOrder}
          description="Any other supplementary documents relevant to the patterns, such as general notes or additional instructions."
        />
      </CardContent>
    </Card>
  );
};

export default AccessoryDocumentUploader;