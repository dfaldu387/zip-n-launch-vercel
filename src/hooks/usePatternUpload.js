import { useState, useMemo, useEffect } from 'react';
    import { v4 as uuidv4 } from 'uuid';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/supabaseClient';

    const initialHierarchy = [
        { id: 'hierarchy_1', title: 'Hierarchy 1', description: 'Primary pattern, often the most complex or important.' },
        { id: 'hierarchy_2', title: 'Hierarchy 2', description: 'Secondary pattern, an alternative or slightly simpler version.' },
        { id: 'hierarchy_3', title: 'Hierarchy 3', description: 'Tertiary pattern, for different skill levels or age groups.' },
        { id: 'hierarchy_4', title: 'Hierarchy 4', description: 'Ancillary pattern, for specific use-cases or finals.' },
        { id: 'hierarchy_5', title: 'Hierarchy 5', description: 'Optional or extra pattern for additional scenarios.' },
    ];

    export const usePatternUpload = () => {
        const { toast } = useToast();
        const [patternSetName, setPatternSetName] = useState('');
        const [classType, setClassType] = useState('');
        const [customClassType, setCustomClassType] = useState('');
        const [patterns, setPatterns] = useState({});
        const [hierarchyOrder, setHierarchyOrder] = useState(initialHierarchy);
        const [selectedAssociations, setSelectedAssociations] = useState({});
        const [associationDifficulties, setAssociationDifficulties] = useState({});
        const [patternDivisions, setPatternDivisions] = useState({});
        const [agreedToTerms, setAgreedToTerms] = useState(false);
        const [stagedPdfs, setStagedPdfs] = useState([]);
        const [accessoryDocs, setAccessoryDocs] = useState([]);
        const [useAsOriginal, setUseAsOriginal] = useState(null); // null | true | false — forces user to answer

        const isCustomClass = useMemo(() => classType === 'custom', [classType]);

        const resetForm = () => {
            setPatternSetName('');
            setClassType('');
            setCustomClassType('');
            setPatterns({});
            setHierarchyOrder(initialHierarchy);
            setSelectedAssociations({});
            setAssociationDifficulties({});
            setPatternDivisions({});
            setAgreedToTerms(false);
            setStagedPdfs([]);
            setAccessoryDocs([]);
            setUseAsOriginal(null);
        };

        const handleFileDrop = async (levelId, file) => {
            if (file && file.type === 'application/pdf') {
                try {
                    const dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (event) => resolve(event.target.result);
                        reader.onerror = (error) => reject(error);
                        reader.readAsDataURL(file);
                    });
                    setPatterns(prev => ({ ...prev, [levelId]: { id: levelId, file, dataUrl, name: file.name } }));
                } catch (error) {
                    toast({ title: 'Error reading file', description: 'Could not read the selected file.', variant: 'destructive' });
                }
            } else {
                toast({ title: 'Invalid File Type', description: 'Please upload a PDF file.', variant: 'destructive' });
            }
        };

        const handleRemovePattern = (levelId) => {
            setPatterns(prev => {
                const newPatterns = { ...prev };
                delete newPatterns[levelId];
                return newPatterns;
            });
            // Also unlink from accessory docs
            setAccessoryDocs(docs => docs.map(doc => ({
                ...doc,
                linkedPatternIds: doc.linkedPatternIds.filter(id => id !== levelId)
            })));
        };

        const handleAssociationChange = (assocId, isSelected) => {
            setSelectedAssociations(prev => {
                const newSelected = { ...prev };
                if (isSelected) {
                    newSelected[assocId] = true;
                } else {
                    delete newSelected[assocId];
                    setAssociationDifficulties(prevDiff => {
                        const newDiff = { ...prevDiff };
                        delete newDiff[assocId];
                        return newDiff;
                    });
                    setPatternDivisions(prevDivs => {
                        const newDivs = { ...prevDivs };
                        Object.keys(newDivs).forEach(patternId => {
                            delete newDivs[patternId][assocId];
                        });
                        return newDivs;
                    });
                }
                return newSelected;
            });
        };

        const handleDifficultyChange = (assocId, difficulty) => {
            setAssociationDifficulties(prev => ({ ...prev, [assocId]: difficulty }));
        };

        const handleDivisionChange = (patternId, assocId, level, isSelected) => {
            setPatternDivisions(prev => {
                const newDivisions = JSON.parse(JSON.stringify(prev));
                if (!newDivisions[patternId]) newDivisions[patternId] = {};
                if (!Array.isArray(newDivisions[patternId][assocId])) {
                    newDivisions[patternId][assocId] = [];
                }

                const divisionList = newDivisions[patternId][assocId];
                if (isSelected) {
                    if (!divisionList.includes(level)) {
                        divisionList.push(level);
                    }
                } else {
                    const index = divisionList.indexOf(level);
                    if (index > -1) {
                        divisionList.splice(index, 1);
                    }
                }
                return newDivisions;
            });
        };
        
        const handleDivisionGroupChange = (patternId, assocId, levels, isSelected) => {
            setPatternDivisions(prev => {
                const newDivisions = JSON.parse(JSON.stringify(prev));
                if (!newDivisions[patternId]) newDivisions[patternId] = {};
                if (!Array.isArray(newDivisions[patternId][assocId])) {
                     newDivisions[patternId][assocId] = [];
                }

                const divisionList = newDivisions[patternId][assocId];
                if (isSelected) {
                    levels.forEach(level => {
                        if (!divisionList.includes(level)) {
                            divisionList.push(level);
                        }
                    });
                } else {
                    levels.forEach(level => {
                        const index = divisionList.indexOf(level);
                        if (index > -1) {
                            divisionList.splice(index, 1);
                        }
                    });
                }
                return newDivisions;
            });
        };

        const handleBulkDivisionChange = (division, isSelected) => {
            const assocIds = Array.from(division.associations);
            const levelName = division.level;

            setPatternDivisions(prev => {
                const newDivisions = JSON.parse(JSON.stringify(prev));
                hierarchyOrder.forEach(hierarchyItem => {
                    const patternId = hierarchyItem.id;
                    if (patterns[patternId]) {
                        if (!newDivisions[patternId]) newDivisions[patternId] = {};
                        assocIds.forEach(assocId => {
                            if (!Array.isArray(newDivisions[patternId][assocId])) {
                                newDivisions[patternId][assocId] = [];
                            }
                            
                            const divisionList = newDivisions[patternId][assocId];
                            const index = divisionList.indexOf(levelName);

                            if (isSelected) {
                                if (index === -1) divisionList.push(levelName);
                            } else {
                                if (index > -1) divisionList.splice(index, 1);
                            }
                        });
                    }
                });
                return newDivisions;
            });
        };

        const handlePdfSplit = async (file) => {
            if (!file) return;
            toast({ title: 'Processing PDF...', description: 'Splitting pages into individual patterns.' });
            try {
                const { pdfToDataUrls } = await import('@/lib/pdfUtils');
                const pages = await pdfToDataUrls(file);
                const baseName = file.name.replace(/\.pdf$/i, '');
                const newStagedPdfs = pages.map((page, index) => ({
                    id: uuidv4(),
                    dataUrl: page.dataUrl,
                    originalFileName: file.name,
                    displayName: `${baseName} - Page ${index + 1}`,
                    pageNumber: index + 1,
                    file: new File([page.blob], `${baseName}_page_${index + 1}.pdf`, { type: 'application/pdf' })
                }));
                setStagedPdfs(prev => [...prev, ...newStagedPdfs]);
                toast({ title: 'PDF Split Successfully', description: `${pages.length} pages ready to assign.` });
            } catch (error) {
                toast({ title: 'PDF Split Failed', description: error.message, variant: 'destructive' });
            }
        };

        const assignStagedPdf = (stagedPdfId, slotId) => {
            const stagedPdf = stagedPdfs.find(p => p.id === stagedPdfId);
            if (stagedPdf) {
                setPatterns(prev => ({
                    ...prev,
                    [slotId]: {
                        id: slotId,
                        file: stagedPdf.file,
                        dataUrl: stagedPdf.dataUrl,
                        name: stagedPdf.displayName || `${stagedPdf.originalFileName} (Page ${stagedPdf.pageNumber})`,
                    }
                }));
                setStagedPdfs(prev => prev.filter(p => p.id !== stagedPdfId));
            }
        };

        const removeStagedPdf = (stagedPdfId) => {
            setStagedPdfs(prev => prev.filter(p => p.id !== stagedPdfId));
        };

        const renameStagedPdf = (stagedPdfId, newName) => {
            setStagedPdfs(prev => prev.map(p =>
                p.id === stagedPdfId ? { ...p, displayName: newName } : p
            ));
        };

        const handleAddAccessoryDoc = (file, type) => {
            const newDoc = {
                id: uuidv4(),
                file,
                type: type,
                linkedPatternIds: [],
            };
            setAccessoryDocs(prev => [...prev, newDoc]);
        };

        const handleRemoveAccessoryDoc = (docId) => {
            setAccessoryDocs(prev => prev.filter(doc => doc.id !== docId));
        };

        const handleUpdateAccessoryDoc = (docId, updates) => {
            setAccessoryDocs(prev => prev.map(doc => doc.id === docId ? { ...doc, ...updates } : doc));
        };

        return {
            patternSetName, setPatternSetName,
            classType, setClassType,
            customClassType, setCustomClassType,
            patterns, setPatterns,
            hierarchyOrder, setHierarchyOrder,
            selectedAssociations, setSelectedAssociations,
            associationDifficulties, setAssociationDifficulties,
            patternDivisions, setPatternDivisions,
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
        };
    };