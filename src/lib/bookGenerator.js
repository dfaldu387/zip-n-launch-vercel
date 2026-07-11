import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fetchImageAsBase64, fetchPatternAndScoresheetAssets, compressImage, cropPatternImageSmart } from './pdfHelpers';
import { supabase } from '@/lib/supabaseClient';
import { parseLocalDate } from '@/lib/utils';
import patternDiagram from '@/assets/pattern-diagram-sample.png';
import { drawGenericScoreSheetPage, SCORESHEET_LAYOUT } from './genericScoreSheet';
import { generateCustomLayoutPdf } from './customLayoutRenderer';
import { getPatternSelectionForAssoc, isAssocKeyedEntry } from './patternSelectionHelpers';
import { overlayCustomPatternPdfs } from './pdfUtils';

export const generatePatternBookPdf = async (pbbData, options = {}) => {
    console.log('Generating PDF for', pbbData);

    // Hub mode: skip cover page, TOC, and pattern list — only output patterns + scoresheets
    const skipCoverAndToc = options.skipCoverAndToc || false;

    // Get selected layout (default to 'layout-a' if not specified)
    const selectedLayout = pbbData.layoutSelection || 'layout-a';
    console.log('Selected layout:', selectedLayout);

    // Layout C (Custom Pattern Book) uses a separate page/slot engine that
    // renders from a user-configured layout instead of iterating disciplines.
    if (selectedLayout === 'layout-c') {
        return generateCustomLayoutPdf(pbbData);
    }

    // Feature flag: class number display (set to false to hide auto-generated numbers)
    const showClassNumbers = pbbData.showClassNumbers || false;
    
    const doc = new jsPDF('p', 'pt', 'letter');
    const pageHeight = doc.internal.pageSize.getHeight(); // 792 pt (11 in)
    const pageWidth = doc.internal.pageSize.getWidth();   // 612 pt (8.5 in)
    const margin = 36;
    // Pattern images use a tighter margin to maximize readable size.
    // Headers/footers still use `margin` for safe white space.
    const PATTERN_IMAGE_MARGIN = 12;
    let yPos = margin;
    let toc = [];
    // Pages that draw their own top banner (e.g. scoresheet pages) and must
    // not receive the generic addPageHeader during the hub-mode finalize loop —
    // otherwise the two headers collide.
    const pagesWithOwnHeader = new Set();
    // Uploaded custom-pattern PDFs to embed onto their placeholder pages after
    // the jsPDF book is built (jsPDF can't import PDFs; pdf-lib does it as a
    // post-step). Each entry records the placeholder page + content box.
    const customPdfOverlays = [];

    // --- Helper Functions ---
    const addPageHeader = (text, rightText = null, logoBase64 = null) => {
        const logoSize = 24;
        const textX = logoBase64 ? margin + logoSize + 6 : margin;
        if (logoBase64) {
            try {
                const imgType = logoBase64.substring(logoBase64.indexOf('/') + 1, logoBase64.indexOf(';'));
                let drawW = logoSize, drawH = logoSize, dx = margin, dy = margin / 2 + 1;
                try {
                    const props = doc.getImageProperties(logoBase64);
                    const ratio = Math.min(logoSize / props.width, logoSize / props.height);
                    drawW = props.width * ratio;
                    drawH = props.height * ratio;
                    dx = margin + (logoSize - drawW) / 2;
                    dy = margin / 2 + 1 + (logoSize - drawH) / 2;
                } catch (_) {}
                doc.addImage(logoBase64, imgType.toUpperCase(), dx, dy, drawW, drawH);
            } catch (e) { /* ignore logo errors */ }
        }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(text, textX, margin / 2 + 10);
        if (rightText) {
            doc.text(rightText, pageWidth - margin, margin / 2 + 10, { align: 'right' });
        }
    };

    const addPageFooter = (pageNumber) => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120, 120, 120);
        const footerText = `${pbbData.showName || 'Pattern Book'} – Page ${pageNumber}`;
        doc.text(footerText, margin, pageHeight - 18);
        // Branding — always bottom-right
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text('equipatterns.com', pageWidth - margin, pageHeight - 18, { align: 'right' });
    };
    
    const addNewPage = () => {
        doc.addPage();
        yPos = margin + 30;
    };

    // Estimate the vertical space (pt) the pattern-language block will occupy.
    // Used before rendering the pattern image so the image can be sized to
    // leave room for maneuvers below it on the same page.
    const estimateManeuversHeight = (maneuvers, fontFamily = 'helvetica') => {
        if (!Array.isArray(maneuvers) || maneuvers.length === 0) return 0;
        const savedFontName = doc.getFont().fontName;
        const savedStyle = doc.getFont().fontStyle;
        const savedSize = doc.getFontSize();

        doc.setFont(fontFamily, 'normal');
        doc.setFontSize(10);

        // 18 gap above title + 12 title line + 6 gap below title.
        // The 18pt top gap must match the `yPos += 18` in
        // renderPatternLanguageInline so the image reserves enough room and the
        // "Pattern Language" heading never collides with the pattern above it.
        let height = 18 + 12 + 6;
        const textWidth = pageWidth - margin * 2;
        const sorted = [...maneuvers].sort((a, b) => (a.step_no || 0) - (b.step_no || 0));
        for (const m of sorted) {
            const stepLabel = m.step_no != null ? `${m.step_no}.` : '\u2022';
            const line = `${stepLabel} ${m.instruction || ''}`.trim();
            const wrapped = doc.splitTextToSize(line, textWidth);
            height += wrapped.length * 11 + 1;
        }

        doc.setFont(savedFontName, savedStyle);
        doc.setFontSize(savedSize);
        return height + 4; // small bottom padding
    };

    // Render "Pattern Language" inline on the current page starting at yPos.
    // Only spills to a new page if individual maneuvers overflow the bottom
    // margin — the caller is expected to have reserved enough room via
    // estimateManeuversHeight(). Updates yPos to the end of the rendered block.
    const renderPatternLanguageInline = (maneuvers, titleBits = {}, fontFamily = 'helvetica') => {
        if (!Array.isArray(maneuvers) || maneuvers.length === 0) return;

        // Clear separation from the pattern image above so the heading never
        // visually collides with baked-in text at the image's bottom edge.
        // Must match the 18pt reserved in estimateManeuversHeight().
        yPos += 18;
        const { discipline, patternNumber } = titleBits;
        const langTitle = patternNumber
            ? `${discipline || 'Pattern'} \u2013 Pattern ${patternNumber} \u2013 Pattern Language`
            : 'Pattern Language';

        doc.setFont(fontFamily, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(langTitle, pageWidth / 2, yPos, { align: 'center' });
        yPos += 12;

        doc.setFont(fontFamily, 'normal');
        doc.setFontSize(10);
        const textWidth = pageWidth - margin * 2;
        const bottomReserve = 30;
        const sorted = [...maneuvers].sort((a, b) => (a.step_no || 0) - (b.step_no || 0));
        for (const m of sorted) {
            const stepLabel = m.step_no != null ? `${m.step_no}.` : '\u2022';
            const line = `${stepLabel} ${m.instruction || ''}`.trim();
            const wrapped = doc.splitTextToSize(line, textWidth);
            if (yPos + wrapped.length * 11 > pageHeight - bottomReserve) {
                doc.addPage();
                yPos = margin + 20;
            }
            doc.text(wrapped, margin, yPos);
            yPos += wrapped.length * 11 + 1;
        }
    };

    // Helper function to remove first word, "Pro", and "Non-Pro" from division names
    const removeFirstWord = (name) => {
        if (!name) return name;
        let cleaned = name;
        
        // Remove first word and any separator (dash, hyphen, etc.)
        cleaned = cleaned.replace(/^[^\s-]+\s*[-–—]\s*/, '').trim();
        
        // Remove "Pro" or "Non-Pro" at the start
        cleaned = cleaned.replace(/^(Pro|Non-Pro)\s*[-–—]?\s*/i, '').trim();
        
        // If no separator found and still original, try removing just the first word
        if (cleaned === name) {
            const parts = name.split(/\s+/);
            // Skip first word if it's not "Pro" or "Non-Pro"
            if (parts.length > 1 && !/^(Pro|Non-Pro)$/i.test(parts[0])) {
                cleaned = parts.slice(1).join(' ');
            } else if (parts.length > 1) {
                // If first word is "Pro" or "Non-Pro", remove it and separator if present
                cleaned = parts.slice(1).join(' ').replace(/^\s*[-–—]\s*/, '').trim();
            }
        }
        
        return cleaned || name;
    };

    // Helper function to format division name with Go label if applicable
    const formatDivisionWithGo = (division) => {
        const baseName = removeFirstWord(division.division || '');
        // Only add Go label if this division has a goNumber (meaning it's part of a two-go class)
        if (division.goNumber === 1 || division.goNumber === 2) {
            return `${baseName} (Go ${division.goNumber})`;
        }
        return baseName;
    };

    // If every division in a group shares the same go (a "Go 1" group or a
    // "Go 2" group — they are always split into separate groups), return that
    // go number so the label can be shown ONCE per class instead of repeated on
    // each division. Returns null for single-go classes or mixed groups, which
    // keeps the original per-division formatting.
    const groupGoNumber = (divisions) => {
        if (!divisions || !divisions.length) return null;
        const gos = divisions.map(d => d.goNumber);
        if (!gos.every(n => n === 1 || n === 2)) return null;
        return gos.every(n => n === gos[0]) ? gos[0] : null;
    };

    // Division list for a group: when the whole group is one go, drop the
    // per-division "(Go N)" and return a single trailing "— Go N" instead.
    const formatGroupDivisions = (group, separator = '/') => {
        const go = groupGoNumber(group.divisions);
        if (go) {
            const names = group.divisions.map(d => removeFirstWord(d.division || '')).join(separator);
            return { text: names, goSuffix: ` — Go ${go}` };
        }
        return { text: (group.divisions || []).map(d => formatDivisionWithGo(d)).join(separator), goSuffix: '' };
    };

    const addImageToPage = async (base64, x, y, width, height) => {
        if (!base64) return;
        try {
            const imageType = base64.substring(base64.indexOf('/') + 1, base64.indexOf(';'));
            doc.addImage(base64, imageType.toUpperCase(), x, y, width, height);
        } catch (e) {
            console.error("Failed to add image", e);
        }
    };

    // Place an image inside a centered box, preserving its aspect ratio.
    // Used for logos so they never stretch or distort.
    const addContainedImage = async (base64, boxX, boxY, boxW, boxH) => {
        if (!base64) return;
        try {
            const props = doc.getImageProperties(base64);
            const ratio = Math.min(boxW / props.width, boxH / props.height);
            const drawW = props.width * ratio;
            const drawH = props.height * ratio;
            const x = boxX + (boxW - drawW) / 2;
            const y = boxY + (boxH - drawH) / 2;
            await addImageToPage(base64, x, y, drawW, drawH);
        } catch (e) {
            await addImageToPage(base64, boxX, boxY, boxW, boxH);
        }
    };

    // Resolve the judge name for a given discipline/group.
    // Priority:
    //   1. patternSelections[discId][groupId].judgeName (per-group assignment in Step 6)
    //   2. groupJudges[discIndex][groupIndex]          (per-group assignment in Step 5)
    //   3. discipline.assignedJudge / judgeName
    //   4. showDetails.judges[association_id]          (Step 4 Number-of-Judges UI)
    //   5. associationJudges[association_id]
    //   6. any judge anywhere
    const resolveJudgeName = (discipline, group, discIndex, groupIndex) => {
        const sel = pbbData.patternSelections?.[discipline?.id]?.[group?.id];
        if (sel && typeof sel === 'object' && sel.judgeName) return sel.judgeName;

        // Step 5 assigns judges via groupJudges: { [discIndex]: { [groupIndex]: name } }
        const gj = pbbData.groupJudges;
        if (gj && discIndex != null && groupIndex != null) {
            const byIndex = gj?.[discIndex]?.[groupIndex] || gj?.[String(discIndex)]?.[String(groupIndex)];
            if (byIndex && typeof byIndex === 'string' && byIndex.trim()) return byIndex.trim();
            // Fall back to the first judge on this discipline if the specific group has none
            const discBucket = gj?.[discIndex] || gj?.[String(discIndex)];
            if (discBucket && typeof discBucket === 'object') {
                const firstName = Object.values(discBucket).find(v => typeof v === 'string' && v.trim());
                if (firstName) return firstName.trim();
            }
        }

        const discAssigned = discipline?.assignedJudge || discipline?.judgeName;
        if (discAssigned) return discAssigned;

        const assocId = discipline?.association_id;
        const showDetailsJudges = pbbData.showDetails?.judges?.[assocId] || [];
        const showFirst = showDetailsJudges.find(j => j?.name);
        if (showFirst) return showFirst.name;

        const assocJudges = pbbData.associationJudges?.[assocId];
        const first = assocJudges?.judges?.find(j => j?.name);
        if (first) return first.name;

        const anyShowJudge = Object.values(pbbData.showDetails?.judges || {})
            .flat()
            .find(j => j?.name);
        if (anyShowJudge) return anyShowJudge.name;

        const anyJudge = Object.values(pbbData.associationJudges || {})
            .flatMap(a => (a.judges || []))
            .find(j => j?.name);
        return anyJudge?.name || '';
    };

    // Draw a labeled banner at the top of a scoresheet page with the judge
    // name, class/discipline, division, and date. The client asked for the
    // score sheet to be identified at the top instead of just showing the
    // raw image.
    const drawScoreSheetHeader = ({ judgeName, disciplineName, division, assocName, dateStr }) => {
        const bannerH = 34;
        // Light grey band across the page top so the labels are visible even
        // when the scoresheet image starts near the top margin.
        doc.setFillColor(244, 247, 252);
        doc.rect(0, 0, pageWidth, bannerH, 'F');
        doc.setDrawColor(180, 190, 210);
        doc.setLineWidth(0.5);
        doc.line(0, bannerH, pageWidth, bannerH);

        // Line 1 (left): Association • Discipline
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        const line1Left = [assocName, (disciplineName || '').toUpperCase()]
            .filter(Boolean)
            .join('  •  ');
        doc.text(line1Left || '', margin, 14, { maxWidth: pageWidth - margin * 2 - 120 });

        // Line 1 (right): Date
        if (dateStr) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(dateStr, pageWidth - margin, 14, { align: 'right' });
        }

        // Line 2 (left): Division
        if (division) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(60, 60, 60);
            doc.text(division, margin, 27, { maxWidth: pageWidth - margin * 2 - 160 });
        }

        // Line 2 (right): Judge
        if (judgeName) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(`Judge: ${judgeName}`, pageWidth - margin, 27, { align: 'right' });
        }
    };

    // Auto-fit a line of text inside a bounding box by shrinking the font
    // until the text fits on at most `maxLines` lines. Returns the effective
    // font size used and the wrapped lines array so the caller can advance
    // yPos correctly instead of letting long titles overlap later content.
    const fitTextLines = (text, { maxWidth, maxLines = 2, startSize, minSize = 10, font = 'helvetica', style = 'bold' }) => {
        if (!text) return { size: startSize, lines: [''] };
        doc.setFont(font, style);
        let size = startSize;
        let lines = [];
        while (size >= minSize) {
            doc.setFontSize(size);
            lines = doc.splitTextToSize(text, maxWidth);
            if (lines.length <= maxLines) break;
            size -= 2;
        }
        // Final clamp in case even minSize still overflows — truncate extras.
        if (lines.length > maxLines) {
            lines = lines.slice(0, maxLines);
        }
        return { size, lines };
    };

    // Legacy alias — still used by other layout code paths.
    const drawJudgeOverlay = (judgeName) => {
        if (!judgeName) return;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(`Judge: ${judgeName}`, margin, margin);
    };

    // Alias for the shared smart-crop utility (removes baked-in header/footer
    // text from pattern images, keeping only the diagram).
    const cropPatternImage = (base64) => cropPatternImageSmart(base64);

    const formatAssociationName = (assocId) => {
        return assocId?.toUpperCase() || 'HORSE ASSOCIATION';
    };

    // Draw social media icons on cover page (colored circles with letters, clickable)
    const drawSocialIcons = (yPosition) => {
        const socials = [
            { url: pbbData.marketing?.facebook, color: [24, 119, 242], label: 'f' },
            { url: pbbData.marketing?.instagram, color: [228, 64, 95], label: 'ig' },
            { url: pbbData.marketing?.youtube, color: [255, 0, 0], label: 'yt' },
        ].filter(s => s.url && s.url.trim());

        if (socials.length === 0) return;

        const radius = 8;
        const spacing = 30;
        const totalWidth = socials.length * (radius * 2) + (socials.length - 1) * (spacing - radius * 2);
        let cx = (pageWidth - totalWidth) / 2 + radius;

        for (const social of socials) {
            // Colored circle
            doc.setFillColor(social.color[0], social.color[1], social.color[2]);
            doc.circle(cx, yPosition, radius, 'F');
            // White letter
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(social.label.length > 1 ? 7 : 10);
            doc.text(social.label, cx, yPosition + (social.label.length > 1 ? 2.5 : 3.5), { align: 'center' });
            // Clickable link area
            doc.link(cx - radius, yPosition - radius, radius * 2, radius * 2, { url: social.url });
            cx += spacing;
        }
        // Reset text color
        doc.setTextColor(0, 0, 0);
    };

    // Helper: Check if discipline should have pattern pages in the PDF
    const isPatternDiscipline = (discipline) => {
        if (!discipline.pattern) return false;
        if (discipline.pattern_type === 'scoresheet_only') return false;
        return true;
    };

    // Helper: Extract pattern number from pdf_file_name (e.g., "WesternRiding0001.L1" -> 1)
    const extractPatternNumber = (fileName) => {
        if (!fileName) return null;
        const nameWithoutExt = fileName.replace(/\.(pdf|PDF)$/, '');
        const match = nameWithoutExt.match(/(\d+)(?:\.|$)/);
        if (match) return parseInt(match[1], 10) || null;
        const fallback = nameWithoutExt.match(/(\d+)$/);
        return fallback ? (parseInt(fallback[1], 10) || null) : null;
    };

    // Helper: Format human-readable pattern display name from patternSelection object
    const getPatternDisplayName = (patternSelection) => {
        if (!patternSelection) return null;
        const num = extractPatternNumber(patternSelection.patternName);
        let display = num !== null ? `Pattern ${num}` : (patternSelection.patternName || null);
        if (display && patternSelection.version && patternSelection.version !== 'ALL') {
            display = `${display} - ${patternSelection.version}`;
        }
        return display;
    };

    // --- Fetch Assets ---
    const assets = await fetchPatternAndScoresheetAssets(pbbData);
    let coverImageBase64 = null;
    if (pbbData.coverPageOption === 'upload' && pbbData.marketing?.coverImage?.fileUrl) {
        coverImageBase64 = await fetchImageAsBase64(pbbData.marketing.coverImage.fileUrl);
    }
    
    // Load show logo (for cover page and header). Prefer explicit showLogoUrl,
    // otherwise fall back to the first uploaded "Show Logos" file from Step 6.
    let showLogoCoverBase64 = null;
    let showLogoHeaderBase64 = null;
    const uploadedShowLogo = (pbbData.generalMarketing || []).find(
        f => f && (f.fileUrl || f.url) && /\.(png|jpe?g|gif|webp|svg)$/i.test(f.fileName || f.customName || f.fileUrl || '')
    );
    const showLogoSource = pbbData.showLogoUrl || uploadedShowLogo?.fileUrl || uploadedShowLogo?.url || null;
    if (showLogoSource) {
        const rawLogo = await fetchImageAsBase64(showLogoSource);
        if (rawLogo) {
            showLogoCoverBase64 = await compressImage(rawLogo, 200, 200, 0.8);
            showLogoHeaderBase64 = await compressImage(rawLogo, 80, 80, 0.7);
        }
    }

    // Load dummy pattern graph image as fallback
    const dummyPatternBase64 = await fetchImageAsBase64(patternDiagram);
    
    // Fetch real pattern images from database
    const patternImagesMap = new Map();
    // pattern_id -> sorted array of { step_no, instruction } for the
    // "Pattern Language" page rendered after each pattern image.
    const patternManeuversMap = new Map();
    // Map of pattern_id -> association_name (e.g. "AQHA", "APHA") used to label
    // the correct breed/association per class when generating pattern pages.
    const patternAssociationMap = new Map();
    const patternIds = new Set();
    // OP/CAPO patterns use string IDs like "op:<uuid>" and live in the `patterns`
    // table with preview_image_url, separate from the legacy numeric tbl_patterns.
    const opPatternIds = new Set();

    // Collect all pattern IDs from patternSelections
    // patternSelections can be keyed by discipline ID or index, and group ID or index.
    // A per-group entry is either a legacy scalar/object (applies to every assoc)
    // or an association-keyed map { AQHA: {...}, APHA: {...} } — both shapes must
    // be walked so the DB fetch grabs every selected pattern image, not just one.
    const addPatternIdFromValue = (value) => {
        let pid = null;
        if (typeof value === 'object' && value !== null) {
            pid = value.patternId || value.id;
            if (!pid || (typeof pid === 'object' && pid !== null)) return;
        } else {
            pid = value;
        }
        if (pid) {
            if (typeof pid === 'string' && pid.startsWith('op:')) {
                opPatternIds.add(pid);
                return;
            }
            const numericId = typeof pid === 'number' ? pid : parseInt(pid);
            if (!isNaN(numericId) && isFinite(numericId)) {
                patternIds.add(numericId);
            }
        }
    };

    if (pbbData.patternSelections) {
        Object.values(pbbData.patternSelections).forEach(disciplineSelection => {
            if (!disciplineSelection) return;
            Object.values(disciplineSelection).forEach(entry => {
                if (isAssocKeyedEntry(entry)) {
                    // New shape: { AQHA: {...}, APHA: {...} }
                    Object.values(entry).forEach(addPatternIdFromValue);
                } else {
                    addPatternIdFromValue(entry);
                }
            });
        });
    }
    
    console.log('Collected pattern IDs:', Array.from(patternIds));
    
    // Fetch pattern images from database
    if (patternIds.size > 0) {
        try {
            // Fetch association_name for every selected pattern so the PDF can
            // label each class with its real breed (AQHA/APHA/...), instead of
            // defaulting to the discipline's first association.
            try {
                const { data: assocRows } = await supabase
                    .from('tbl_patterns')
                    .select('id, association_name')
                    .in('id', Array.from(patternIds));
                if (assocRows) {
                    assocRows.forEach(r => {
                        if (r?.id && r.association_name) {
                            patternAssociationMap.set(r.id, r.association_name);
                        }
                    });
                }
            } catch (e) {
                console.error('Error fetching pattern associations:', e);
            }

            // Fetch pattern maneuvers (step_no + instruction) for the language page.
            try {
                const { data: manRows } = await supabase
                    .from('tbl_maneuvers')
                    .select('pattern_id, step_no, instruction')
                    .in('pattern_id', Array.from(patternIds))
                    .order('step_no');
                if (manRows) {
                    manRows.forEach(r => {
                        if (!r?.pattern_id) return;
                        const arr = patternManeuversMap.get(r.pattern_id) || [];
                        arr.push({ step_no: r.step_no, instruction: r.instruction });
                        patternManeuversMap.set(r.pattern_id, arr);
                    });
                }
            } catch (e) {
                console.error('Error fetching pattern maneuvers:', e);
            }

            // First, try to fetch from tbl_pattern_media (priority)
            const { data: mediaData, error: mediaError } = await supabase
                .from('tbl_pattern_media')
                .select('pattern_id, image_url')
                .in('pattern_id', Array.from(patternIds));
            
            if (!mediaError && mediaData) {
                console.log(`Found ${mediaData.length} pattern media records`);
                // Fetch all pattern images in parallel for better performance
                const mediaFetches = mediaData
                    .filter(media => media.image_url && !patternImagesMap.has(media.pattern_id))
                    .map(async (media) => {
                        const base64 = await fetchImageAsBase64(media.image_url);
                        if (base64) {
                            patternImagesMap.set(media.pattern_id, base64);
                        }
                    });
                await Promise.all(mediaFetches);
            } else if (mediaError) {
                console.error('Error fetching pattern media:', mediaError);
            }
            
            // For patterns without media, try to fetch from tbl_patterns
            const patternsWithoutMedia = Array.from(patternIds).filter(id => !patternImagesMap.has(id));
            if (patternsWithoutMedia.length > 0) {
                const { data: patternsData, error: patternsError } = await supabase
                    .from('tbl_patterns')
                    .select('id, image_url, url')
                    .in('id', patternsWithoutMedia);
                
                if (!patternsError && patternsData) {
                    console.log(`Found ${patternsData.length} patterns without media, checking tbl_patterns`);
                    const fallbackFetches = patternsData
                        .filter(p => (p.image_url || p.url) && !patternImagesMap.has(p.id))
                        .map(async (pattern) => {
                            const imageUrl = pattern.image_url || pattern.url;
                            const base64 = await fetchImageAsBase64(imageUrl);
                            if (base64) {
                                patternImagesMap.set(pattern.id, base64);
                            }
                        });
                    await Promise.all(fallbackFetches);
                } else if (patternsError) {
                    console.error('Error fetching patterns:', patternsError);
                }
            }
            
        } catch (err) {
            console.error('Error fetching pattern images:', err);
        }
    } else {
        console.log('No pattern IDs found in patternSelections');
    }

    // Fetch OP/CAPO pattern images from the `patterns` table. Keyed in
    // patternImagesMap by the full "op:<uuid>" string so the render-side
    // lookup can match on the exact id used in patternSelections.
    if (opPatternIds.size > 0) {
        try {
            const rawUuids = Array.from(opPatternIds).map(id => id.slice(3));
            const { data: opRows } = await supabase
                .from('patterns')
                .select('id, preview_image_url')
                .in('id', rawUuids);

            await Promise.all((opRows || [])
                .filter(r => r.preview_image_url)
                .map(async (r) => {
                    const base64 = await fetchImageAsBase64(r.preview_image_url);
                    if (base64) patternImagesMap.set(`op:${r.id}`, base64);
                }));
        } catch (err) {
            console.error('Error fetching OP pattern images:', err);
        }
    }

    console.log(`Total pattern images loaded: ${patternImagesMap.size} out of ${patternIds.size + opPatternIds.size} requested`);

    // Fetch scoresheet images from tbl_scoresheet by pattern_id
    const scoresheetImagesMap = new Map(); // pattern_id -> base64
    // Breed-specific fallback: association_abbrev -> base64 (used when no pattern-linked scoresheet)
    const scoresheetByAssocMap = new Map();
    const includeScoresheet = pbbData.downloadIncludes?.scoresheet !== false; // default true
    const includePattern = pbbData.downloadIncludes?.pattern !== false; // default true

    if (includeScoresheet && patternIds.size > 0) {
        try {
            // Step 1: Fetch scoresheets linked to specific patterns
            const { data: scoresheetData, error: scoresheetError } = await supabase
                .from('tbl_scoresheet')
                .select('id, pattern_id, image_url, storage_path, association_abbrev, discipline')
                .in('pattern_id', Array.from(patternIds));

            if (!scoresheetError && scoresheetData) {
                console.log(`Found ${scoresheetData.length} scoresheet records`);
                const ssFetches = scoresheetData
                    .filter(ss => ss.image_url && !scoresheetImagesMap.has(ss.pattern_id))
                    .map(async (ss) => {
                        const base64 = await fetchImageAsBase64(ss.image_url);
                        if (base64) {
                            scoresheetImagesMap.set(ss.pattern_id, base64);
                        }
                    });
                await Promise.all(ssFetches);
            } else if (scoresheetError) {
                console.error('Error fetching scoresheets:', scoresheetError);
            }

            // Step 2: Fetch breed-specific fallback scoresheets by association + discipline
            // This ensures AQHA patterns get AQHA scoresheets, APHA gets APHA, etc.
            const disciplineNames = [...new Set((pbbData.disciplines || []).map(d => d.name).filter(Boolean))];
            const assocAbbrevs = [...new Set(
                (pbbData.disciplines || []).map(d => {
                    const assocId = d.association_id;
                    return assocId?.toUpperCase();
                }).filter(Boolean)
            )];

            if (disciplineNames.length > 0 && assocAbbrevs.length > 0) {
                try {
                    const { data: fallbackSheets } = await supabase
                        .from('tbl_scoresheet')
                        .select('id, image_url, storage_path, association_abbrev, discipline')
                        .in('association_abbrev', assocAbbrevs)
                        .in('discipline', disciplineNames)
                        .is('pattern_id', null);

                    if (fallbackSheets?.length > 0) {
                        const fallbackFetches = fallbackSheets
                            .filter(ss => ss.image_url)
                            .map(async (ss) => {
                                const key = `${ss.association_abbrev}-${ss.discipline}`;
                                if (!scoresheetByAssocMap.has(key)) {
                                    const base64 = await fetchImageAsBase64(ss.image_url);
                                    if (base64) {
                                        scoresheetByAssocMap.set(key, base64);
                                    }
                                }
                            });
                        await Promise.all(fallbackFetches);
                        console.log(`Loaded ${scoresheetByAssocMap.size} breed-specific fallback scoresheets`);
                    }
                } catch (e) {
                    console.error('Error fetching breed-specific fallback scoresheets:', e);
                }
            }
        } catch (err) {
            console.error('Error fetching scoresheet images:', err);
        }
    }
    console.log(`Total scoresheet images loaded: ${scoresheetImagesMap.size} (+ ${scoresheetByAssocMap.size} breed fallbacks)`);

    const sponsorLogosBase64 = [];
    if (pbbData.marketing?.sponsorLogos?.length > 0) {
        for(const logo of pbbData.marketing.sponsorLogos) {
            const base64 = await fetchImageAsBase64(logo.fileUrl);
            if (base64) {
                const compressed = await compressImage(base64, 200, 200, 0.8);
                sponsorLogosBase64.push(compressed || base64);
            }
        }
    }


    // Helper: render a single horizontal row of sponsor logos along the
    // bottom of the cover page, above the social-media icon strip. Keeps
    // each logo's aspect ratio and scales the row to fit the page width.
    // Band origin set by whichever cover layout runs; defaults keep a sensible
    // bottom-of-page band if the layout code didn't set them.
    let sponsorBandTop = pageHeight - margin - 200;
    let sponsorBandHeight = 200;

    const drawCoverSponsorRow = async () => {
        if (!sponsorLogosBase64 || sponsorLogosBase64.length === 0) return;

        const labelY = sponsorBandTop + 18;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(80, 80, 80);
        doc.text('SPONSORS', pageWidth / 2, labelY, { align: 'center' });

        const logosTop = labelY + 14;
        const logosBottom = sponsorBandTop + sponsorBandHeight - 10;
        const bandRowH = Math.max(60, logosBottom - logosTop);
        const bandRowW = pageWidth - margin * 2 - 40;

        const count = sponsorLogosBase64.length;
        const gap = 16;
        const cellW = Math.min(140, (bandRowW - gap * (count - 1)) / count);
        const totalW = cellW * count + gap * (count - 1);
        let x = (pageWidth - totalW) / 2;
        for (const logo of sponsorLogosBase64) {
            await addContainedImage(logo, x, logosTop, cellW, bandRowH);
            x += cellW + gap;
        }
    };

    // --- Cover Page ---
    if (skipCoverAndToc) {
        // Hub mode: no cover page, no TOC, no pattern list — jump straight to patterns
    } else if (selectedLayout === 'layout-b') {
        // LAYOUT B: Classic Design (Programmatic)
        
        // Background - Cream/Off-white
        doc.setFillColor(253, 250, 245); 
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        
        // Elegant Border
        doc.setDrawColor(60, 60, 60); // Dark Grey
        doc.setLineWidth(1);
        doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2), 'S');
        
        doc.setLineWidth(3);
        doc.rect(margin + 5, margin + 5, pageWidth - (margin * 2) - 10, pageHeight - (margin * 2) - 10, 'S');
        
        // --- Three equal horizontal bands: logo | title | sponsors ---
        const innerTop = margin + 20;
        const innerBottom = pageHeight - margin - 20;
        const bandH = (innerBottom - innerTop) / 3;
        const band1Top = innerTop;                 // Show logo
        const band2Top = innerTop + bandH;         // Title + meta
        const band3Top = innerTop + bandH * 2;     // Sponsors

        // BAND 1: Show Logo (centered in band)
        if (showLogoCoverBase64) {
            const logoBoxW = Math.min(pageWidth - margin * 2 - 40, 360);
            const logoBoxH = bandH - 30;
            await addContainedImage(
                showLogoCoverBase64,
                (pageWidth - logoBoxW) / 2,
                band1Top + 15,
                logoBoxW,
                logoBoxH
            );
        }

        // BAND 2: Title + Date + Venue + Associations (vertically centered)
        doc.setTextColor(0, 0, 0);
        const showTitle = (pbbData.showName || 'Pattern Book').toUpperCase();
        const titleFit = fitTextLines(showTitle, {
            maxWidth: pageWidth - 140,
            maxLines: 3,
            startSize: 44,
            minSize: 22,
            font: 'times',
            style: 'bold',
        });
        const associations = Array.isArray(pbbData.associations) ? pbbData.associations : [];
        const hasDates = pbbData.startDate && pbbData.endDate;
        const blockH =
            titleFit.lines.length * titleFit.size * 1.15 +
            24 + // decorative line gap
            (hasDates ? 28 : 0) +
            (pbbData.venueAddress ? 22 : 0) +
            (associations.length > 0 ? 24 : 0);
        let cursorY = band2Top + (bandH - blockH) / 2 + titleFit.size;

        doc.setFont('times', 'bold');
        doc.setFontSize(titleFit.size);
        doc.text(titleFit.lines, pageWidth / 2, cursorY, { align: 'center' });
        cursorY += (titleFit.lines.length - 1) * titleFit.size * 1.15 + 20;

        // Decorative line
        doc.setLineWidth(1);
        doc.line(pageWidth / 2 - 100, cursorY, pageWidth / 2 + 100, cursorY);
        cursorY += 24;

        doc.setFont('times', 'italic');
        doc.setFontSize(20);
        if (hasDates) {
            const dateText = `${format(parseLocalDate(pbbData.startDate), 'MMMM d')} – ${format(parseLocalDate(pbbData.endDate), 'd, yyyy')}`;
            doc.text(dateText, pageWidth / 2, cursorY, { align: 'center' });
            cursorY += 24;
        }

        if (pbbData.venueAddress) {
            doc.setFontSize(14);
            doc.setFont('times', 'normal');
            doc.text(pbbData.venueAddress, pageWidth / 2, cursorY, { align: 'center', maxWidth: pageWidth - 120 });
            cursorY += 22;
        }

        if (associations.length > 0) {
            doc.setFontSize(13);
            doc.setFont('times', 'bold');
            const assocText = associations.map(a => formatAssociationName(a.id)).join(' • ');
            doc.text(assocText, pageWidth / 2, cursorY, { align: 'center' });
        }

        // Expose band 3 origin to the sponsor helper via closure variable
        sponsorBandTop = band3Top;
        sponsorBandHeight = bandH;
        // Sponsor logos row at bottom of cover (Layout B)
        await drawCoverSponsorRow();
        // Social media icons
        drawSocialIcons(pageHeight - margin - 20);
    } else if (pbbData.coverPageOption !== 'none') {
        // Default Layout A Cover Page (existing logic)
        if (pbbData.coverPageOption === 'upload' && coverImageBase64) {
             await addImageToPage(coverImageBase64, 0, 0, pageWidth, pageHeight);
        } else {
            // White background
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
            
            // Decorative border (black for white background)
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(3);
            doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2), 'S');
            
            // Three equal bands (Layout A): logo | title | sponsors
            const innerTopA = margin + 20;
            const innerBottomA = pageHeight - margin - 20;
            const bandHA = (innerBottomA - innerTopA) / 3;
            const band1TopA = innerTopA;
            const band2TopA = innerTopA + bandHA;
            const band3TopA = innerTopA + bandHA * 2;

            if (showLogoCoverBase64) {
                const logoBoxWA = Math.min(pageWidth - margin * 2 - 40, 360);
                const logoBoxHA = bandHA - 30;
                await addContainedImage(
                    showLogoCoverBase64,
                    (pageWidth - logoBoxWA) / 2,
                    band1TopA + 15,
                    logoBoxWA,
                    logoBoxHA
                );
            }

            // BAND 2: Title + meta, vertically centered
            doc.setTextColor(0, 0, 0);
            const showTitle = (pbbData.showName || 'Pattern Book').toUpperCase();
            const titleFitA = fitTextLines(showTitle, {
                maxWidth: pageWidth - 100,
                maxLines: 3,
                startSize: 40,
                minSize: 20,
                font: 'helvetica',
                style: 'bold',
            });
            const associations = Array.isArray(pbbData.associations) ? pbbData.associations : [];
            const hasDatesA = pbbData.startDate && pbbData.endDate;
            const blockHA =
                titleFitA.lines.length * titleFitA.size * 1.15 +
                (associations.length > 0 ? 28 : 0) +
                (hasDatesA ? 22 : 0) +
                (pbbData.venueAddress ? 20 : 0);
            let cursorYA = band2TopA + (bandHA - blockHA) / 2 + titleFitA.size;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(titleFitA.size);
            doc.text(titleFitA.lines, pageWidth / 2, cursorYA, { align: 'center' });
            cursorYA += (titleFitA.lines.length - 1) * titleFitA.size * 1.15 + 28;

            if (associations.length > 0) {
                doc.setFontSize(16);
                doc.setFont('helvetica', 'normal');
                const assocText = associations.map(a => formatAssociationName(a.id)).join(' • ');
                doc.text(assocText, pageWidth / 2, cursorYA, { align: 'center', maxWidth: pageWidth - 100 });
                cursorYA += 22;
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'normal');
            if (hasDatesA) {
                const dateText = `${format(parseLocalDate(pbbData.startDate), 'MMMM d')} – ${format(parseLocalDate(pbbData.endDate), 'd, yyyy')}`;
                doc.text(dateText, pageWidth / 2, cursorYA, { align: 'center' });
                cursorYA += 20;
            }

            if (pbbData.venueAddress) {
                doc.setFontSize(12);
                doc.text(pbbData.venueAddress, pageWidth / 2, cursorYA, { align: 'center', maxWidth: pageWidth - 120 });
            }

            sponsorBandTop = band3TopA;
            sponsorBandHeight = bandHA;

            // Sponsor logos row at bottom of cover (Layout A)
            await drawCoverSponsorRow();

            // Social media icons
            drawSocialIcons(pageHeight - margin - 20);
        }
    }


    // --- Table of Contents ---
    if (!skipCoverAndToc) {
    addNewPage();
    // Header is added in the finalize step to include Show Name.

    // --- Pattern List (Layout B Only) ---
    if (false && selectedLayout === 'layout-b') {
        addNewPage();
        
        // Header
        doc.setFont('times', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(100, 100, 100);
        doc.text('(Patterns located in the Rule Book)', pageWidth / 2, margin + 20, { align: 'center' });
        
        yPos = margin + 50;
        
        for (const [discIndex, discipline] of (pbbData.disciplines || []).entries()) {
            if (!isPatternDiscipline(discipline)) continue;
            // Check if discipline has any valid groups
            const hasValidGroups = (discipline.patternGroups || []).some(g => g.divisions && g.divisions.length > 0);
            if (!hasValidGroups) continue;

            if (yPos > pageHeight - margin - 50) {
                addNewPage();
                yPos = margin + 30;
            }
            
            // Discipline Header
            doc.setFont('times', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.text(discipline.name, margin, yPos);
            yPos += 15;
            
            // Column Headers
            doc.setFontSize(10);
            doc.text('Class', margin, yPos);
            doc.text('Pattern #', pageWidth - margin, yPos, { align: 'right' });
            
            // Line under headers
            doc.setLineWidth(1);
            doc.line(margin, yPos + 5, pageWidth - margin, yPos + 5);
            yPos += 20;
            
            // List Classes
            doc.setFont('times', 'normal');
            doc.setFontSize(10);
            
            for (const [groupIndex, group] of (discipline.patternGroups || []).entries()) {
                if (!group.divisions || group.divisions.length === 0) continue;

                if (yPos > pageHeight - margin) {
                    addNewPage();
                    yPos = margin + 30;
                }
                
                const divisions = group.divisions?.map(d => formatDivisionWithGo(d)).join(', ');
                // Extract pattern selection - try ID-based keys first, then fallback to index-based
                const disciplineId = discipline.id;
                const groupId = group.id;
                let patternSelection = null;
                if (disciplineId && groupId) {
                    patternSelection = pbbData.patternSelections?.[disciplineId]?.[groupId];
                }
                if (!patternSelection) {
                    patternSelection = pbbData.patternSelections?.[discIndex]?.[groupIndex];
                }
                // Single-group fallback: use first available selection for the discipline
                if (!patternSelection && discipline.patternGroups?.length === 1 && disciplineId) {
                    const discSels = pbbData.patternSelections?.[disciplineId];
                    if (discSels) { const fk = Object.keys(discSels)[0]; if (fk) patternSelection = discSels[fk]; }
                }
                const patternDisplay = getPatternDisplayName(patternSelection) || 'TBD';
                
                // Class Name
                doc.text(divisions, margin, yPos);
                
                // Pattern #
                doc.text(patternDisplay, pageWidth - margin, yPos, { align: 'right' });
                
                // Dotted Leader
                const nameWidth = doc.getTextWidth(divisions);
                const numWidth = doc.getTextWidth(patternDisplay);
                const leaderStart = margin + nameWidth + 5;
                const leaderEnd = pageWidth - margin - numWidth - 5;
                
                if (leaderEnd > leaderStart) {
                    let currentX = leaderStart;
                    while (currentX < leaderEnd) {
                        doc.text('.', currentX, yPos);
                        currentX += 3;
                    }
                }
                
                yPos += 15;
            }
            yPos += 20; // Space between disciplines
        }
    }
    } // end if (!skipCoverAndToc)

    // A class that has a Go 1 / Go 2 version can leave a stale "plain" copy of
    // itself behind in a group — e.g. it was already grouped before Go 2 was
    // added, so the group still holds the original "Amateur" alongside the new
    // "Amateur (Go 1)". That shows up as a duplicate in the same class row.
    // Collect every baseId that has a Go version anywhere in the book, so the
    // plain leftover copy can be dropped (the Go versions are the real entries).
    const goBaseIds = new Set();
    (pbbData.disciplines || []).forEach(disc => {
        (disc.patternGroups || []).forEach(g => {
            (g.divisions || []).forEach(d => {
                if (d && (d.goNumber === 1 || d.goNumber === 2)) {
                    goBaseIds.add(d.baseId || d.id);
                }
            });
        });
    });
    const dropStaleBaseDivisions = (divisions) => {
        if (!Array.isArray(divisions) || goBaseIds.size === 0) return divisions;
        return divisions.filter(d => {
            // Always keep the Go 1 / Go 2 entries.
            if (d && (d.goNumber === 1 || d.goNumber === 2)) return true;
            // Drop a plain copy only when a Go version of the same class exists.
            return !goBaseIds.has(d && (d.baseId || d.id));
        });
    };

    // --- Pattern Pages ---
    let sequentialClassNumber = 10000;
    for (const [discIndex, discipline] of (pbbData.disciplines || []).entries()) {
        if (!isPatternDiscipline(discipline)) continue;
        for (const [groupIndex, group] of (discipline.patternGroups || []).entries()) {
            // Strip any stale plain copy of a class that now has Go 1 / Go 2,
            // before anything (page count, TOC, headers) reads the divisions.
            if (group.divisions) group.divisions = dropStaleBaseDivisions(group.divisions);
            // Skip empty groups (no divisions assigned) — prevents phantom pages in downloads
            const hasDivisions = group.divisions && group.divisions.length > 0;
            if (!hasDivisions && !skipCoverAndToc) continue;
            // Even in hub mode, skip if no pattern is selected for this group
            if (!hasDivisions) {
                const disciplineId = discipline.id;
                const groupId = group.id;
                const sel = pbbData.patternSelections?.[disciplineId]?.[groupId] || pbbData.patternSelections?.[discIndex]?.[groupIndex];
                if (!sel) continue;
            }

            // Extract pattern ID - try ID-based keys first, then fallback to index-based.
            // patternSelections may store a per-group entry in the association-keyed
            // shape { AQHA: {...}, APHA: {...} } — use getPatternSelectionForAssoc so
            // we read the pattern that was selected for THIS discipline's association
            // rather than whichever association happens to come first in the map
            // (that's why a user who picked Pattern 2 for AQHA was seeing Pattern 4
            // — APHA's selection — in the exported PDF).
            const disciplineId = discipline.id;
            const groupId = group.id;
            const disciplineAssocAbbrev = discipline.association_id
                ? String(discipline.association_id).toUpperCase()
                : null;

            let patternSelection = null;
            let patternId = null;

            const resolveSelection = (rawGroupEntry) => {
                if (rawGroupEntry == null) return null;
                if (isAssocKeyedEntry(rawGroupEntry)) {
                    // Prefer this discipline's association; fall back to any entry
                    // so single-association selections still render.
                    if (disciplineAssocAbbrev && rawGroupEntry[disciplineAssocAbbrev] != null) {
                        return rawGroupEntry[disciplineAssocAbbrev];
                    }
                    const keys = Object.keys(rawGroupEntry);
                    return keys.length > 0 ? rawGroupEntry[keys[0]] : null;
                }
                // Legacy scalar/object shape — applies to any association.
                return rawGroupEntry;
            };

            // Try ID-based keys first (preferred)
            if (disciplineId && groupId) {
                patternSelection = resolveSelection(pbbData.patternSelections?.[disciplineId]?.[groupId]);
            }

            // Fallback to index-based keys (legacy)
            if (!patternSelection) {
                patternSelection = resolveSelection(pbbData.patternSelections?.[discIndex]?.[groupIndex]);
            }

            // Single-group fallback: use first available selection for the discipline
            if (!patternSelection && discipline.patternGroups?.length === 1 && disciplineId) {
                const discSels = pbbData.patternSelections?.[disciplineId];
                if (discSels) {
                    const fk = Object.keys(discSels)[0];
                    if (fk) patternSelection = resolveSelection(discSels[fk]);
                }
            }
            
            // Check for special selection types (judge-assigned, custom-request)
            // Note: the "judgeAssigned" type in Step 6 assigns a judge name to
            // the class but should NOT hide an already-selected pattern. The
            // placeholder "Pattern to be selected by Judge" page should only
            // render when no real patternId has been picked.
            const rawJudgeAssigned = patternSelection?.type === 'judgeAssigned';
            const isCustomRequest = patternSelection?.type === 'customRequest';

            if (patternSelection && !isCustomRequest) {
                // Always try to pull a patternId from the selection — even when
                // type === 'judgeAssigned' — so a pattern assigned alongside a
                // judge is still rendered.
                if (typeof patternSelection === 'object' && patternSelection !== null) {
                    patternId = patternSelection.patternId || patternSelection.id;
                    if (!patternId || (typeof patternId === 'object' && patternId !== null)) {
                        patternId = null;
                    }
                } else {
                    patternId = patternSelection;
                }
            }
            // Only treat the class as judge-assigned (placeholder page) when the
            // judge has NOT yet responded — i.e. no real pattern picked AND no
            // file uploaded. Once they pick/upload, render the actual pattern.
            const hasUploadedFile = !!patternSelection?.uploadedFileUrl;
            const isJudgeAssigned = rawJudgeAssigned && !patternId && !hasUploadedFile;
            const hasNoPattern = !patternId && !isJudgeAssigned && !isCustomRequest && !hasUploadedFile;
            console.log(`Extracted patternId for discipline ${disciplineId || discIndex}, group ${groupId || groupIndex}:`, patternSelection, '->', patternId);
            
            // Get competition date - first try divisionDates from divisions in the group, then groupDueDates, then startDate
            let competitionDate = pbbData.startDate;
            
            // Resolve a single grouped division's competition date in a
            // two-go-aware way. For a two-go class the grouped division id is
            // `${baseId}-go1` / `${baseId}-go2`, which is NOT a key in
            // divisionDates (that map is keyed by base id and only holds the Go 1
            // date). So pull the correct Go 1 / Go 2 date from divisionGos[baseId]
            // using the division's goNumber, and fall back to divisionDates for
            // single-go or legacy (string) divisions.
            const resolveDivisionDate = (div) => {
                const divId = div?.id || div;
                const baseId = div?.baseId || divId;
                const goInfo = discipline.divisionGos?.[baseId];
                if (goInfo) {
                    if (div?.goNumber === 2) return goInfo.go2Date || null;
                    if (div?.goNumber === 1) return goInfo.go1Date || null;
                    return goInfo.go1Date || discipline.divisionDates?.[divId] || null;
                }
                return discipline.divisionDates?.[divId] || null;
            };

            // Try to get date from divisions (set in Step 3, tab 2)
            if (group.divisions && group.divisions.length > 0) {
                // Get the first division's date, or find a common date if all divisions have the same date
                const divisionDates = group.divisions
                    .map(resolveDivisionDate)
                    .filter(Boolean);

                if (divisionDates.length > 0) {
                    // Use the first division's date (or could use most common date)
                    competitionDate = divisionDates[0];
                }
            }
            
            // Fallback to groupDueDates if no divisionDates found
            if (!competitionDate || competitionDate === pbbData.startDate) {
                competitionDate = pbbData.groupDueDates?.[discIndex]?.[groupIndex] || pbbData.startDate;
            }

            // A single class/group can contain divisions that run on different
            // days (e.g. Open Junior on Fri, Youth on Sat). Collect every
            // DISTINCT division date so the By-Date TOC can list the class under
            // EACH day instead of only the first division's date — otherwise the
            // later days look empty even though classes are scheduled then.
            // Falls back to the resolved competitionDate when no division-level
            // dates exist.
            let groupDates = [];
            if (group.divisions && group.divisions.length > 0) {
                const seenDates = new Set();
                group.divisions.forEach(div => {
                    const d = resolveDivisionDate(div);
                    if (d && !seenDates.has(d)) { seenDates.add(d); groupDates.push(d); }
                });
            }
            if (groupDates.length === 0 && competitionDate) {
                groupDates = [competitionDate];
            }

            // Resolve association per-class: prefer the association of the
            // actually-selected pattern (so AQHA/APHA/NSBA are labeled correctly
            // even when a single discipline has classes from multiple breeds).
            const numericPidForAssoc = patternId ? (typeof patternId === 'number' ? patternId : parseInt(patternId)) : null;
            const patternAssocName = numericPidForAssoc && !isNaN(numericPidForAssoc)
                ? patternAssociationMap.get(numericPidForAssoc)
                : null;
            const selectionFilterAssoc = (patternSelection && typeof patternSelection === 'object')
                ? patternSelection.filterAssociation
                : null;
            const fallbackAssocId = discipline.association_id || Object.keys(pbbData.associations || {})[0];
            let assocName;
            if (patternAssocName) {
                // Use the raw association name from tbl_patterns (e.g. "APHA")
                assocName = patternAssocName.split(/[\s-]+/)[0].trim() || patternAssocName;
            } else if (selectionFilterAssoc && selectionFilterAssoc !== 'all') {
                assocName = selectionFilterAssoc;
            } else {
                assocName = formatAssociationName(fallbackAssocId);
            }
            
            if (includePattern) {
                addNewPage();

                // Add to TOC with sequential numbering
                sequentialClassNumber++;
                const tocLabel = group.customLabel ? ` (${group.customLabel})` : '';
                // Show the Go label once per class (e.g. "… — Go 1") for two-go
                // classes, instead of "(Go 1)" on every division.
                const { text: divisionsText, goSuffix } = formatGroupDivisions(group, '/');
                const className = `${discipline.name}${tocLabel} - ${divisionsText}${goSuffix}`;
                // classDetail = the part shown under a discipline heading in the
                // By-Discipline TOC (no leading discipline name, to avoid repeating it).
                const classDetail = `${group.customLabel ? group.customLabel + ' - ' : ''}${divisionsText}${goSuffix}` || className;
                toc.push({
                    title: className,
                    discipline: discipline.name,
                    classDetail,
                    page: doc.internal.getNumberOfPages() - 1,
                    date: competitionDate,
                    dates: groupDates,
                    classNumber: showClassNumbers ? sequentialClassNumber.toString() : ''
                });

                // yPos is set by addNewPage() to margin + 30 (below page header).
                // Do NOT reset it back to margin — that would overlap the header.
            }

            // Render pattern page based on selected layout
            if (selectedLayout === 'layout-a') {
            if (includePattern) {

            // --- Pattern page header ---
            // Same visual language as individual download:
            //   Association (bold) + date right-aligned
            //   Discipline + divisions
            //   Pattern image fills remaining space (biggest element)
            // The page header already shows the show name, so we skip it here.

            const dateStr = competitionDate ? format(parseLocalDate(competitionDate), 'MM-dd-yyyy') : '';

            if (skipCoverAndToc) {
                // Hub mode: compact single-line header
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                const headerLine = `${assocName.toUpperCase()}  •  ${discipline.name.toUpperCase()}  •  ${dateStr}`;
                doc.text(headerLine, margin, yPos, { maxWidth: pageWidth - margin * 2 });
                yPos += 18;
            } else {
            // Line 1: Association (bold) + date (right-aligned)
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text(assocName.toUpperCase(), margin, yPos);
            if (dateStr) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                doc.text(dateStr, pageWidth - margin, yPos, { align: 'right' });
                doc.setTextColor(0, 0, 0);
            }
            yPos += 15;

            // Line 2: Discipline name
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            const disciplineText = discipline.name.toUpperCase();
            const disciplineMaxWidth = pageWidth - margin * 2;
            const disciplineLines = doc.splitTextToSize(disciplineText, disciplineMaxWidth);
            doc.text(disciplineLines, margin, yPos);
            yPos += (disciplineLines.length * 13) + 2;

            // Custom label (e.g., "Monday Practice")
            const customLabel = group.customLabel;
            if (customLabel) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(80, 80, 80);
                doc.text(customLabel, margin, yPos);
                doc.setTextColor(0, 0, 0);
                yPos += 11;
            }

            // Line 3: Division names (compact)
            const divisions = group.divisions?.map(d => formatDivisionWithGo(d)).join(' / ') || '';
            if (divisions) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                const maxWidth = pageWidth - margin * 2;
                const divisionLines = doc.splitTextToSize(divisions, maxWidth);
                const linesToDisplay = divisionLines.slice(0, 2);
                doc.text(linesToDisplay, margin, yPos);
                yPos += (linesToDisplay.length * 11) + 4;
            } else {
                yPos += 4;
            }

            } // end full header (non-hub)
            
            // Render placeholder or real pattern image
            if (isJudgeAssigned) {
                // Judge-assigned placeholder
                const placeholderY = yPos + 150;
                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(150, 150, 150);
                doc.text(`Pattern to be selected by Judge: ${patternSelection?.judgeName || 'TBD'}`, pageWidth / 2, placeholderY, { align: 'center', maxWidth: pageWidth - margin * 2 });
                yPos = placeholderY + 40;
            } else if (isCustomRequest || hasUploadedFile) {
                // Custom pattern OR judge-uploaded pattern: show uploaded image if available, otherwise placeholder
                if (patternSelection?.uploadedFileUrl && patternSelection.uploadedFileType?.startsWith('image/')) {
                    try {
                        const uploadedBase64 = await fetchImageAsBase64(patternSelection.uploadedFileUrl);
                        if (uploadedBase64) {
                            const imgProps = doc.getImageProperties(uploadedBase64);
                            const aspect = imgProps.height / imgProps.width;
                            const availH = pageHeight - yPos - 44;
                            const imgW = pageWidth - PATTERN_IMAGE_MARGIN * 2;
                            let finalW = imgW;
                            let finalH = imgW * aspect;
                            if (finalH > availH) { finalH = availH; finalW = finalH / aspect; }
                            const xOff = (pageWidth - finalW) / 2;
                            await addImageToPage(uploadedBase64, xOff, yPos, finalW, finalH);
                            yPos += finalH + 6;
                        } else {
                            throw new Error('fetch failed');
                        }
                    } catch (_e) {
                        const placeholderY = yPos + 150;
                        doc.setFontSize(20);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(150, 150, 150);
                        doc.text('Custom Pattern \u2014 Uploaded (PDF)', pageWidth / 2, placeholderY, { align: 'center', maxWidth: pageWidth - margin * 2 });
                        yPos = placeholderY + 40;
                    }
                } else if (patternSelection?.uploadedFileUrl) {
                    const boxTop = yPos;
                    const boxMaxH = pageHeight - yPos - 44;
                    // Uploaded PDF: record the placeholder page + content box so the
                    // actual pattern PDF is embedded here after generation (see
                    // overlayCustomPatternPdfs). Fill from header (yPos) to footer
                    // reserve (44pt), matching the image-upload sizing above.
                    customPdfOverlays.push({
                        pageIndex: doc.internal.getNumberOfPages(),
                        url: patternSelection.uploadedFileUrl,
                        x: PATTERN_IMAGE_MARGIN,
                        top: boxTop,
                        maxW: pageWidth - PATTERN_IMAGE_MARGIN * 2,
                        maxH: boxMaxH,
                    });
                    yPos = boxTop + boxMaxH;
                } else {
                    const placeholderY = yPos + 150;
                    doc.setFontSize(20);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(150, 150, 150);
                    doc.text('Custom Pattern \u2014 Awaiting Upload', pageWidth / 2, placeholderY, { align: 'center', maxWidth: pageWidth - margin * 2 });
                    yPos = placeholderY + 40;
                }
                doc.setTextColor(0, 0, 0);

                // Add generic scoresheet page (no maneuvers) — only if scoresheets are included
                if (includeScoresheet) {
                    addNewPage();
                    const resolvedJudgeCustomA = skipCoverAndToc ? resolveJudgeName(discipline, group, discIndex, groupIndex) : '';
                    const dateStr = competitionDate ? format(parseLocalDate(competitionDate), 'MM-dd-yyyy') : '';
                    drawGenericScoreSheetPage(doc, {
                        association: assocName,
                        showName: pbbData.showName || '',
                        discipline: discipline.name || '',
                        division: group.divisions?.map(d => formatDivisionWithGo(d)).join(' / ') || '',
                        date: dateStr,
                        judge: resolvedJudgeCustomA,
                    });
                }
            } else if (hasNoPattern) {
                // No pattern assigned placeholder
                const placeholderY = yPos + 150;
                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(150, 150, 150);
                doc.text('Pattern Coming Soon', pageWidth / 2, placeholderY, { align: 'center', maxWidth: pageWidth - margin * 2 });
                yPos = placeholderY + 40;
            } else {
            // Add real pattern image - centered and large. Support both legacy
            // numeric ids (tbl_patterns) and OP/CAPO string ids ("op:<uuid>").
            const isOpId = typeof patternId === 'string' && patternId.startsWith('op:');
            const numericPatternId = !isOpId && patternId
                ? (typeof patternId === 'number' ? patternId : parseInt(patternId))
                : null;
            const lookupKey = isOpId
                ? patternId
                : (numericPatternId && !isNaN(numericPatternId) ? numericPatternId : null);
            const patternImageBase64 = lookupKey !== null && patternImagesMap.has(lookupKey)
                ? patternImagesMap.get(lookupKey)
                : null;

            // Pre-compute maneuvers height so the pattern image shrinks to leave
            // room for the "Pattern Language" block on the same page. OP patterns
            // don't have tbl_maneuvers rows, so this is null for them.
            const maneuversForA = (numericPatternId && patternManeuversMap.has(numericPatternId))
                ? patternManeuversMap.get(numericPatternId)
                : null;
            const maneuversHeightA = estimateManeuversHeight(maneuversForA, 'helvetica');

            if (patternImageBase64) {
                try {
                    // Always crop to remove baked-in header/legend/side-text so
                    // the rendered diagram can scale up to fill the page.
                    const imageBase64 = await cropPatternImage(patternImageBase64);
                    const imgProps = doc.getImageProperties(imageBase64);
                    const aspect = imgProps.height / imgProps.width;
                    // Reserve space for footer + branding + maneuvers block
                    const bottomReserve = 30 + maneuversHeightA;
                    const availableHeight = pageHeight - yPos - bottomReserve;
                    const imgWidth = pageWidth - PATTERN_IMAGE_MARGIN * 2;
                    const imgHeight = imgWidth * aspect;

                    let finalWidth = imgWidth;
                    let finalHeight = imgHeight;

                    // Scale down if image exceeds available height
                    if (finalHeight > availableHeight) {
                        finalHeight = availableHeight;
                        finalWidth = finalHeight / aspect;
                    }

                    // Center image horizontally
                    const xOffset = (pageWidth - finalWidth) / 2;

                    await addImageToPage(imageBase64, xOffset, yPos, finalWidth, finalHeight);
                    yPos += finalHeight + 6;
                } catch (e) {
                    console.error('Failed to add pattern image:', e);
                    const placeholderY = yPos + 150;
                    doc.setFontSize(20);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(150, 150, 150);
                    doc.text('Pattern Coming Soon', pageWidth / 2, placeholderY, { align: 'center', maxWidth: pageWidth - margin * 2 });
                    yPos = placeholderY + 40;
                }
            } else {
                // No image found for this pattern
                const placeholderY = yPos + 150;
                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(150, 150, 150);
                doc.text('Pattern Coming Soon', pageWidth / 2, placeholderY, { align: 'center', maxWidth: pageWidth - margin * 2 });
                yPos = placeholderY + 40;
            }

            // Render "Pattern Language" inline on the SAME page as the image.
            if (maneuversForA) {
                renderPatternLanguageInline(maneuversForA, {
                    discipline: discipline.name,
                    patternNumber: extractPatternNumber(patternSelection?.patternName),
                }, 'helvetica');
            }

            } // end else (real pattern)
            } // end if (includePattern) for layout-a

            // Add scoresheet page after pattern (layout-a) if scoresheet inclusion is enabled
            if (includeScoresheet && !isCustomRequest) {
                const numericPidForSs = patternId ? (typeof patternId === 'number' ? patternId : parseInt(patternId)) : null;
                // Try pattern-linked scoresheet first, then breed-specific fallback by association + discipline
                let ssBase64 = numericPidForSs && !isNaN(numericPidForSs) && scoresheetImagesMap.has(numericPidForSs)
                    ? scoresheetImagesMap.get(numericPidForSs) : null;
                if (!ssBase64) {
                    // Breed-specific fallback: match by association abbreviation + discipline name
                    const breedKey = `${assocName}-${discipline.name}`;
                    ssBase64 = scoresheetByAssocMap.get(breedKey) || null;
                }
                // In full-book mode, omit judge name from scoresheet header
                const resolvedJudgeSsA = skipCoverAndToc ? resolveJudgeName(discipline, group, discIndex, groupIndex) : '';
                const divisionLabelA = group.divisions?.map(d => formatDivisionWithGo(d)).join(' / ') || '';
                const ssDateStrA = competitionDate ? format(parseLocalDate(competitionDate), 'MM-dd-yyyy') : '';
                if (ssBase64) {
                    addNewPage();
                    pagesWithOwnHeader.add(doc.internal.getNumberOfPages());
                    const ssMargin = SCORESHEET_LAYOUT.margin;
                    const topReserve = 40;
                    try {
                        const ssProps = doc.getImageProperties(ssBase64);
                        const ssAspect = ssProps.height / ssProps.width;
                        const ssAvailH = pageHeight - ssMargin - topReserve;
                        const ssImgW = pageWidth - ssMargin * 2;
                        let ssFinalW = ssImgW;
                        let ssFinalH = ssImgW * ssAspect;
                        if (ssFinalH > ssAvailH) { ssFinalH = ssAvailH; ssFinalW = ssFinalH / ssAspect; }
                        const ssXOff = (pageWidth - ssFinalW) / 2;
                        const ssYOff = topReserve + 4;
                        drawScoreSheetHeader({
                            judgeName: resolvedJudgeSsA,
                            disciplineName: discipline.name,
                            division: divisionLabelA,
                            assocName,
                            dateStr: ssDateStrA,
                        });
                        await addImageToPage(ssBase64, ssXOff, ssYOff, ssFinalW, ssFinalH);
                        // (label overlay is applied via canvas in the download path)
                    } catch (ssErr) {
                        console.error('Failed to add scoresheet image:', ssErr);
                    }
                } else if (!hasNoPattern) {
                    addNewPage();
                    pagesWithOwnHeader.add(doc.internal.getNumberOfPages());
                    drawGenericScoreSheetPage(doc, {
                        association: assocName,
                        showName: pbbData.showName || '',
                        discipline: discipline.name || '',
                        division: divisionLabelA,
                        date: ssDateStrA,
                        judge: resolvedJudgeSsA,
                    });
                }
            }

            } else if (selectedLayout === 'layout-b') {
                if (includePattern) {

                // --- Pattern page header (Layout B) ---
                // Same visual language as Layout A but with serif fonts

                const dateStrB = competitionDate ? format(parseLocalDate(competitionDate), 'MM-dd-yyyy') : '';

                if (skipCoverAndToc) {
                    // Hub mode: compact single-line header
                    doc.setTextColor(0, 0, 0);
                    doc.setFont('times', 'bold');
                    doc.setFontSize(10);
                    const headerLine = `${assocName.toUpperCase()}  •  ${discipline.name.toUpperCase()}  •  ${dateStrB}`;
                    doc.text(headerLine, margin, yPos, { maxWidth: pageWidth - margin * 2 });
                    yPos += 18;
                } else {
                // Line 1: Association (bold) + date (right-aligned)
                doc.setTextColor(0, 0, 0);
                doc.setFont('times', 'bold');
                doc.setFontSize(11);
                doc.text(assocName.toUpperCase(), margin, yPos);
                if (dateStrB) {
                    doc.setFont('times', 'normal');
                    doc.setFontSize(9);
                    doc.setTextColor(100, 100, 100);
                    doc.text(dateStrB, pageWidth - margin, yPos, { align: 'right' });
                    doc.setTextColor(0, 0, 0);
                }
                yPos += 15;

                // Line 2: Discipline name
                doc.setFontSize(10);
                doc.setFont('times', 'bold');
                const disciplineTextB = discipline.name.toUpperCase();
                const disciplineMaxWidthB = pageWidth - margin * 2;
                const disciplineLinesB = doc.splitTextToSize(disciplineTextB, disciplineMaxWidthB);
                doc.text(disciplineLinesB, margin, yPos);
                yPos += (disciplineLinesB.length * 13) + 2;

                // Custom label
                const customLabelB = group.customLabel;
                if (customLabelB) {
                    doc.setFontSize(9);
                    doc.setFont('times', 'italic');
                    doc.setTextColor(80, 80, 80);
                    doc.text(customLabelB, margin, yPos);
                    doc.setTextColor(0, 0, 0);
                    yPos += 11;
                }

                // Line 3: Division names (compact)
                const divisionsB = group.divisions?.map(d => formatDivisionWithGo(d)).join(' / ') || '';
                if (divisionsB) {
                    doc.setFontSize(9);
                    doc.setFont('times', 'normal');
                    const maxWidthB = pageWidth - margin * 2;
                    const divisionLinesB = doc.splitTextToSize(divisionsB, maxWidthB);
                    const linesToDisplayB = divisionLinesB.slice(0, 2);
                    doc.text(linesToDisplayB, margin, yPos);
                    yPos += (linesToDisplayB.length * 11) + 4;
                } else {
                    yPos += 4;
                }

                } // end full header (non-hub)
                
                // Render placeholder or real pattern image (Layout B)
                if (isJudgeAssigned) {
                    const placeholderY = yPos + 150;
                    doc.setFontSize(20);
                    doc.setFont('times', 'bold');
                    doc.setTextColor(150, 150, 150);
                    doc.text(`Pattern to be selected by Judge: ${patternSelection?.judgeName || 'TBD'}`, pageWidth / 2, placeholderY, { align: 'center', maxWidth: pageWidth - margin * 2 });
                    yPos = placeholderY + 40;
                } else if (isCustomRequest || hasUploadedFile) {
                    // Custom pattern OR judge-uploaded pattern: show uploaded image if available, otherwise placeholder
                    if (patternSelection?.uploadedFileUrl && patternSelection.uploadedFileType?.startsWith('image/')) {
                        try {
                            const uploadedBase64 = await fetchImageAsBase64(patternSelection.uploadedFileUrl);
                            if (uploadedBase64) {
                                const imgProps = doc.getImageProperties(uploadedBase64);
                                const aspect = imgProps.height / imgProps.width;
                                const availH = pageHeight - yPos - 44;
                                const imgW = pageWidth - PATTERN_IMAGE_MARGIN * 2;
                                let finalW = imgW;
                                let finalH = imgW * aspect;
                                if (finalH > availH) { finalH = availH; finalW = finalH / aspect; }
                                const xOff = (pageWidth - finalW) / 2;
                                await addImageToPage(uploadedBase64, xOff, yPos, finalW, finalH);
                                yPos += finalH + 6;
                            } else {
                                throw new Error('fetch failed');
                            }
                        } catch (_e) {
                            const placeholderY = yPos + 150;
                            doc.setFontSize(20);
                            doc.setFont('times', 'bold');
                            doc.setTextColor(150, 150, 150);
                            doc.text('Custom Pattern \u2014 Uploaded (PDF)', pageWidth / 2, placeholderY, { align: 'center', maxWidth: pageWidth - margin * 2 });
                            yPos = placeholderY + 40;
                        }
                    } else if (patternSelection?.uploadedFileUrl) {
                        // Uploaded PDF: record placeholder page + box for pdf-lib
                        // embedding after generation (see overlayCustomPatternPdfs).
                        const boxTop = yPos;
                        const boxMaxH = pageHeight - yPos - 44;
                        customPdfOverlays.push({
                            pageIndex: doc.internal.getNumberOfPages(),
                            url: patternSelection.uploadedFileUrl,
                            x: PATTERN_IMAGE_MARGIN,
                            top: boxTop,
                            maxW: pageWidth - PATTERN_IMAGE_MARGIN * 2,
                            maxH: boxMaxH,
                        });
                        yPos = boxTop + boxMaxH;
                    } else {
                        const placeholderY = yPos + 150;
                        doc.setFontSize(20);
                        doc.setFont('times', 'bold');
                        doc.setTextColor(150, 150, 150);
                        doc.text('Custom Pattern \u2014 Awaiting Upload', pageWidth / 2, placeholderY, { align: 'center', maxWidth: pageWidth - margin * 2 });
                        yPos = placeholderY + 40;
                    }
                    doc.setTextColor(0, 0, 0);

                    // Add generic scoresheet page (no maneuvers) — only if scoresheets are included
                    if (includeScoresheet) {
                        addNewPage();
                        const resolvedJudgeCustomB = skipCoverAndToc ? resolveJudgeName(discipline, group, discIndex, groupIndex) : '';
                        const dateStrB = competitionDate ? format(parseLocalDate(competitionDate), 'MM-dd-yyyy') : '';
                        drawGenericScoreSheetPage(doc, {
                            association: assocName,
                            showName: pbbData.showName || '',
                            discipline: discipline.name || '',
                            division: group.divisions?.map(d => formatDivisionWithGo(d)).join(' / ') || '',
                            date: dateStrB,
                            judge: resolvedJudgeCustomB,
                        });
                    }
                } else if (hasNoPattern) {
                    const placeholderY = yPos + 150;
                    doc.setFontSize(20);
                    doc.setFont('times', 'bold');
                    doc.setTextColor(150, 150, 150);
                    doc.text('Pattern Coming Soon', pageWidth / 2, placeholderY, { align: 'center', maxWidth: pageWidth - margin * 2 });
                    yPos = placeholderY + 40;
                } else {
                // Add real pattern image - centered and large. Support both legacy
                // numeric ids (tbl_patterns) and OP/CAPO string ids ("op:<uuid>").
                const isOpIdB = typeof patternId === 'string' && patternId.startsWith('op:');
                const numericPatternId = !isOpIdB && patternId
                    ? (typeof patternId === 'number' ? patternId : parseInt(patternId))
                    : null;
                const lookupKeyB = isOpIdB
                    ? patternId
                    : (numericPatternId && !isNaN(numericPatternId) ? numericPatternId : null);
                const patternImageBase64 = lookupKeyB !== null && patternImagesMap.has(lookupKeyB)
                    ? patternImagesMap.get(lookupKeyB)
                    : null;

                // Pre-compute maneuvers height so the pattern image shrinks to leave
                // room for the "Pattern Language" block on the same page. OP patterns
                // don't have tbl_maneuvers rows, so this is null for them.
                const maneuversForB = (numericPatternId && patternManeuversMap.has(numericPatternId))
                    ? patternManeuversMap.get(numericPatternId)
                    : null;
                const maneuversHeightB = estimateManeuversHeight(maneuversForB, 'times');

                if (patternImageBase64) {
                    try {
                        // Always crop to remove baked-in header/legend/side-text so
                        // the rendered diagram can scale up to fill the page.
                        const imageBase64 = await cropPatternImage(patternImageBase64);
                        const imgProps = doc.getImageProperties(imageBase64);
                        const aspect = imgProps.height / imgProps.width;
                        // Reserve space for footer + branding + maneuvers block
                        const bottomReserveB = 30 + maneuversHeightB;
                        const availableHeight = pageHeight - yPos - bottomReserveB;
                        const imgWidth = pageWidth - PATTERN_IMAGE_MARGIN * 2;
                        const imgHeight = imgWidth * aspect;

                        let finalWidth = imgWidth;
                        let finalHeight = imgHeight;

                        if (finalHeight > availableHeight) {
                            finalHeight = availableHeight;
                            finalWidth = finalHeight / aspect;
                        }

                        const xOffset = (pageWidth - finalWidth) / 2;

                        await addImageToPage(imageBase64, xOffset, yPos, finalWidth, finalHeight);
                        yPos += finalHeight + 6;
                    } catch (e) {
                        console.error('Failed to add pattern image:', e);
                        const placeholderY = yPos + 150;
                        doc.setFontSize(20);
                        doc.setFont('times', 'bold');
                        doc.setTextColor(150, 150, 150);
                        doc.text('Pattern Coming Soon', pageWidth / 2, placeholderY, { align: 'center', maxWidth: pageWidth - margin * 2 });
                        yPos = placeholderY + 40;
                    }
                } else {
                    // No image found for this pattern
                    const placeholderY = yPos + 150;
                    doc.setFontSize(20);
                    doc.setFont('times', 'bold');
                    doc.setTextColor(150, 150, 150);
                    doc.text('Pattern Coming Soon', pageWidth / 2, placeholderY, { align: 'center', maxWidth: pageWidth - margin * 2 });
                    yPos = placeholderY + 40;
                }

                // Render "Pattern Language" inline on the SAME page as the image.
                if (maneuversForB) {
                    renderPatternLanguageInline(maneuversForB, {
                        discipline: discipline.name,
                        patternNumber: extractPatternNumber(patternSelection?.patternName),
                    }, 'times');
                }

                } // end else (real pattern)
                } // end if (includePattern) for layout-b

                // Add scoresheet page after pattern (layout-b) if scoresheet inclusion is enabled
                if (includeScoresheet && !isCustomRequest) {
                    const numericPidForSsB = patternId ? (typeof patternId === 'number' ? patternId : parseInt(patternId)) : null;
                    // Try pattern-linked scoresheet first, then breed-specific fallback
                    let ssBase64B = numericPidForSsB && !isNaN(numericPidForSsB) && scoresheetImagesMap.has(numericPidForSsB)
                        ? scoresheetImagesMap.get(numericPidForSsB) : null;
                    if (!ssBase64B) {
                        const breedKeyB = `${assocName}-${discipline.name}`;
                        ssBase64B = scoresheetByAssocMap.get(breedKeyB) || null;
                    }
                    // In full-book mode, omit judge name from scoresheet header
                    const resolvedJudgeSsB = skipCoverAndToc ? resolveJudgeName(discipline, group, discIndex, groupIndex) : '';
                    const divisionLabelB = group.divisions?.map(d => formatDivisionWithGo(d)).join(' / ') || '';
                    const dateStrSsB = competitionDate ? format(parseLocalDate(competitionDate), 'MM-dd-yyyy') : '';
                    if (ssBase64B) {
                        addNewPage();
                        pagesWithOwnHeader.add(doc.internal.getNumberOfPages());
                        const ssMarginB = SCORESHEET_LAYOUT.margin;
                        const topReserveB = 40;
                        try {
                            const ssProps = doc.getImageProperties(ssBase64B);
                            const ssAspect = ssProps.height / ssProps.width;
                            const ssAvailH = pageHeight - ssMarginB - topReserveB;
                            const ssImgW = pageWidth - ssMarginB * 2;
                            let ssFinalW = ssImgW;
                            let ssFinalH = ssImgW * ssAspect;
                            if (ssFinalH > ssAvailH) { ssFinalH = ssAvailH; ssFinalW = ssFinalH / ssAspect; }
                            const ssXOff = (pageWidth - ssFinalW) / 2;
                            const ssYOff = topReserveB + 4;
                            drawScoreSheetHeader({
                                judgeName: resolvedJudgeSsB,
                                disciplineName: discipline.name,
                                division: divisionLabelB,
                                assocName,
                                dateStr: dateStrSsB,
                            });
                            await addImageToPage(ssBase64B, ssXOff, ssYOff, ssFinalW, ssFinalH);
                            // (label overlay is applied via canvas in the download path)
                        } catch (ssErr) {
                            console.error('Failed to add scoresheet image (layout-b):', ssErr);
                        }
                    } else if (!hasNoPattern) {
                        addNewPage();
                        pagesWithOwnHeader.add(doc.internal.getNumberOfPages());
                        drawGenericScoreSheetPage(doc, {
                            association: assocName,
                            showName: pbbData.showName || '',
                            discipline: discipline.name || '',
                            division: divisionLabelB,
                            date: dateStrSsB,
                            judge: resolvedJudgeSsB,
                        });
                    }
                }
            }
        }
    }

    // Sponsor logos are rendered on the cover page's bottom band — no
    // separate "Thank You to Our Sponsors!" page.

    // --- Finalize: Generate TOC with correct page numbers ---
    if (skipCoverAndToc) {
        // Hub mode: remove the blank first page (created by new jsPDF), then add simple headers/footers
        const totalPages = doc.internal.getNumberOfPages();
        let pageShift = 0;
        if (totalPages > 1) {
            doc.deletePage(1);
            pageShift = 1; // every previously-numbered page index is now (index - 1)
        }
        // Re-key pagesWithOwnHeader to the new (post-deletion) page numbers
        // so the skip-check in the finalize loop matches.
        const shiftedOwnHeader = new Set();
        for (const p of pagesWithOwnHeader) {
            const np = p - pageShift;
            if (np >= 1) shiftedOwnHeader.add(np);
        }

        const finalPageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= finalPageCount; i++) {
            doc.setPage(i);
            // Skip the generic page header on pages that drew their own banner
            // (e.g. scoresheet pages), otherwise the two headers overlap.
            if (!shiftedOwnHeader.has(i)) {
                addPageHeader(pbbData.showName || 'Pattern');
            }
            addPageFooter(i);
        }
        return doc.output('datauristring');
    }

    // TOC starts on page 2, but may span multiple pages
    // We need to:
    // 1. First calculate how many pages TOC will need
    // 2. Adjust all page references accordingly
    // 3. Then render the TOC

    const tocStartPage = 2;
    let tocPagesNeeded = 1; // Start with 1 page for TOC

    // Build the ordered TOC groups for the selected layout.
    //   Layout A (By Date):       group classes under each show day; the row
    //                             label is the full class name. A class that
    //                             runs on multiple days is listed under each day.
    //   Layout B (By Discipline): bundle every class of the same discipline
    //                             together (date is irrelevant), in the order the
    //                             disciplines appear in the book; the heading is
    //                             the discipline and the row label is the class
    //                             detail (divisions/levels) without repeating it.
    const buildTocGroups = () => {
        if (selectedLayout === 'layout-b') {
            const byDisc = {};
            const order = [];
            toc.forEach(item => {
                const key = item.discipline || item.title || '';
                if (!byDisc[key]) { byDisc[key] = []; order.push(key); }
                byDisc[key].push(item);
            });
            return order.map(key => ({
                heading: key,
                items: byDisc[key],
                rowLabel: (item) => item.classDetail || item.title || '',
            }));
        }
        // Layout A — by date
        const byDate = {};
        toc.forEach(item => {
            const itemDates = (item.dates && item.dates.length) ? item.dates : (item.date ? [item.date] : []);
            itemDates.forEach(d => {
                if (!byDate[d]) byDate[d] = [];
                byDate[d].push(item);
            });
        });
        return Object.keys(byDate).sort().map(d => ({
            heading: format(parseLocalDate(d), 'EEEE, MMMM d, yyyy'),
            items: byDate[d],
            rowLabel: (item) => item.title || '',
        }));
    };

    const tocGroups = buildTocGroups();

    // Estimate how many pages the TOC needs (heading + table head + rows + gap).
    {
        let estimatedHeight = 80;
        tocGroups.forEach(group => {
            estimatedHeight += 30;                       // group heading
            estimatedHeight += 30;                       // table head row
            estimatedHeight += group.items.length * 25;  // class rows
            estimatedHeight += 25;                       // spacing after table
        });
        const availableHeightPerPage = pageHeight - margin * 2;
        tocPagesNeeded = Math.ceil(estimatedHeight / availableHeightPerPage);
    }

    // If TOC spans multiple pages we must *insert* pages after page 2,
    // otherwise we would end up drawing TOC page 2 over the first content page.
    const tocPageOffset = Math.max(0, tocPagesNeeded - 1); // extra pages beyond the first TOC page

    // Insert extra TOC pages right after the TOC start page (page 2), shifting all content forward.
    if (tocPageOffset > 0) {
        for (let i = 0; i < tocPageOffset; i++) {
            // insert BEFORE the page that currently follows the TOC section
            doc.insertPage(tocStartPage + 1 + i);
        }
    }

    // Adjust all TOC page references (they are stored as displayed page numbers: pdfPage - 1)
    if (tocPageOffset > 0) {
        toc.forEach(item => {
            item.page = item.page + tocPageOffset;
        });
    }

    // Now render the TOC
    doc.setPage(tocStartPage);

    {
        // Layout B switches to an italic serif font family; the layout structure
        // (heading + table) is shared, only the grouping differs (built above).
        const tocFontFamily = selectedLayout === 'layout-b' ? 'times' : 'helvetica';
        const tocHeaderStyle = selectedLayout === 'layout-b' ? 'bolditalic' : 'bold';
        const tocRowStyle = selectedLayout === 'layout-b' ? 'italic' : 'normal';
        yPos = margin + 30;
        doc.setTextColor(40, 40, 40);
        // Auto-fit the TOC header so long show names don't get cut off on
        // the left/right edges of the page (e.g. "California Paint Horse
        // Association APHA-AQHA-Open Show – Table of Contents").
        const tocTitle = `${pbbData.showName || 'Pattern Book'} – Table of Contents`;
        const tocTitleFit = fitTextLines(tocTitle, {
            maxWidth: pageWidth - margin * 2,
            maxLines: 2,
            startSize: 20,
            minSize: 12,
            font: tocFontFamily,
            style: tocHeaderStyle,
        });
        doc.setFont(tocFontFamily, tocHeaderStyle);
        doc.setFontSize(tocTitleFit.size);
        doc.text(tocTitleFit.lines, pageWidth / 2, yPos, { align: 'center' });
        yPos += 30 + (tocTitleFit.lines.length - 1) * (tocTitleFit.size + 4);

        let tocCurrentPage = tocStartPage;

        tocGroups.forEach(group => {
            // Check if we need a new page - if so, track it
            if (yPos > pageHeight - 150) {
                if (tocCurrentPage < tocStartPage + tocPagesNeeded - 1) {
                    // We're still within estimated TOC pages, just move to next page
                    tocCurrentPage++;
                    doc.setPage(tocCurrentPage);
                    yPos = margin + 30;
                }
            }

            doc.setFont(tocFontFamily, tocHeaderStyle);
            doc.setFontSize(14);
            doc.setTextColor(60, 60, 60);
            doc.text(group.heading, margin, yPos);
            yPos += 30;

            const hasAnyClassNumbers = group.items.some(item => item.classNumber);
            const tableData = hasAnyClassNumbers
                ? group.items.map(item => [item.classNumber || '', group.rowLabel(item), item.page.toString()])
                : group.items.map(item => [group.rowLabel(item), item.page.toString()]);

            doc.autoTable({
                startY: yPos,
                head: hasAnyClassNumbers ? [['#', 'Class', 'Pg']] : [['Class', 'Pg']],
                body: tableData,
                theme: 'grid',
                styles: { fontSize: 10, cellPadding: 5, lineColor: [200, 200, 200], lineWidth: 0.5, font: tocFontFamily, fontStyle: tocRowStyle },
                headStyles: { font: tocFontFamily, fontStyle: tocHeaderStyle, fillColor: [52, 73, 94], textColor: [255, 255, 255] },
                columnStyles: hasAnyClassNumbers
                    ? { 0: { cellWidth: 60 }, 2: { cellWidth: 40, halign: 'center' } }
                    : { 1: { cellWidth: 40, halign: 'center' } },
                margin: { left: margin, right: margin },
                // Handle page breaks within autoTable
                didDrawPage: function(data) {
                    // Track if autoTable added a new page
                    tocCurrentPage = doc.internal.getCurrentPageInfo().pageNumber;
                }
            });
            yPos = doc.autoTable.previous.finalY + 25;
        });
    }
    
    
    // Add headers and footers to all pages (skip cover page, start numbering from TOC as page 1)
    const finalPageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= finalPageCount; i++) {
        doc.setPage(i);
        if (i === 1) continue; // Skip cover page
        const pageNum = i - 1; // TOC becomes page 1, first pattern page becomes page 2, etc.
        addPageHeader(pbbData.showName || 'Pattern Book');
        addPageFooter(pageNum);
    }

    // Embed any uploaded custom-pattern PDFs onto their placeholder pages.
    // jsPDF can't import PDFs, so this is done as a pdf-lib post-step. Page count
    // is preserved, so the TOC page numbers drawn above stay correct.
    if (customPdfOverlays.length > 0) {
        try {
            const bookBytes = doc.output('arraybuffer');
            return await overlayCustomPatternPdfs(bookBytes, customPdfOverlays, pageHeight);
        } catch (e) {
            console.error('Failed to embed custom pattern PDFs; returning book without embeds', e);
        }
    }

    return doc.output('datauristring');
};
