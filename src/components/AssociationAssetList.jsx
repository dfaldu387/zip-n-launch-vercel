import React, { useState } from 'react';
import { BookOpen, FileText, UploadCloud, CheckCircle, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { supabase } from '@/lib/supabaseClient';

const PATTERN_NUMBERS = {
    "Western Riding": Array.from({ length: 15 }, (_, i) => i + 1),
    "Ranch Riding": Array.from({ length: 15 }, (_, i) => i + 1),
    "Ranch Reining": Array.from({ length: 6 }, (_, i) => i + 1),
    "Reining": [...Array.from({ length: 13 }, (_, i) => i + 1), 'A', 'B'],
    "Working Cow Horse": Array.from({ length: 12 }, (_, i) => i + 1),
    "Ranch Pleasure": Array.from({ length: 5 }, (_, i) => i + 1),
    "Ranch Horse": Array.from({ length: 3 }, (_, i) => i + 1),
};

const AssetSlot = ({ asset, onUploadClick, assetInfo, onRemoveAsset }) => {
    const hasAsset = !!asset;

    return (
        <div className={cn(
            "p-2 border rounded-md min-h-[70px] space-y-1 bg-background/50 flex flex-col justify-center items-center text-center",
            hasAsset ? "border-green-500/50" : "border-dashed"
        )}>
            {hasAsset ? (
                <>
                    <div className="flex items-center text-green-400">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        <span className="text-xs font-semibold truncate" title={asset.file_name}>{asset.file_name}</span>
                    </div>
                    <div className="flex gap-1">
                        <a href={asset.file_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-6 w-6"><ExternalLink className="h-3 w-3" /></Button>
                        </a>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemoveAsset(asset.id, asset.file_path)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                    </div>
                </>
            ) : (
                <Button variant="ghost" className="w-full h-full text-muted-foreground" onClick={() => onUploadClick(assetInfo)}>
                    <UploadCloud className="h-5 w-5 mr-2" />
                    <span className="text-xs">Upload</span>
                </Button>
            )}
        </div>
    );
};

export const AssociationAssetList = ({ classAssets, assocId, pbbClass, openUploader, onAssetChange }) => {
    const { toast } = useToast();
    const [dialogState, setDialogState] = useState({ isOpen: false, onConfirm: () => {} });

    const confirmAndRemoveAsset = (assetId, filePath) => {
        setDialogState({
            isOpen: true,
            onConfirm: () => handleRemoveAsset(assetId, filePath),
        });
    };

    const handleRemoveAsset = async (assetId, filePath) => {
        const { error: dbError } = await supabase
            .from('association_assets')
            .delete()
            .match({ id: assetId });

        if (dbError) {
            toast({ title: 'Error removing asset from database', description: dbError.message, variant: 'destructive' });
        } else {
            const { error: storageError } = await supabase.storage.from('association_assets').remove([filePath]);
            if (storageError) {
                toast({ title: 'DB record deleted, but failed to remove file from storage', description: storageError.message, variant: 'warning' });
            } else {
                toast({ title: 'Asset Removed', description: 'The asset has been successfully removed.' });
            }
            onAssetChange(); // Refresh the list
        }
        setDialogState({ isOpen: false, onConfirm: () => {} });
    };
    
    // Add a more robust check for pbbClass and its patternType
    if (!pbbClass || typeof pbbClass.patternType === 'undefined' || pbbClass.patternType === null) {
        return <div className="text-center text-muted-foreground p-4">Select a discipline to see assets.</div>;
    }

    if (pbbClass.patternType === 'rulebook') {
        const patternNumbers = PATTERN_NUMBERS[pbbClass.name] || [];
        return (
            <>
                <div className="space-y-3">
                    {patternNumbers.map(pNum => {
                        const patternKey = pNum || 'base';
                        const assets = classAssets[patternKey] || {};
                        return (
                            <div key={pNum} className="p-3 border rounded-lg bg-secondary/30">
                                <h4 className="font-semibold text-sm mb-2">{pbbClass.name} - Pattern {pNum}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1 text-center">Pattern</p>
                                        <AssetSlot
                                            asset={assets.pattern} 
                                            onUploadClick={openUploader}
                                            assetInfo={{ assocId, className: pbbClass.name, patternNumber: pNum, type: 'pattern', patternType: pbbClass.patternType }}
                                            onRemoveAsset={confirmAndRemoveAsset}
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1 text-center">Score Sheet</p>
                                        <AssetSlot 
                                            asset={assets.scoresheet}
                                            onUploadClick={openUploader}
                                            assetInfo={{ assocId, className: pbbClass.name, patternNumber: pNum, type: 'scoresheet', patternType: pbbClass.patternType }}
                                            onRemoveAsset={confirmAndRemoveAsset}
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1 text-center">Verbiage</p>
                                        <AssetSlot
                                            asset={assets.verbiage}
                                            onUploadClick={openUploader}
                                            assetInfo={{ assocId, className: pbbClass.name, patternNumber: pNum, type: 'verbiage', patternType: pbbClass.patternType }}
                                            onRemoveAsset={confirmAndRemoveAsset}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <ConfirmationDialog
                    isOpen={dialogState.isOpen}
                    onClose={() => setDialogState({ isOpen: false, onConfirm: () => {} })}
                    onConfirm={dialogState.onConfirm}
                    title="Are you sure?"
                    description="This action will permanently remove the asset. This cannot be undone."
                />
            </>
        );
    }

    const assets = classAssets.base || {};
    return (
        <>
            <div className="p-3 border rounded-lg bg-secondary/30">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-1">
                        <p className="text-xs text-muted-foreground mb-1 text-center">Score Sheet</p>
                         <AssetSlot 
                            asset={assets.scoresheet}
                            onUploadClick={openUploader}
                            assetInfo={{ assocId, className: pbbClass.name, patternNumber: null, type: 'scoresheet', patternType: pbbClass.patternType }}
                            onRemoveAsset={confirmAndRemoveAsset}
                        />
                    </div>
                </div>
            </div>
            <ConfirmationDialog
                isOpen={dialogState.isOpen}
                onClose={() => setDialogState({ isOpen: false, onConfirm: () => {} })}
                onConfirm={dialogState.onConfirm}
                title="Are you sure?"
                description="This action will permanently remove the asset. This cannot be undone."
            />
        </>
    );
};