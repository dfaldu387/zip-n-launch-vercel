import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { fetchImageAsBase64 } from './pdfHelpers';
import { createGenericScoreSheetPdf, SCORESHEET_LAYOUT } from './genericScoreSheet';
import { parseLocalDate } from '@/lib/utils';

/**
 * Creates a PDF from an image (pattern or scoresheet).
 * Uses minimal margins and centres the image to fill the page.
 * If `judgeName` is provided, overlays it at the top of the page.
 */
const createPdfFromImage = async (imageUrl, title, judgeName = '') => {
    try {
        const base64 = await fetchImageAsBase64(imageUrl);
        if (!base64) return null;

        const doc = new jsPDF('p', 'pt', 'letter');
        const pageWidth = doc.internal.pageSize.getWidth();   // 612 pt
        const pageHeight = doc.internal.pageSize.getHeight();  // 792 pt
        const margin = SCORESHEET_LAYOUT.margin;

        // Reserve space at top for judge overlay (only if judge provided)
        const topReserve = judgeName ? 22 : 0;
        // Reserve space for branding footer
        const bottomReserve = 24;

        const imgMaxWidth = pageWidth - margin * 2;
        const imgMaxHeight = pageHeight - margin - topReserve - bottomReserve;

        const img = new Image();
        img.src = base64;

        await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
        });

        let imgWidth = img.width || 500;
        let imgHeight = img.height || 700;

        const scale = Math.min(imgMaxWidth / imgWidth, imgMaxHeight / imgHeight);
        imgWidth *= scale;
        imgHeight *= scale;

        const x = (pageWidth - imgWidth) / 2;
        // Position image closer to top, not vertically centered
        const y = margin + topReserve + 4;

        if (judgeName) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.text(`Judge: ${judgeName}`, margin, margin - 5);
        }

        const imageType = base64.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(base64, imageType, x, y, imgWidth, imgHeight);

        // Branding — bottom-right
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text('equipatterns.com', pageWidth - margin, pageHeight - 14, { align: 'right' });

        return doc.output('blob');
    } catch (error) {
        console.error("Error creating PDF from image:", error);
        return null;
    }
};

/**
 * Resolve the judge name for a discipline/group from projectData.
 * Priority: patternSelections[discId][groupId].judgeName
 *   → discipline.assignedJudge / judgeName
 *   → showDetails.judges[association_id] (Step 4 Number-of-Judges UI)
 *   → associationJudges[association_id]
 *   → any judge anywhere in the project
 */
const resolveJudgeForGroup = (projectData, discipline, group) => {
    const sel = projectData.patternSelections?.[discipline.id]?.[group.id];
    if (sel && typeof sel === 'object' && sel.judgeName) return sel.judgeName;

    const discAssigned = discipline?.assignedJudge || discipline?.judgeName;
    if (discAssigned) return discAssigned;

    const assocId = discipline.association_id;
    const showDetailsJudges = projectData.showDetails?.judges?.[assocId] || [];
    const showFirst = showDetailsJudges.find(j => j?.name);
    if (showFirst) return showFirst.name;

    const assocJudges = projectData.associationJudges?.[assocId];
    const first = assocJudges?.judges?.find(j => j?.name);
    if (first) return first.name;

    const anyShowJudge = Object.values(projectData.showDetails?.judges || {})
        .flat()
        .find(j => j?.name);
    if (anyShowJudge) return anyShowJudge.name;

    const anyJudge = Object.values(projectData.associationJudges || {})
        .flatMap(a => (a.judges || []))
        .find(j => j?.name);
    return anyJudge?.name || '';
};

/**
 * Sanitizes a filename by removing invalid characters
 */
