import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { generatePatternBookPdf } from '@/lib/bookGenerator';
import { Loader2, Download, Printer, Mail, Link2, Image as LucideImage, FileText, CheckSquare, Square, Send, ArrowLeft } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { fetchImageAsBase64, compressImage, cropPatternImageSmart } from '@/lib/pdfHelpers';

const PatternPortalDetailDialog = ({ open, onOpenChange, project }) => {
    const { toast } = useToast();
    const [patterns, setPatterns] = useState([]);
    const [scoreSheets, setScoreSheets] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [isExporting, setIsExporting] = useState(false);

    // Pattern Hub projects use full images (no crop) and minimal headers
    const isHubProject = (project?.project_type || '') === 'pattern_hub';

    // Inline email form state
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [recipientEmail, setRecipientEmail] = useState('');
    const [senderName, setSenderName] = useState('');
    const [personalMessage, setPersonalMessage] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    // Build a unique key for each item
    const getItemKey = (item, type) => `${type}-${item.patternId || item.id || item.pattern_id}-${item.disciplineName}-${item.groupName}`;

    // Fetch patterns and scoresheets when dialog opens
    const fetchItems = useCallback(async () => {
        if (!project?.project_data) return;
        setIsLoading(true);

        const projectData = project.project_data;
        const disciplines = projectData.disciplines || [];
        const patternSelections = projectData.patternSelections || {};

        try {
            // Fetch associations
            const { data: associationsData } = await supabase
                .from('associations')
                .select('id, abbreviation, name');
            const associationsMap = {};
            (associationsData || []).forEach(a => { associationsMap[a.id] = a; });

            // Collect pattern IDs
            const patternIds = new Set();
            const patternGroupMap = [];

            for (const discipline of disciplines) {
                const disciplineSelections = patternSelections[discipline.id] || patternSelections[discipline.name] || patternSelections[discipline.index];
                if (!disciplineSelections) continue;

                const groups = discipline.patternGroups || [];
                for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                    const group = groups[groupIndex];
                    const patternSelection = disciplineSelections[group.id] || disciplineSelections[groupIndex];
                    if (!patternSelection) continue;

                    const patternId = typeof patternSelection === 'object'
                        ? (patternSelection.patternId || patternSelection.id)
                        : patternSelection;

                    if (!patternId) continue;

                    const divisions = Array.isArray(group.divisions) ? group.divisions : [];
                    const extractedDivisions = divisions.map(div => {
                        if (typeof div === 'string') return { name: div, association: '' };
                        if (div && typeof div === 'object') {
                            let assocName = div.association || div.assocName || '';
                            if (!assocName && div.association_id) {
                                const assoc = associationsMap[div.association_id];
                                assocName = assoc?.abbreviation || assoc?.name || '';
                            }
                            return { name: div.name || div.divisionName || div.division || div.title || '', association: assocName };
                        }
                        return { name: String(div || ''), association: '' };
                    }).filter(div => div.name?.trim());

                    if (patternId && !isNaN(parseInt(patternId))) {
                        patternIds.add(parseInt(patternId));
                    }

                    patternGroupMap.push({
                        discipline, group, groupIndex,
                        patternId: patternId && !isNaN(parseInt(patternId)) ? parseInt(patternId) : null,
                        patternSelection, extractedDivisions
                    });
                }
            }

            // Batch fetch
            let patternImageMap = {};
            let patternDetailsMap = {};
            if (patternIds.size > 0) {
                const ids = Array.from(patternIds);
                const [mediaRes, detailRes] = await Promise.all([
                    supabase.from('tbl_pattern_media').select('pattern_id, image_url').in('pattern_id', ids),
                    supabase.from('tbl_patterns').select('id, pdf_file_name, pattern_version, discipline, association_name').in('id', ids)
                ]);
                (mediaRes.data || []).forEach(pm => { if (!patternImageMap[pm.pattern_id]) patternImageMap[pm.pattern_id] = pm.image_url; });
                (detailRes.data || []).forEach(p => { patternDetailsMap[p.id] = p; });
            }

            const patternsList = [];
            const scoreSheetsList = [];
            const processedPatterns = new Set();
            const processedScoresheets = new Set();

            for (const entry of patternGroupMap) {
                const { discipline, group, groupIndex, patternId, patternSelection, extractedDivisions } = entry;
                const assoc = associationsMap[discipline.association_id];
                const assocDisplayName = assoc?.abbreviation || assoc?.name || '';

                if (patternId) {
                    const patternKey = `${patternId}-${discipline.id}-${group.id || groupIndex}`;
                    if (!processedPatterns.has(patternKey)) {
                        const detail = patternDetailsMap[patternId];
                        patternsList.push({
                            patternId, imageUrl: patternImageMap[patternId],
                            patternName: detail?.pdf_file_name || `Pattern ${patternId}`,
                            version: detail?.pattern_version || 'ALL',
                            disciplineName: discipline.name, groupName: group.name,
                            associationName: assocDisplayName,
                            divisions: extractedDivisions
                        });
                        processedPatterns.add(patternKey);
                    }
                }

                // Handle pre-saved scoresheetData (array or single object)
                if (typeof patternSelection === 'object' && patternSelection.scoresheetData) {
                    const ssData = patternSelection.scoresheetData;
                    const sheets = Array.isArray(ssData) ? ssData : (ssData.image_url ? [ssData] : []);
                    let foundAny = false;
                    for (const sheet of sheets) {
                        const scoresheetId = `${sheet.id || sheet.pattern_id}`;
                        if (!processedScoresheets.has(scoresheetId)) {
                            scoreSheetsList.push({
                                ...sheet,
                                disciplineName: discipline.name, groupName: group.name,
                                associationName: assocDisplayName,
                                divisions: extractedDivisions
                            });
                            processedScoresheets.add(scoresheetId);
                            foundAny = true;
                        }
                    }
                    if (foundAny) continue;
                }

                if (patternId) {
                    // Fetch all scoresheets linked to this pattern (may be multiple for Working Cow Horse)
                    const { data: linkedSheets } = await supabase
                        .from('tbl_scoresheet')
                        .select('id, pattern_id, image_url, storage_path, discipline, file_name, association_abbrev')
                        .eq('pattern_id', patternId);
                    const validSheets = (linkedSheets || []).filter(s => s.image_url);
                    if (validSheets.length > 0) {
                        for (const scoresheet of validSheets) {
                            const sid = `${scoresheet.id}`;
                            if (!processedScoresheets.has(sid)) {
                                scoreSheetsList.push({ ...scoresheet, disciplineName: discipline.name, groupName: group.name, associationName: assocDisplayName, divisions: extractedDivisions });
                                processedScoresheets.add(sid);
                            }
                        }
                        continue;
                    }
                }

                if (assoc?.abbreviation && discipline.name) {
                    const { data: fallbackSheets } = await supabase
                        .from('tbl_scoresheet')
                        .select('id, pattern_id, image_url, storage_path, discipline, file_name, association_abbrev')
                        .eq('association_abbrev', assoc.abbreviation)
                        .ilike('discipline', `%${discipline.name}%`);
                    const validSheets = (fallbackSheets || []).filter(s => s.image_url);
                    for (const scoresheet of validSheets) {
                        const sid = `${scoresheet.id}`;
                        if (!processedScoresheets.has(sid)) {
                            scoreSheetsList.push({ ...scoresheet, disciplineName: discipline.name, groupName: group.name, associationName: assocDisplayName, divisions: extractedDivisions });
                            processedScoresheets.add(sid);
                        }
                    }
                }
            }

            setPatterns(patternsList);
            setScoreSheets(scoreSheetsList);

            const allKeys = new Set();
            patternsList.forEach(p => allKeys.add(getItemKey(p, 'pattern')));
            scoreSheetsList.forEach(s => allKeys.add(getItemKey(s, 'scoresheet')));
            setSelectedItems(allKeys);
        } catch (error) {
            console.error('Error fetching items:', error);
            toast({ title: 'Error', description: 'Failed to load patterns and score sheets.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [project, toast]);

    useEffect(() => {
        if (open) {
            fetchItems();
            setShowEmailForm(false);
        } else {
            setSelectedItems(new Set());
            setPatterns([]);
            setScoreSheets([]);
            setShowEmailForm(false);
            setRecipientEmail('');
            setSenderName('');
            setPersonalMessage('');
        }
    }, [open, fetchItems]);

    // Selection helpers
    const totalCount = patterns.length + scoreSheets.length;
    const selectedCount = selectedItems.size;
    const allSelected = totalCount > 0 && selectedCount === totalCount;

    const toggleItem = (item, type) => {
        const key = getItemKey(item, type);
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAll = () => {
        if (allSelected) {
            setSelectedItems(new Set());
        } else {
            const allKeys = new Set();
            patterns.forEach(p => allKeys.add(getItemKey(p, 'pattern')));
            scoreSheets.forEach(s => allKeys.add(getItemKey(s, 'scoresheet')));
            setSelectedItems(allKeys);
        }
    };

    const getSelectedPatterns = () => patterns.filter(p => selectedItems.has(getItemKey(p, 'pattern')));
    const getSelectedScoreSheets = () => scoreSheets.filter(s => selectedItems.has(getItemKey(s, 'scoresheet')));

    const dataUriToBlob = (dataUri) => {
        const [header, base64] = dataUri.split(',');
        const mime = header.match(/:(.*?);/)[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    };

    const triggerBlobDownload = (blob, fileName) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    };

    // Build PDF from selected items
    // Resolve image URL — use image_url, fall back to storage_path public URL
    const resolveImageUrl = (item, type) => {
        const url = type === 'pattern' ? item.imageUrl : item.image_url;
        if (url) return url;
        // Fall back to generating public URL from storage_path
        if (item.storage_path) {
            const { data } = supabase.storage.from('scoresheets').getPublicUrl(item.storage_path);
            return data?.publicUrl || null;
        }
        return null;
    };

    const buildSelectedPdf = async () => {
        const selectedPatternsList = getSelectedPatterns();
        const selectedScoreSheetsList = getSelectedScoreSheets();

        // Always build custom PDF to ensure both patterns AND scoresheets are included
        const doc = new jsPDF('p', 'pt', 'letter');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 36;
        let isFirstPage = true;

        // Crop bottom portion of an image (removes summary box from pattern images)
        const cropImageBottom = (base64Src, cropPercent = 0.97) => {
            return new Promise((resolve) => {
                const tempImg = new Image();
                tempImg.onload = () => {
                    const canvas = document.createElement('canvas');
                    const cropH = Math.floor(tempImg.height * cropPercent);
                    canvas.width = tempImg.width;
                    canvas.height = cropH;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(tempImg, 0, 0, tempImg.width, cropH, 0, 0, tempImg.width, cropH);
                    resolve(canvas.toDataURL('image/png'));
                };
                tempImg.onerror = () => resolve(base64Src);
                tempImg.src = base64Src;
            });
        };

        // Helper: extract pattern number from pdf_file_name (e.g., "WesternRiding0001.L1" -> 1)
        const extractPatternNumber = (fileName) => {
            if (!fileName) return null;
            const nameWithoutExt = fileName.replace(/\.(pdf|PDF)$/, '');
            const match = nameWithoutExt.match(/(\d+)(?:\.|$)/);
            if (match) return parseInt(match[1], 10) || null;
            const fallback = nameWithoutExt.match(/(\d+)$/);
            return fallback ? (parseInt(fallback[1], 10) || null) : null;
        };

        // Helper: format pattern display name
        const getPatternDisplayName = (item) => {
            const num = extractPatternNumber(item.patternName);
            let display = num !== null ? `Pattern ${num}` : (item.patternName || null);
            if (display && item.version && item.version !== 'ALL') {
                display = `${display} - ${item.version}`;
            }
            return display;
        };

        const addImagePage = async (imageUrl, item, shouldCrop = false) => {
            if (!imageUrl) return;
            try {
                const rawBase64 = await fetchImageAsBase64(imageUrl);
                if (!rawBase64) return;

                // Compress to JPEG at A4-appropriate resolution (max 1240x1754 at 150dpi)
                // This keeps PDF under Postmark's 10MB attachment limit
                let base64 = await compressImage(rawBase64, 1240, 1754, 0.85) || rawBase64;

                // Smart-crop pattern images (removes baked-in header/footer) — skip for hub projects
                if (shouldCrop && !isHubProject) {
                    base64 = await cropPatternImageSmart(base64);
                }

                if (!isFirstPage) doc.addPage();
                isFirstPage = false;

                let yPos = margin;

                if (isHubProject) {
                    // Hub mode: minimal one-line header — pattern image has its own title
                    doc.setTextColor(0, 0, 0);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(10);
                    const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
                    const parts = [item.associationName?.toUpperCase(), (item.disciplineName || '').toUpperCase(), dateStr].filter(Boolean);
                    doc.text(parts.join('  \u2022  '), margin, yPos, { maxWidth: pageWidth - margin * 2 });
                    yPos += 18;
                } else {
                // Render detailed header matching pattern book layout
                const showName = project.project_name || project.project_data?.showName || '';

                // Show name (light gray, small)
                if (showName) {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(120, 120, 120);
                    doc.text(showName, margin, yPos);
                    yPos += 14;
                }

                // Association name (bold)
                if (item.associationName) {
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    doc.text(item.associationName.toUpperCase(), margin, yPos);
                    yPos += 18;
                }

                // Discipline name + date
                doc.setFontSize(11);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 0);
                const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
                const disciplineText = `${(item.disciplineName || '').toUpperCase()} - ${dateStr}`;
                const disciplineLines = doc.splitTextToSize(disciplineText, pageWidth - margin * 2);
                doc.text(disciplineLines, margin, yPos);
                yPos += (disciplineLines.length * 14) + 4;

                // Pattern name (e.g., "Pattern 1 - L1")
                const patternDisplayName = getPatternDisplayName(item);
                if (patternDisplayName) {
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'bold');
                    doc.text(patternDisplayName, margin, yPos);
                    yPos += 16;
                }

                // Division names
                const divisions = item.divisions?.map(d => {
                    const name = d.name || '';
                    return d.association ? `${d.association} - ${name}` : name;
                }).filter(Boolean).join(' / ') || '';
                if (divisions) {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(0, 0, 0);
                    const divisionLines = doc.splitTextToSize(divisions, pageWidth - margin * 2);
                    const linesToDisplay = divisionLines.slice(0, 2);
                    doc.text(linesToDisplay, margin, yPos);
                    yPos += (linesToDisplay.length * 12) + 8;
                } else {
                    yPos += 8;
                }
                } // end full header (non-hub)

                // Detect image type from data URI
                const imageType = base64.substring(base64.indexOf('/') + 1, base64.indexOf(';'));

                // Load image to get dimensions
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = base64;
                });

                const maxW = pageWidth - margin * 2;
                const maxH = pageHeight - yPos - 28;
                const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
                const w = img.width * ratio;
                const h = img.height * ratio;
                const x = (pageWidth - w) / 2;

                doc.addImage(base64, imageType.toUpperCase(), x, yPos, w, h);

                // Branding footer — bottom-right
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(150, 150, 150);
                doc.text('equipatterns.com', pageWidth - margin, pageHeight - 14, { align: 'right' });
            } catch (err) {
                console.warn('Failed to add image to PDF:', item.disciplineName, err);
            }
        };

        // Add selected patterns (crop bottom to remove summary box)
        for (const p of selectedPatternsList) {
            const url = resolveImageUrl(p, 'pattern');
            await addImagePage(url, p, true);
        }

        // Add selected scoresheets (no crop)
        for (const s of selectedScoreSheetsList) {
            const url = resolveImageUrl(s, 'scoresheet');
            await addImagePage(url, s, false);
        }

        if (isFirstPage) return null;

        return doc.output('datauristring');
    };

    // Export actions
    const handleDownloadPdf = async () => {
        if (selectedCount === 0) {
            toast({ title: 'No items selected', description: 'Please select at least one item to download.', variant: 'destructive' });
            return;
        }
        setIsExporting(true);
        try {
            toast({ title: 'Generating PDF...', description: 'Preparing your selected items.' });
            const pdfDataUri = await buildSelectedPdf();
            if (!pdfDataUri) {
                toast({ title: 'No content', description: 'No images available for the selected items.', variant: 'destructive' });
                return;
            }
            const blob = dataUriToBlob(pdfDataUri);
            const fileName = (project.project_name || 'Pattern').replace(/ /g, '_');
            triggerBlobDownload(blob, `${fileName}_selected.pdf`);
            toast({ title: 'Downloaded!', description: `${selectedCount} item(s) downloaded as PDF.` });
        } catch (error) {
            console.error('Download error:', error);
            toast({ title: 'Download Failed', description: error.message || 'There was a problem.', variant: 'destructive' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleDownloadPng = async () => {
        if (selectedCount === 0) {
            toast({ title: 'No items selected', description: 'Please select at least one item.', variant: 'destructive' });
            return;
        }
        setIsExporting(true);
        try {
            const selectedPatternsList = getSelectedPatterns();
            const selectedScoreSheetsList = getSelectedScoreSheets();
            const allSelectedImages = [
                ...selectedPatternsList.map(p => ({ url: resolveImageUrl(p, 'pattern'), name: `${p.disciplineName}_${p.groupName || 'Group'}_Pattern`.replace(/ /g, '_'), type: 'pattern', item: p })),
                ...selectedScoreSheetsList.map(s => ({ url: resolveImageUrl(s, 'scoresheet'), name: `${s.disciplineName}_${s.groupName || 'Group'}_ScoreSheet`.replace(/ /g, '_'), type: 'scoresheet', item: s }))
            ].filter(i => i.url);

            if (allSelectedImages.length === 0) {
                toast({ title: 'No images', description: 'No images available for the selected items.', variant: 'destructive' });
                return;
            }

            // Helper: draw header text on canvas and return the Y offset where image should start
            const drawHeaderOnCanvas = (ctx, canvasWidth, item) => {
                const scale = canvasWidth / 600; // scale text relative to a 600px reference width
                let yPos = 10 * scale;

                if (isHubProject) {
                    // Hub mode: single compact line
                    const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
                    const parts = [item.associationName?.toUpperCase(), (item.disciplineName || '').toUpperCase(), dateStr].filter(Boolean);
                    ctx.fillStyle = '#000000';
                    ctx.font = `bold ${Math.max(10, Math.floor(12 * scale))}px helvetica, sans-serif`;
                    ctx.textAlign = 'left';
                    ctx.fillText(parts.join('  \u2022  '), 10 * scale, yPos + 12 * scale);
                    yPos += 18 * scale;
                    return Math.ceil(yPos + 6 * scale);
                }

                const showName = project.project_name || project.project_data?.showName || '';

                // Show name
                if (showName) {
                    ctx.fillStyle = '#787878';
                    ctx.font = `${Math.max(10, Math.floor(12 * scale))}px helvetica, sans-serif`;
                    ctx.textAlign = 'left';
                    ctx.fillText(showName, 10 * scale, yPos + 12 * scale);
                    yPos += 18 * scale;
                }

                // Association name
                if (item.associationName) {
                    ctx.fillStyle = '#000000';
                    ctx.font = `bold ${Math.max(12, Math.floor(14 * scale))}px helvetica, sans-serif`;
                    ctx.textAlign = 'left';
                    ctx.fillText(item.associationName.toUpperCase(), 10 * scale, yPos + 14 * scale);
                    yPos += 20 * scale;
                }

                // Discipline + date
                const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
                const disciplineText = `${(item.disciplineName || '').toUpperCase()} - ${dateStr}`;
                ctx.fillStyle = '#000000';
                ctx.font = `${Math.max(10, Math.floor(12 * scale))}px helvetica, sans-serif`;
                ctx.fillText(disciplineText, 10 * scale, yPos + 12 * scale);
                yPos += 18 * scale;

                // Pattern name
                const patternName = item.patternName || '';
                const numMatch = patternName.replace(/\.(pdf|PDF)$/, '').match(/(\d+)(?:\.|$)/);
                const patternNum = numMatch ? parseInt(numMatch[1], 10) : null;
                let patternDisplay = patternNum !== null ? `Pattern ${patternNum}` : patternName;
                if (patternDisplay && item.version && item.version !== 'ALL') {
                    patternDisplay = `${patternDisplay} - ${item.version}`;
                }
                if (patternDisplay) {
                    ctx.font = `bold ${Math.max(10, Math.floor(12 * scale))}px helvetica, sans-serif`;
                    ctx.fillText(patternDisplay, 10 * scale, yPos + 12 * scale);
                    yPos += 18 * scale;
                }

                // Divisions
                const divisions = item.divisions?.map(d => {
                    const name = d.name || '';
                    return d.association ? `${d.association} - ${name}` : name;
                }).filter(Boolean).join(' / ') || '';
                if (divisions) {
                    ctx.fillStyle = '#000000';
                    ctx.font = `${Math.max(9, Math.floor(11 * scale))}px helvetica, sans-serif`;
                    ctx.fillText(divisions, 10 * scale, yPos + 11 * scale);
                    yPos += 16 * scale;
                }

                return Math.ceil(yPos + 10 * scale);
            };

            // Helper: add header, optional crop, and branding to a blob image
            const processImageBlob = async (blob, item, shouldCrop_ = false, cropPercent = 0.88) => {
                const shouldCrop = shouldCrop_ && !isHubProject;
                return new Promise((resolve) => {
                    const url = URL.createObjectURL(blob);
                    const tempImg = new Image();
                    tempImg.onload = () => {
                        // First, measure header height using an offscreen canvas
                        const measureCanvas = document.createElement('canvas');
                        measureCanvas.width = tempImg.width;
                        measureCanvas.height = 1;
                        const measureCtx = measureCanvas.getContext('2d');
                        const headerH = drawHeaderOnCanvas(measureCtx, tempImg.width, item);

                        const imgH = shouldCrop ? Math.floor(tempImg.height * cropPercent) : tempImg.height;
                        const brandingH = 24;
                        const canvas = document.createElement('canvas');
                        canvas.width = tempImg.width;
                        canvas.height = headerH + imgH + brandingH;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Draw header
                        drawHeaderOnCanvas(ctx, tempImg.width, item);

                        // Draw image
                        ctx.drawImage(tempImg, 0, 0, tempImg.width, imgH, 0, headerH, tempImg.width, imgH);

                        // Branding footer
                        ctx.fillStyle = '#8c8c8c';
                        ctx.font = `${Math.max(10, Math.floor(tempImg.width / 100))}px helvetica, sans-serif`;
                        ctx.textAlign = 'right';
                        ctx.fillText('equipatterns.com', canvas.width - 10, headerH + imgH + brandingH - 6);

                        canvas.toBlob((resultBlob) => {
                            URL.revokeObjectURL(url);
                            resolve(resultBlob || blob);
                        }, 'image/png');
                    };
                    tempImg.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
                    tempImg.src = url;
                });
            };

            if (allSelectedImages.length === 1) {
                toast({ title: 'Downloading PNG...', description: 'Converting to image.' });
                const response = await fetch(allSelectedImages[0].url);
                let blob = await response.blob();
                blob = await processImageBlob(blob, allSelectedImages[0].item, allSelectedImages[0].type === 'pattern');
                triggerBlobDownload(blob, `${allSelectedImages[0].name}.png`);
                toast({ title: 'Downloaded!', description: 'PNG image downloaded.' });
            } else {
                toast({ title: 'Preparing ZIP...', description: `Packaging ${allSelectedImages.length} images.` });
                const JSZipModule = (await import('jszip')).default;
                const zip = new JSZipModule();

                for (const img of allSelectedImages) {
                    try {
                        const response = await fetch(img.url);
                        let blob = await response.blob();
                        blob = await processImageBlob(blob, img.item, img.type === 'pattern');
                        zip.file(`${img.name}.png`, blob);
                    } catch (err) {
                        console.warn('Failed to fetch image:', img.name, err);
                    }
                }

                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const fileName = (project.project_name || 'Pattern').replace(/ /g, '_');
                triggerBlobDownload(zipBlob, `${fileName}_selected_images.zip`);
                toast({ title: 'Downloaded!', description: `${allSelectedImages.length} images downloaded as ZIP.` });
            }
        } catch (error) {
            console.error('PNG download error:', error);
            toast({ title: 'Download Failed', description: error.message || 'There was a problem.', variant: 'destructive' });
        } finally {
            setIsExporting(false);
        }
    };

    const handlePrint = async () => {
        if (selectedCount === 0) {
            toast({ title: 'No items selected', description: 'Please select at least one item.', variant: 'destructive' });
            return;
        }
        setIsExporting(true);
        try {
            toast({ title: 'Preparing to print...', description: 'Generating print-ready PDF.' });
            const pdfDataUri = await buildSelectedPdf();
            if (!pdfDataUri) {
                toast({ title: 'No content', description: 'No images available.', variant: 'destructive' });
                return;
            }
            const blob = dataUriToBlob(pdfDataUri);
            const blobUrl = URL.createObjectURL(blob);
            const printWindow = window.open(blobUrl, '_blank');
            if (printWindow) {
                printWindow.addEventListener('afterprint', () => URL.revokeObjectURL(blobUrl));
                printWindow.addEventListener('load', () => setTimeout(() => printWindow.print(), 500));
            }
        } catch (error) {
            console.error('Print error:', error);
            toast({ title: 'Print Failed', description: error.message || 'There was a problem.', variant: 'destructive' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleEmail = () => {
        if (selectedCount === 0) {
            toast({ title: 'No items selected', description: 'Please select at least one item.', variant: 'destructive' });
            return;
        }
        setShowEmailForm(true);
    };

    const handleSendEmail = async () => {
        if (!recipientEmail.trim()) {
            toast({ title: 'Email required', description: 'Please enter a recipient email address.', variant: 'destructive' });
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
            toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
            return;
        }

        setIsSendingEmail(true);
        try {
            toast({ title: 'Generating pattern...', description: 'Preparing selected items for email.' });

            // Use the same proven generatePatternBookPdf path
            const pdfDataUri = await buildSelectedPdf();
            if (!pdfDataUri) {
                toast({ title: 'No content', description: 'No images available for the selected items.', variant: 'destructive' });
                return;
            }

            const bookName = project.project_name || project.project_data?.showName || 'My Pattern';

            const { data, error } = await supabase.functions.invoke('send-pattern-book', {
                body: JSON.stringify({
                    email: recipientEmail.trim(),
                    pdfDataUri,
                    bookName,
                    senderName: senderName.trim() || undefined,
                    personalMessage: personalMessage.trim() || undefined,
                }),
            });

            if (error || data?.error) {
                throw new Error(error?.message || data?.error);
            }

            toast({ title: 'Email sent!', description: `Pattern sent to ${recipientEmail.trim()}.` });
            setRecipientEmail('');
            setSenderName('');
            setPersonalMessage('');
            setShowEmailForm(false);
        } catch (error) {
            console.error('Failed to send pattern email:', error);
            toast({
                variant: 'destructive',
                title: 'Failed to send',
                description: error.message || 'There was a problem sending your pattern. Please try again.',
            });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}/pattern-hub/${project.id}`;
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: 'Link Copied!', description: 'Shareable link has been copied to your clipboard.' });
    };

    const handleDownloadAll = async () => {
        setIsExporting(true);
        try {
            toast({ title: 'Generating PDF...', description: 'Preparing full download with all patterns and score sheets.' });
            // Select all items and use buildSelectedPdf to ensure both patterns + scoresheets are included
            const allKeys = new Set();
            patterns.forEach(p => allKeys.add(getItemKey(p, 'pattern')));
            scoreSheets.forEach(s => allKeys.add(getItemKey(s, 'scoresheet')));
            setSelectedItems(allKeys);

            // Reuse buildSelectedPdf with all items selected
            const pdfDataUri = await buildSelectedPdf();
            if (!pdfDataUri) {
                toast({ title: 'No content', description: 'No images available.', variant: 'destructive' });
                return;
            }

            const blob = dataUriToBlob(pdfDataUri);
            const fileName = (project.project_name || 'Pattern').replace(/ /g, '_');
            triggerBlobDownload(blob, `${fileName}.pdf`);
            toast({ title: 'Downloaded!', description: 'Full PDF with all patterns and score sheets downloaded.' });
        } catch (error) {
            console.error('Download all error:', error);
            toast({ title: 'Download Failed', description: error.message || 'There was a problem.', variant: 'destructive' });
        } finally {
            setIsExporting(false);
        }
    };

    // Render item card
    const renderItemCard = (item, type, index) => {
        const key = getItemKey(item, type);
        const isSelected = selectedItems.has(key);
        const imageUrl = type === 'pattern' ? item.imageUrl : item.image_url;
        const label = type === 'pattern' ? 'Pattern' : 'Score Sheet';
        const name = item.disciplineName || item.discipline || label;

        return (
            <div
                key={`${key}-${index}`}
                className={`border rounded-lg overflow-hidden transition-all cursor-pointer ${
                    isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => toggleItem(item, type)}
            >
                <div className="flex items-start gap-2 px-3 py-2 bg-gray-50 border-b">
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleItem(item, type)}
                        className="mt-0.5"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                        <Badge variant={type === 'pattern' ? 'default' : 'secondary'} className="text-xs shrink-0">
                            {label}
                        </Badge>
                        <p className="font-medium text-sm text-foreground mt-1 truncate">{name}</p>
                        {item.groupName && (
                            <p className="text-xs text-muted-foreground truncate">{item.groupName}</p>
                        )}
                    </div>
                </div>

                <div className="relative bg-white p-2 flex items-center justify-center" style={{ minHeight: '180px' }}>
                    {imageUrl ? (
                        <img src={imageUrl} alt={name} className="max-w-full max-h-[200px] object-contain"
                            style={type === 'pattern' ? { clipPath: 'inset(0 0 12% 0)' } : undefined}
                            onClick={(e) => { e.stopPropagation(); window.open(imageUrl, '_blank'); }}
                        />
                    ) : (
                        <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-gray-400 text-xs border-2 border-dashed border-gray-200 rounded">
                            No preview
                        </div>
                    )}
                </div>

                {item.divisions && item.divisions.length > 0 && (
                    <div className="px-3 py-2 bg-gray-50 border-t flex flex-wrap gap-1">
                        {item.divisions.map((division, divIndex) => {
                            const divName = division?.name || '';
                            if (!divName.trim()) return null;
                            return (
                                <span key={`div-${divIndex}`} className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                    {divName}{division.association && ` (${division.association})`}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-5xl max-h-[90vh] p-0 flex flex-col">
                {/* Header */}
                <div className="border-b px-6 py-4">
                    <h2 className="text-xl font-bold">{project?.project_name || 'Pattern Details'}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Select items to download, print, email, or share.
                    </p>
                </div>

                {showEmailForm ? (
                    /* Email Form View */
                    <div className="px-6 py-6 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowEmailForm(false)} disabled={isSendingEmail}>
                                <ArrowLeft className="h-4 w-4 mr-1" /> Back
                            </Button>
                            <h3 className="text-lg font-semibold">Send Selected Items via Email</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {selectedCount} item(s) selected — will be sent as a PDF attachment.
                        </p>
                        <div className="space-y-2">
                            <Label htmlFor="detail-recipient-email">Recipient Email *</Label>
                            <Input
                                id="detail-recipient-email"
                                type="email"
                                placeholder="judge@example.com"
                                value={recipientEmail}
                                onChange={(e) => setRecipientEmail(e.target.value)}
                                disabled={isSendingEmail}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="detail-sender-name">Your Name (optional)</Label>
                            <Input
                                id="detail-sender-name"
                                type="text"
                                placeholder="John Doe"
                                value={senderName}
                                onChange={(e) => setSenderName(e.target.value)}
                                disabled={isSendingEmail}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="detail-personal-message">Personal Message (optional)</Label>
                            <Textarea
                                id="detail-personal-message"
                                placeholder="Here's the pattern for the upcoming show..."
                                value={personalMessage}
                                onChange={(e) => setPersonalMessage(e.target.value)}
                                disabled={isSendingEmail}
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="outline" onClick={() => setShowEmailForm(false)} disabled={isSendingEmail}>
                                Cancel
                            </Button>
                            <Button onClick={handleSendEmail} disabled={isSendingEmail} className="gap-2">
                                {isSendingEmail ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                                ) : (
                                    <><Send className="h-4 w-4" /> Send Email</>
                                )}
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* Selection View */
                    <>
                        {/* Toolbar */}
                        <div className="border-b px-6 py-3 flex items-center justify-between gap-4 flex-wrap bg-muted/30">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={toggleAll}
                                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                                    {allSelected ? 'Deselect All' : 'Select All'}
                                </button>
                                <span className="text-sm text-muted-foreground">
                                    {selectedCount} of {totalCount} selected
                                </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Button size="sm" onClick={handleDownloadPdf} disabled={selectedCount === 0 || isExporting}>
                                    {isExporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                                    PDF
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleDownloadPng} disabled={selectedCount === 0 || isExporting}>
                                    <LucideImage className="mr-1.5 h-3.5 w-3.5" /> PNG
                                </Button>
                                <Button size="sm" variant="outline" onClick={handlePrint} disabled={selectedCount === 0 || isExporting}>
                                    <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleEmail} disabled={selectedCount === 0 || isExporting}>
                                    <Mail className="mr-1.5 h-3.5 w-3.5" /> Email
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleShare}>
                                    <Link2 className="mr-1.5 h-3.5 w-3.5" /> Share
                                </Button>
                                <div className="w-px h-6 bg-border mx-1" />
                                <Button size="sm" variant="ghost" onClick={handleDownloadAll} disabled={isExporting} className="text-muted-foreground">
                                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download All
                                </Button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="ml-3 text-muted-foreground">Loading patterns and score sheets...</span>
                                </div>
                            ) : totalCount === 0 ? (
                                <div className="text-center py-16 text-muted-foreground">
                                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>No patterns or score sheets found for this project.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {patterns.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                                Patterns ({patterns.length})
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {patterns.map((pattern, index) => renderItemCard(pattern, 'pattern', index))}
                                            </div>
                                        </div>
                                    )}
                                    {scoreSheets.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                                Score Sheets ({scoreSheets.length})
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {scoreSheets.map((scoresheet, index) => renderItemCard(scoresheet, 'scoresheet', index))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default PatternPortalDetailDialog;
