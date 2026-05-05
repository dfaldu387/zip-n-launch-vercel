import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { CheckCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import Navigation from '@/components/Navigation';
import PatternDetails from '@/components/pattern-upload/PatternDetails';
import AssociationSelector from '@/components/pattern-upload/AssociationSelector';
import PatternUploader from '@/components/pattern-upload/PatternUploader';
import LicensingAgreement from '@/components/pattern-upload/LicensingAgreement';
import { usePatternUpload } from '@/hooks/usePatternUpload';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import PatternPreviewModal from '@/components/pattern-upload/PatternPreviewModal';
import AccessoryDocumentUploader from '@/components/pattern-upload/AccessoryDocumentUploader';
import PatternUploadPreviewStep from '@/components/pattern-upload/PatternUploadPreviewStep';
import { assignPatternDisplayName } from '@/lib/patternNumbering';
import { pdfjs } from 'react-pdf';

const PatternUploadPage = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const {
        patternSetName, setPatternSetName,
        classType, setClassType,
        customClassType, setCustomClassType,
        patterns,
        hierarchyOrder, setHierarchyOrder,
        selectedAssociations,
        associationDifficulties,
        patternDivisions,
        agreedToTerms, setAgreedToTerms,
        isCustomClass,
        resetForm,
        handleFileDrop,
        handleRemovePattern,
        handleAssociationChange,
        handleDifficultyChange,
        handleDivisionChange,
        handleDivisionGroupChange,
        handleBulkDivisionChange,
        stagedPdfs,
        handlePdfSplit,
        assignStagedPdf,
        removeStagedPdf,
        renameStagedPdf,
        accessoryDocs,
        handleAddAccessoryDoc,
        handleRemoveAccessoryDoc,
        handleUpdateAccessoryDoc,
        useAsOriginal,
        setUseAsOriginal,
    } = usePatternUpload();

    const [step, setStep] = useState('edit'); // 'edit' | 'preview'

    const [hoveredPattern, setHoveredPattern] = useState(null);
    const [previewingPattern, setPreviewingPattern] = useState(null);
    const [pinnedPattern, setPinnedPattern] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const hoverTimeoutRef = useRef(null);
    const [associationsData, setAssociationsData] = useState([]);

    useEffect(() => {
        const fetchAssociations = async () => {
            const { data, error } = await supabase.from('associations').select('*');
            if (error) {
                toast({ title: 'Error fetching associations', description: error.message, variant: 'destructive' });
            } else {
                setAssociationsData(data);
            }
        };
        fetchAssociations();
    }, [toast]);

    useEffect(() => {
        const defaultHierarchy = [
            { id: 'level-1', title: 'Championship', description: 'Pinnacle difficulty, finals-style patterns' },
            { id: 'level-2', title: 'Skilled', description: 'Polished, technical riding' },
            { id: 'level-3', title: 'Intermediate', description: 'Developing control, more elements introduced' },
            { id: 'level-4', title: 'Beginner', description: 'Beginner riders moving beyond basics' },
            { id: 'level-5', title: 'Walk-Trot', description: 'Entry, foundation patterns' }
        ];
        setHierarchyOrder(defaultHierarchy);
    }, [setHierarchyOrder]);

    const handleHover = (item) => {
        if (pinnedPattern) return;
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredPattern(item);
        }, 300);
    };

    const handleLeave = () => {
        if (pinnedPattern) return;
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        setHoveredPattern(null);
    };
    
    const handlePinPattern = (item) => {
        setPinnedPattern(prev => prev && prev.id === item.id ? null: item);
        setHoveredPattern(null);
    };

    const handleSubmit = async () => {
        if (!user) {
            toast({ title: 'Authentication Error', description: 'You must be logged in to submit patterns.', variant: 'destructive' });
            return;
        }
        if (!agreedToTerms) {
            toast({ title: 'Terms Not Accepted', description: 'You must agree to the terms and conditions.', variant: 'destructive' });
            return;
        }
        if (useAsOriginal === null) {
            toast({ title: 'Answer Required', description: 'Please confirm whether the original pattern should appear in Choose a Pattern.', variant: 'destructive' });
            return;
        }
        
        const uploadedPatternCount = Object.keys(patterns).filter(key => patterns[key]).length;
        if (uploadedPatternCount === 0) {
            toast({ title: 'No Patterns Uploaded', description: 'Please upload at least one pattern.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            const finalClassType = isCustomClass ? customClassType : classType;
            
            const patternUploadPromises = Object.values(patterns).filter(p => p).map(async (p) => {
                const hierarchyItem = hierarchyOrder.find(h => h.id === p.id);
                if (!hierarchyItem) return null;

                const fileExt = p.file.name.split('.').pop();
                const filePath = `${user.id}/${finalClassType}/${uuidv4()}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('pattern_files')
                    .upload(filePath, p.file);

                if (uploadError) throw new Error(`Failed to upload ${p.file.name}: ${uploadError.message}`);
                
                const { data: { publicUrl } } = supabase.storage.from('pattern_files').getPublicUrl(filePath);

                return {
                    originalId: p.id,
                    name: p.file.name,
                    file_url: publicUrl,
                    file_path: filePath,
                    user_id: user.id,
                    class_name: finalClassType,
                    pattern_set_name: patternSetName,
                    is_custom: true,
                    review_status: 'pending',
                    hierarchy_order: hierarchyOrder.findIndex(h => h.id === p.id),
                    associations: Object.keys(selectedAssociations),
                    divisions: patternDivisions[p.id] || {},
                    rawFile: p.file,
                };
            }).filter(p => p);

            const uploadedPatternsData = await Promise.all(patternUploadPromises);

            if (uploadedPatternsData.length === 0) {
                toast({ title: "No patterns to submit", description: "Please ensure uploaded files are assigned to a hierarchy slot.", variant: "destructive" });
                setIsSubmitting(false);
                return;
            }

            // pattern_number is intentionally not assigned at upload.
            // It's assigned sequentially on admin approval (see AdminPatternReviewPage).
            const tags = [];
            if (useAsOriginal) tags.push('OP');
            if (uploadedPatternsData.length > 1) tags.push('Multi');

            const dbPatterns = uploadedPatternsData.map(p => ({
                name: p.name,
                original_file_name: p.name, // Preserve original filename for admin reference
                file_url: p.file_url,
                file_path: p.file_path,
                user_id: p.user_id,
                class_name: p.class_name,
                pattern_set_name: p.pattern_set_name,
                is_custom: p.is_custom,
                review_status: p.review_status,
                hierarchy_order: p.hierarchy_order,
                use_as_original: !!useAsOriginal,
                tags,
            }));

            const { data: insertedPatterns, error: dbError } = await supabase
                .from('patterns')
                .insert(dbPatterns)
                .select();

            if (dbError) throw new Error(`Database error: ${dbError.message}`);

            // Assign auto-generated display names (e.g., "Trail Pattern 1")
            // Numbers are assigned now and persist forever, even if rejected/resubmitted
            for (const dbPattern of insertedPatterns) {
                try {
                  const discipline = dbPattern.class_name || finalClassType || 'Unknown';
                  const result = await assignPatternDisplayName(dbPattern.id, discipline, null);
                  if (result.error) {
                    console.error('Failed to assign display name:', result.error);
                  }
                } catch (e) {
                  console.error('Failed to assign display name for pattern:', dbPattern.id, e);
                }
            }

            const originalIdToDbIdMap = insertedPatterns.reduce((acc, dbPattern) => {
                const originalPattern = uploadedPatternsData.find(p => p.file_path === dbPattern.file_path);
                if (originalPattern) {
                    acc[originalPattern.originalId] = dbPattern.id;
                }
                return acc;
            }, {});

            const associationInserts = insertedPatterns.flatMap(dbPattern => {
                const originalPattern = uploadedPatternsData.find(p => p.file_path === dbPattern.file_path);
                if (!originalPattern) return [];
                return originalPattern.associations.map(assocId => ({
                    pattern_id: dbPattern.id,
                    association_id: assocId,
                    difficulty: associationDifficulties[assocId] || 'Intermediate',
                }));
            });

            const divisionInserts = insertedPatterns.flatMap(dbPattern => {
                const originalPattern = uploadedPatternsData.find(p => p.file_path === dbPattern.file_path);
                if (!originalPattern) return [];

                return Object.entries(originalPattern.divisions).flatMap(([assocId, levels]) => 
                    Array.isArray(levels) ? levels.map(levelName => ({
                        pattern_id: dbPattern.id,
                        association_id: assocId,
                        division_group: 'default', // simplified
                        division_level: levelName,
                    })) : []
                );
            });

            if (associationInserts.length > 0) {
                const { error: assocError } = await supabase.from('pattern_associations').insert(associationInserts);
                if (assocError) throw new Error(`Association link error: ${assocError.message}`);
            }
            if (divisionInserts.length > 0) {
                const { error: divError } = await supabase.from('pattern_divisions').insert(divisionInserts);
                if (divError) throw new Error(`Division link error: ${divError.message}`);
            }

            // Render page 1 of each uploaded PDF as a PNG preview so the admin
            // Pattern column has something to show before any manual extraction.
            // This is a raw first-page render, not the cleaned diagram crop the
            // wizard produces — admin can still replace it via the edit dialog.
            for (const dbPattern of insertedPatterns) {
                const original = uploadedPatternsData.find(p => p.file_path === dbPattern.file_path);
                if (!original?.rawFile) continue;
                try {
                    const buf = await original.rawFile.arrayBuffer();
                    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 2 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
                    if (!blob) continue;

                    const imgPath = `${user.id}/pattern_images/${uuidv4()}.png`;
                    const { error: upErr } = await supabase.storage
                        .from('pattern_files')
                        .upload(imgPath, blob, { contentType: 'image/png' });
                    if (upErr) { console.warn('Preview upload failed:', upErr.message); continue; }

                    const { data: { publicUrl } } = supabase.storage.from('pattern_files').getPublicUrl(imgPath);
                    await supabase.from('patterns').update({ preview_image_url: publicUrl }).eq('id', dbPattern.id);
                } catch (err) {
                    console.warn('Pattern preview render failed:', err);
                }
            }

            // Record each uploaded pattern PDF as a pattern_files row (Task 4).
            // Accessory docs below are also inserted into pattern_files for a unified
            // multi-file view, in addition to the legacy pattern_accessory_documents table.
            const patternFileRows = insertedPatterns.map(dbPattern => ({
                pattern_id: dbPattern.id,
                file_type: 'pattern',
                file_name: dbPattern.original_file_name || dbPattern.name,
                file_url: dbPattern.file_url,
                file_path: dbPattern.file_path,
                sort_order: 0,
            }));
            if (patternFileRows.length > 0) {
                const { error: pfError } = await supabase.from('pattern_files').insert(patternFileRows);
                if (pfError) throw new Error(`Pattern files error: ${pfError.message}`);
            }

            const accessoryDocUploads = accessoryDocs.flatMap(doc =>
                doc.linkedPatternIds.map(originalPatternId => ({
                    doc,
                    dbPatternId: originalIdToDbIdMap[originalPatternId]
                }))
            ).filter(item => item.dbPatternId);

            for (const { doc, dbPatternId } of accessoryDocUploads) {
                const fileExt = doc.file.name.split('.').pop();
                const filePath = `${user.id}/accessory_docs/${uuidv4()}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('pattern_files')
                    .upload(filePath, doc.file);

                if (uploadError) throw new Error(`Failed to upload accessory doc ${doc.file.name}: ${uploadError.message}`);
                
                const { data: { publicUrl } } = supabase.storage.from('pattern_files').getPublicUrl(filePath);

                await supabase.from('pattern_accessory_documents').insert({
                    pattern_id: dbPatternId,
                    document_type: doc.type,
                    file_name: doc.file.name,
                    file_url: publicUrl,
                    file_path: filePath,
                });

                // Also mirror into pattern_files so Choose-a-Pattern can pull all
                // linked files uniformly. Map legacy doc.type → pattern_files.file_type.
                const fileTypeMap = {
                    score_sheet: 'score_sheet',
                    build_sheet: 'build_sheet',
                    equipment: 'equipment',
                };
                const mappedType = fileTypeMap[doc.type] || 'accessory';
                await supabase.from('pattern_files').insert({
                    pattern_id: dbPatternId,
                    file_type: mappedType,
                    file_name: doc.file.name,
                    file_url: publicUrl,
                    file_path: filePath,
                    sort_order: 1,
                });
            }

            toast({ title: 'Success!', description: 'Your pattern set has been submitted for review.' });
            resetForm();
            setStep('edit');

        } catch (error) {
            toast({ title: 'Submission Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasPatterns = Object.keys(patterns).some(key => patterns[key]);

    return (
        <>
            <Helmet>
                <title>Upload Patterns - EquiPatterns</title>
                <meta name="description" content="Upload your patterns and assign them to divisions." />
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <CardHeader className="text-center px-0 mb-8">
                            <CardTitle className="text-4xl md:text-5xl font-bold">Upload Patterns</CardTitle>
                            <CardDescription className="text-xl text-muted-foreground max-w-3xl mx-auto">
                                Upload your patterns and assign them to divisions.
                            </CardDescription>
                        </CardHeader>

                        {step === 'preview' ? (
                            <PatternUploadPreviewStep
                                patternSetName={patternSetName}
                                patterns={patterns}
                                hierarchyOrder={hierarchyOrder}
                                useAsOriginal={useAsOriginal}
                                setUseAsOriginal={setUseAsOriginal}
                                onBack={() => setStep('edit')}
                                onSubmit={handleSubmit}
                                isSubmitting={isSubmitting}
                                agreedToTerms={agreedToTerms}
                            />
                        ) : (
                        <div className="space-y-8">
                            <PatternDetails
                                patternSetName={patternSetName}
                                setPatternSetName={setPatternSetName}
                                classType={classType}
                                setClassType={setClassType}
                                customClassType={customClassType}
                                setCustomClassType={setCustomClassType}
                            />

                            <AssociationSelector
                                selectedAssociations={selectedAssociations}
                                associationDifficulties={associationDifficulties}
                                onAssociationChange={handleAssociationChange}
                                onDifficultyChange={handleDifficultyChange}
                            />

                            <PatternUploader
                                hierarchyOrder={hierarchyOrder}
                                setHierarchyOrder={setHierarchyOrder}
                                patterns={patterns}
                                handleFileDrop={handleFileDrop}
                                handleRemovePattern={handleRemovePattern}
                                onHover={handleHover}
                                onLeave={handleLeave}
                                onPreview={setPreviewingPattern}
                                hoveredPattern={hoveredPattern}
                                stagedPdfs={stagedPdfs}
                                handlePdfSplit={handlePdfSplit}
                                assignStagedPdf={assignStagedPdf}
                                removeStagedPdf={removeStagedPdf}
                                renameStagedPdf={renameStagedPdf}
                                pinnedPattern={pinnedPattern}
                                handlePinPattern={handlePinPattern}
                            />

                            <AccessoryDocumentUploader
                                accessoryDocs={accessoryDocs}
                                onAdd={handleAddAccessoryDoc}
                                onRemove={handleRemoveAccessoryDoc}
                                onUpdate={handleUpdateAccessoryDoc}
                                patterns={patterns}
                                hierarchyOrder={hierarchyOrder}
                            />
                            
                            <LicensingAgreement
                                agreedToTerms={agreedToTerms}
                                setAgreedToTerms={setAgreedToTerms}
                            />

                            <div>
                              <Button
                                size="lg"
                                className="w-full"
                                onClick={() => setStep('preview')}
                                disabled={!user || !agreedToTerms || !hasPatterns}
                              >
                                <CheckCircle className="mr-2 h-5 w-5" /> Preview &amp; Continue
                              </Button>
                            </div>
                        </div>
                        )}
                    </motion.div>
                </main>

                <PatternPreviewModal
                    isOpen={!!previewingPattern}
                    onClose={() => setPreviewingPattern(null)}
                    pattern={previewingPattern}
                />

            </div>
        </>
    );
};

export default PatternUploadPage;