const sanitizeFilename = (name) => {
    return (name || 'Untitled')
        .replace(/[<>:"/\\|?*]/g, '-')
        .replace(/\s+/g, '_')
        .trim()
        .substring(0, 100);
};

/**
 * Prefetch all scoresheet records referenced by the project in a single
 * round-trip per lookup strategy, so per-group lookups become synchronous.
 *
 * Returns { byPatternId, byAssocDiscipline } — byAssocDiscipline is keyed as
 * `${abbrev}::${disciplineNameLower}` and used for VRH + fallback matches.
 */
const prefetchScoresheets = async (projectData, associationsData) => {
    const byPatternId = new Map();
    const byAssocDiscipline = new Map();

    const patternIds = new Set();
    const assocDisciplineQueries = new Set(); // `${abbrev}::${disciplineName}`

    const disciplines = projectData.disciplines || [];
    disciplines.forEach((discipline) => {
        const assoc = associationsData?.find(a => a.id === discipline.association_id);
        const abbrev = assoc?.abbreviation;

        // Collect pattern_ids from selections
        const groupSels = projectData.patternSelections?.[discipline.id] || {};
        Object.values(groupSels).forEach(sel => {
            if (!sel) return;
            const pid = typeof sel === 'object' ? (sel.patternId || sel.id) : sel;
            if (pid && !isNaN(parseInt(pid))) patternIds.add(parseInt(pid));
        });

        // Collect VRH discipline queries
        const disciplineKey = `${discipline.association_id}-${discipline.sub_association_type || 'none'}-${discipline.name}-${discipline.pattern_type || 'none'}`;
        const vrhSel = projectData.vrhRanchCowWorkSelections?.[disciplineKey];
        if (vrhSel && abbrev) {
            let name = 'VRH-RHC Ranch CowWork';
            if (vrhSel === 'rookie') name = 'VRH-RHC Ranch CowWork Rookie';
            else if (vrhSel === 'limited') name = 'VRH-RHC Ranch CowWork Limited';
            assocDisciplineQueries.add(`${abbrev}::${name}`);
        }

        // Collect discipline-name fallback queries
        if (abbrev && discipline.name) {
            assocDisciplineQueries.add(`${abbrev}::${discipline.name}`);
        }
    });

    // Single batch by pattern_id
    if (patternIds.size > 0) {
        try {
            const { data } = await supabase
                .from('tbl_scoresheet')
                .select('id, pattern_id, image_url, storage_path, discipline, association_abbrev')
                .in('pattern_id', Array.from(patternIds));
            (data || []).forEach(row => {
                if (row.pattern_id != null) byPatternId.set(row.pattern_id, row);
                if (row.association_abbrev && row.discipline) {
                    byAssocDiscipline.set(`${row.association_abbrev}::${row.discipline.toLowerCase()}`, row);
                }
            });
        } catch (err) {
            console.error('prefetchScoresheets: pattern_id batch failed', err);
        }
    }

    // Batch by association + discipline (ilike cannot be batched, so OR via .or())
    if (assocDisciplineQueries.size > 0) {
        const pending = Array.from(assocDisciplineQueries).filter(k => {
            // Skip if we already have this record from the pattern_id batch
            const [abbrev, disc] = k.split('::');
            return !byAssocDiscipline.has(`${abbrev}::${disc.toLowerCase()}`);
        });
        // Fetch in one go per unique association abbreviation
        const byAbbrev = new Map();
        pending.forEach(k => {
            const [abbrev, disc] = k.split('::');
            if (!byAbbrev.has(abbrev)) byAbbrev.set(abbrev, []);
            byAbbrev.get(abbrev).push(disc);
        });
        for (const [abbrev, discs] of byAbbrev.entries()) {
            try {
                const { data } = await supabase
                    .from('tbl_scoresheet')
                    .select('id, pattern_id, image_url, storage_path, discipline, association_abbrev')
                    .eq('association_abbrev', abbrev)
                    .in('discipline', discs);
                (data || []).forEach(row => {
                    if (row.discipline) {
                        byAssocDiscipline.set(`${abbrev}::${row.discipline.toLowerCase()}`, row);
                    }
                    if (row.pattern_id != null && !byPatternId.has(row.pattern_id)) {
                        byPatternId.set(row.pattern_id, row);
                    }
                });
            } catch (err) {
                console.error('prefetchScoresheets: assoc/discipline batch failed', err);
            }
        }
    }

    return { byPatternId, byAssocDiscipline };
};

/**
 * Synchronous scoresheet resolver using prefetched maps.
 * Follows the same priority order as the original implementation.
 */
const getScoresheetForGroup = (discipline, group, projectData, associationsData, cache) => {
    const disciplineKey = `${discipline.association_id}-${discipline.sub_association_type || 'none'}-${discipline.name}-${discipline.pattern_type || 'none'}`;

    // Priority 1: Step 3 per-group selection
    const patternSelection = projectData.patternSelections?.[discipline.id]?.[group.id];
    if (patternSelection && typeof patternSelection === 'object' && patternSelection.scoresheetData) {
        return patternSelection.scoresheetData;
    }

    const association = associationsData?.find(a => a.id === discipline.association_id);
    const abbrev = association?.abbreviation;

    // Priority 2: VRH-RHC Ranch CowWork
    const vrhSelection = projectData.vrhRanchCowWorkSelections?.[disciplineKey];
    if (vrhSelection && abbrev) {
        let name = 'VRH-RHC Ranch CowWork';
        if (vrhSelection === 'rookie') name = 'VRH-RHC Ranch CowWork Rookie';
        else if (vrhSelection === 'limited') name = 'VRH-RHC Ranch CowWork Limited';
        const row = cache.byAssocDiscipline.get(`${abbrev}::${name.toLowerCase()}`);
        if (row) return row;
    }

    // Priority 3: Step 2 user-selected scoresheet
    const userSelectedScoresheet = projectData.disciplineScoresheetSelections?.[disciplineKey];
    if (userSelectedScoresheet && userSelectedScoresheet.image_url) {
        return userSelectedScoresheet;
    }

    // Priority 4: by pattern_id
    const selectedPatternId = patternSelection
        ? (typeof patternSelection === 'object' ? (patternSelection.patternId || patternSelection.id) : patternSelection)
        : null;
    if (selectedPatternId) {
        const row = cache.byPatternId.get(parseInt(selectedPatternId));
        if (row) return row;
    }

    // Priority 5: association + discipline name fallback
    if (abbrev && discipline.name) {
        const row = cache.byAssocDiscipline.get(`${abbrev}::${discipline.name.toLowerCase()}`);
        if (row) return row;
    }

    return null;
};

/**
 * Downloads the pattern book folder as a ZIP file
 * Structure:
 * - PatternBookName/
 *   - DisciplineName/
 *     - GroupName/
 *       - pattern.pdf
 *       - scoresheet.pdf
 */
export const downloadPatternBookFolder = async (projectData, projectName, onProgress) => {
    const zip = new JSZip();
    const rootFolderName = sanitizeFilename(projectName || projectData.showName || 'Pattern_Book');
    const rootFolder = zip.folder(rootFolderName);

    const disciplines = projectData.disciplines || [];
    const patternSelections = projectData.patternSelections || {};

    // Fetch associations data for scoresheet lookups
    let associationsData = [];
    try {
        const { data } = await supabase.from('associations').select('id, abbreviation, name');
        associationsData = data || [];
    } catch (err) {
        console.error('Error fetching associations:', err);
    }

    // Prefetch ALL scoresheet records in batched queries (was N+1 per group)
    const scoresheetCache = await prefetchScoresheets(projectData, associationsData);

    // Collect all pattern IDs for batch fetching
    const patternIds = new Set();

    // Pattern selections use discipline ID and group ID as keys
    disciplines.forEach((discipline) => {
        const disciplineSelections = patternSelections[discipline.id];
        if (disciplineSelections && typeof disciplineSelections === 'object') {
            Object.values(disciplineSelections).forEach(selection => {
                if (selection) {
                    const patternId = typeof selection === 'object' 
                        ? (selection.patternId || selection.id) 
                        : selection;
                    if (patternId && !isNaN(parseInt(patternId))) {
                        patternIds.add(parseInt(patternId));
                    }
                }
            });
        }
    });

    console.log('Collected pattern IDs for download:', Array.from(patternIds));

    // Fetch pattern data from database
    const patternDataMap = new Map();

    if (patternIds.size > 0) {
        try {
            console.log('Fetching pattern images for IDs:', Array.from(patternIds));
            
            // Fetch from tbl_pattern_media using pattern_id
            const { data: mediaData, error: mediaError } = await supabase
                .from('tbl_pattern_media')
                .select('pattern_id, image_url')
                .in('pattern_id', Array.from(patternIds));

            if (mediaError) {
                console.error('Error fetching from tbl_pattern_media:', mediaError);
            }

            if (mediaData && mediaData.length > 0) {
                console.log('Found pattern media data:', mediaData.length, 'records');
                mediaData.forEach(m => {
                    if (m.image_url) {
                        patternDataMap.set(m.pattern_id, m.image_url);
                    }
                });
            }

            console.log('Pattern data map after fetch:', Object.fromEntries(patternDataMap));
        } catch (error) {
            console.error('Error fetching pattern data:', error);
        }
    }

    console.log(`Fetched ${patternDataMap.size} pattern images for ${patternIds.size} pattern IDs`);

    // Process disciplines and create folder structure
    let processedCount = 0;
    const totalItems = disciplines.reduce((sum, d) => sum + (d.patternGroups?.length || 1), 0);

    for (const discipline of disciplines) {
        // Skip disciplines without pattern groups
        const groups = discipline.patternGroups || [];
        if (groups.length === 0) continue;

        const disciplineName = sanitizeFilename(discipline.name || 'Discipline');
        const disciplineFolder = rootFolder.folder(disciplineName);

        for (const group of groups) {
            // Create group folder name from divisions
            const divisions = group.divisions || [];
            let groupName = 'Group';
            
            if (divisions.length > 0) {
                const divisionNames = divisions.map(d => {
                    if (typeof d === 'string') return d;
                    return d.division || d.name || d.id || 'Division';
                });
                groupName = sanitizeFilename(divisionNames.join('_'));
            } else {
                groupName = sanitizeFilename(group.name || `Group_${group.id || 'default'}`);
            }
            
            const groupFolder = disciplineFolder.folder(groupName);

            // Get pattern selection for this group
            const patternSelection = patternSelections[discipline.id]?.[group.id];
            const patternId = patternSelection
                ? (typeof patternSelection === 'object' 
                    ? (patternSelection.patternId || patternSelection.id) 
                    : patternSelection)
                : null;

            // Detect special selection types
            const isCustomRequest = patternSelection?.type === 'customRequest';

            if (isCustomRequest) {
                // --- Custom request: include uploaded file + generic scoresheet ---

                // Include uploaded custom pattern file if available
                if (patternSelection.uploadedFileUrl) {
                    try {
                        const base64 = await fetchImageAsBase64(patternSelection.uploadedFileUrl);
                        if (base64) {
                            const fileName = patternSelection.uploadedFileName || 'Custom_Pattern';
                            const pdfBlob = await createPdfFromImage(patternSelection.uploadedFileUrl, fileName);
                            if (pdfBlob) {
                                groupFolder.file(`${sanitizeFilename(fileName)}.pdf`, pdfBlob);
                                console.log(`✓ Added uploaded custom pattern: ${fileName}`);
                            }
                        }
                    } catch (err) {
                        console.error('Failed to include uploaded custom pattern:', err);
                    }
                }

                // Generate generic scoresheet (no maneuvers)
                const divisions = (group.divisions || []).map(d =>
                    typeof d === 'string' ? d : (d.division || d.name || '')
                ).join(' / ');
                let competitionDate = projectData.startDate;
                if (group.divisions?.length > 0) {
                    const divDate = discipline.divisionDates?.[group.divisions[0]?.id || group.divisions[0]];
                    if (divDate) competitionDate = divDate;
                }
                const dateStr = competitionDate ? format(parseLocalDate(competitionDate), 'MM-dd-yyyy') : '';
                const assoc = associationsData?.find(a => a.id === discipline.association_id);
                const resolvedJudge = resolveJudgeForGroup(projectData, discipline, group);
                const genericBlob = createGenericScoreSheetPdf({
                    association: assoc?.abbreviation || assoc?.name || '',
                    showName: projectData.showName || '',
                    discipline: discipline.name || '',
                    division: divisions,
                    date: dateStr,
                    judge: resolvedJudge,
                });
                groupFolder.file(`${sanitizeFilename(discipline.name)}_generic_scoresheet.pdf`, genericBlob);
                console.log(`✓ Added generic scoresheet for custom request: ${discipline.name}`);

            } else {
                // --- Standard pattern flow ---

                // Add pattern PDF
                const numericPatternId = patternId ? parseInt(patternId) : null;
                console.log(`Looking for pattern ID ${numericPatternId} in map. Has it? ${patternDataMap.has(numericPatternId)}`);

                if (numericPatternId && patternDataMap.has(numericPatternId)) {
                    const patternUrl = patternDataMap.get(numericPatternId);
                    console.log(`Found pattern URL for ${numericPatternId}:`, patternUrl);
                    if (patternUrl) {
                        const patternName = typeof patternSelection === 'object' && patternSelection.patternName
                            ? patternSelection.patternName
                            : `Pattern_${patternId}`;

                        console.log(`Creating PDF for pattern: ${patternName} from URL: ${patternUrl}`);
                        const pdfBlob = await createPdfFromImage(patternUrl, patternName);
                        if (pdfBlob) {
                            groupFolder.file(`${sanitizeFilename(patternName)}.pdf`, pdfBlob);
                            console.log(`✓ Added pattern PDF: ${patternName}`);
                        } else {
                            console.error(`✗ Failed to create PDF for pattern: ${patternName}`);
                        }
                    }
                } else {
                    console.warn(`Pattern ID ${numericPatternId} not found in pattern data map`);
                }

                // Get scoresheet from prefetched cache (sync, no per-group query)
                const scoresheetData = getScoresheetForGroup(discipline, group, projectData, associationsData, scoresheetCache);

                if (scoresheetData && scoresheetData.image_url) {
                    const scoresheetName = scoresheetData.file_name ||
                                           scoresheetData.display_name ||
                                           scoresheetData.discipline ||
                                           `Scoresheet_${discipline.name}`;

                    const judgeName = resolveJudgeForGroup(projectData, discipline, group);
                    const pdfBlob = await createPdfFromImage(scoresheetData.image_url, scoresheetName, judgeName);
                    if (pdfBlob) {
                        const judgeSuffix = judgeName ? `_${sanitizeFilename(judgeName)}` : '';
                        groupFolder.file(`${sanitizeFilename(scoresheetName)}${judgeSuffix}_scoresheet.pdf`, pdfBlob);
                    }
                }
            }

            processedCount++;
            if (onProgress) {
                onProgress(Math.round((processedCount / totalItems) * 50)); // First 50% for processing
            }
        }
    }

    // Generate and download the ZIP file
    const content = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    }, (metadata) => {
        if (onProgress) {
            onProgress(50 + Math.round(metadata.percent / 2)); // Last 50% for zip generation
        }
    });

    // Trigger download
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${rootFolderName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
};
