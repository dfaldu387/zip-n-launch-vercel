import React from 'react';
import { File, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AssetFile = ({ file, onDownload }) => (
    <div className="flex items-center justify-between p-2 rounded-md bg-background/50 hover:bg-background transition-colors">
        <span className="flex items-center text-sm font-medium">
            <File className="mr-2 h-4 w-4 text-primary" />
            {file.name}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDownload(file)}>
            <Download className="h-4 w-4 text-muted-foreground" />
        </Button>
    </div>
);

export const AssetList = ({ files, onDownload }) => {
    if (!files || files.length === 0) {
        return <p className="text-muted-foreground text-xs text-center p-2">No assets uploaded yet.</p>;
    }
    return (
        <div className="space-y-1">
            {(files || []).map(file => <AssetFile key={file.id} file={file} onDownload={onDownload} />)}
        </div>
    );
};