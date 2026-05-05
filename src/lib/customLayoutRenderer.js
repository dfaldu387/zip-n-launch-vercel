import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { fetchImageAsBase64, compressImage } from './pdfHelpers';
import { supabase } from '@/lib/supabaseClient';
import { parseLocalDate } from '@/lib/utils';

// Page modes supported by Layout C.
// - full:    1 slot covering the page body
// - half:    2 slots stacked vertically
// - grid:    4 slots in a 2x2 grid
export const PAGE_MODES = {
    full: { label: 'Full Page', slots: 1, cols: 1, rows: 1 },
    half: { label: 'Half Page (2)', slots: 2, cols: 1, rows: 2 },
    grid: { label: 'Grid (2x2)', slots: 4, cols: 2, rows: 2 },
};

const removeFirstWord = (name) => {
    if (!name) return name;
    let cleaned = name.replace(/^[^\s-]+\s*[-–—]\s*/, '').trim();
    cleaned = cleaned.replace(/^(Pro|Non-Pro)\s*[-–—]?\s*/i, '').trim();
    if (cleaned === name) {
        const parts = name.split(/\s+/);
        if (parts.length > 1 && !/^(Pro|Non-Pro)$/i.test(parts[0])) {
            cleaned = parts.slice(1).join(' ');
        } else if (parts.length > 1) {
            cleaned = parts.slice(1).join(' ').replace(/^\s*[-–—]\s*/, '').trim();
        }
    }
    return cleaned || name;
};

const formatDivisionWithGo = (division) => {
    const baseName = removeFirstWord(division.division || '');
    if (division.goNumber === 1 || division.goNumber === 2) {
        return `${baseName} (Go ${division.goNumber})`;
    }
    return baseName;
};

const extractPatternNumber = (fileName) => {
    if (!fileName) return null;
    const nameWithoutExt = fileName.replace(/\.(pdf|PDF)$/, '');
    const match = nameWithoutExt.match(/(\d+)(?:\.|$)/);
    if (match) return parseInt(match[1], 10) || null;
    const fallback = nameWithoutExt.match(/(\d+)$/);
    return fallback ? (parseInt(fallback[1], 10) || null) : null;
};

const isPatternDiscipline = (discipline) => {
    if (!discipline?.pattern) return false;
    if (discipline.pattern_type === 'scoresheet_only') return false;
    return true;
};

// Flatten pbbData's disciplines + patternSelections into a one-item-per-class list.
// Used by both the builder UI and the PDF renderer so the IDs line up.
export function flattenPatternItems(pbbData) {
    const items = [];
    const disciplines = pbbData?.disciplines || [];
    disciplines.forEach((discipline, discIndex) => {
        if (!isPatternDiscipline(discipline)) return;
        const patternGroups = discipline.patternGroups || [];
        patternGroups.forEach((group, groupIndex) => {
            const hasDivisions = group.divisions && group.divisions.length > 0;
            if (!hasDivisions) return;

            const disciplineId = discipline.id;
            const groupId = group.id;
            let patternSelection = null;
            if (disciplineId && groupId) {
                patternSelection = pbbData.patternSelections?.[disciplineId]?.[groupId];
            }
            if (!patternSelection) {
                patternSelection = pbbData.patternSelections?.[discIndex]?.[groupIndex];
            }

            let patternId = null;
            if (patternSelection && typeof patternSelection === 'object') {
                patternId = patternSelection.patternId || patternSelection.id;
                if (typeof patternId === 'object') patternId = null;
            } else if (patternSelection) {
                patternId = patternSelection;
            }

            let competitionDate = pbbData.startDate;
            if (group.divisions?.length) {
                const divisionDates = group.divisions
                    .map((div) => {
                        const divId = div.id || div;
                        return discipline.divisionDates?.[divId];
                    })
                    .filter(Boolean);
                if (divisionDates.length > 0) competitionDate = divisionDates[0];
            }

            const division = group.divisions?.map(formatDivisionWithGo).join(' / ') || '';
            const assocId = discipline.association_id || '';
            const associationName = (assocId || '').toUpperCase() || '';
            const patternNum = extractPatternNumber(patternSelection?.patternName);
            const patternLabel = patternNum !== null
                ? `Pattern ${patternNum}`
                : (patternSelection?.patternName || 'TBD');

            items.push({
                id: `${disciplineId || `d${discIndex}`}::${groupId || `g${groupIndex}`}`,
                disciplineIndex: discIndex,
                groupIndex,
                disciplineId,
                groupId,
                patternId: patternId ? (typeof patternId === 'number' ? patternId : parseInt(patternId) || null) : null,
                patternName: patternLabel,
                patternNumber: patternNum,
                disciplineName: discipline.name || 'Discipline',
                className: `${discipline.name || ''}${group.customLabel ? ` (${group.customLabel})` : ''} — ${division}`.trim(),
                division,
                competitionDate,
                associationName,
                customLabel: group.customLabel || '',
            });
        });
    });
    return items;
}

export function defaultCopyright(pbbData) {
    const year = new Date().getFullYear();
    const name = pbbData?.showName || 'Pattern Book';
    return `© ${year} ${name}`;
}

// Build an initial customLayout that places every pattern item on its own
// full-page slot. Called when the user opens the builder for the first time.
export function buildInitialCustomLayout(pbbData) {
    const items = flattenPatternItems(pbbData);
    return {
        pages: items.map((item, idx) => ({
            id: `page-${idx + 1}`,
            mode: 'full',
            slots: [item.id],
            roundLabel: '',
        })),
        logo: null,
        coverDescription: '',
        copyright: defaultCopyright(pbbData),
    };
}

async function fetchPatternImagesForIds(patternIds) {
    const map = new Map();
    if (!patternIds.length) return map;

    try {
        const { data: mediaData } = await supabase
            .from('tbl_pattern_media')
            .select('pattern_id, image_url')
            .in('pattern_id', patternIds);
        if (mediaData) {
            await Promise.all(
                mediaData
                    .filter((m) => m.image_url)
                    .map(async (m) => {
                        const base64 = await fetchImageAsBase64(m.image_url);
                        if (base64) map.set(m.pattern_id, base64);
                    })
            );
        }
    } catch (e) {
        console.error('Error fetching pattern media (layout-c):', e);
    }

    const missing = patternIds.filter((id) => !map.has(id));
    if (missing.length) {
        try {
            const { data: patternsData } = await supabase
                .from('tbl_patterns')
                .select('id, image_url, url')
                .in('id', missing);
            if (patternsData) {
                await Promise.all(
                    patternsData
                        .filter((p) => p.image_url || p.url)
                        .map(async (p) => {
                            const base64 = await fetchImageAsBase64(p.image_url || p.url);
                            if (base64) map.set(p.id, base64);
                        })
                );
            }
        } catch (e) {
            console.error('Error fetching pattern fallback images (layout-c):', e);
        }
    }

    return map;
}

async function fetchManeuversForIds(patternIds) {
    const map = new Map();
    if (!patternIds.length) return map;
    try {
        const { data } = await supabase
            .from('tbl_maneuvers')
            .select('pattern_id, step_no, instruction')
            .in('pattern_id', patternIds)
            .order('step_no');
        if (data) {
            data.forEach((r) => {
                if (!r?.pattern_id) return;
                const arr = map.get(r.pattern_id) || [];
                arr.push({ step_no: r.step_no, instruction: r.instruction });
                map.set(r.pattern_id, arr);
            });
        }
    } catch (e) {
        console.error('Error fetching maneuvers (layout-c):', e);
    }
    return map;
}

const addContainedImage = (doc, base64, boxX, boxY, boxW, boxH) => {
    if (!base64) return { drawW: 0, drawH: 0, x: boxX, y: boxY };
    try {
        const props = doc.getImageProperties(base64);
        const ratio = Math.min(boxW / props.width, boxH / props.height);
        const drawW = props.width * ratio;
        const drawH = props.height * ratio;
        const x = boxX + (boxW - drawW) / 2;
        const y = boxY + (boxH - drawH) / 2;
        const imageType = base64.substring(base64.indexOf('/') + 1, base64.indexOf(';'));
        doc.addImage(base64, imageType.toUpperCase(), x, y, drawW, drawH);
        return { drawW, drawH, x, y };
    } catch (e) {
        console.error('addContainedImage failed', e);
        return { drawW: 0, drawH: 0, x: boxX, y: boxY };
    }
};

// Per-mode tuning. These control the visual rhythm of a page's sub-slot
// headers, image sizing, and whether maneuvers are shown.
const MODE_SETTINGS = {
    full: {
        metaTitleSize: 13,
        metaSubSize: 10.5,
        metaPatternSize: 11,
        maneuverSize: 9,
        maneuverLine: 11,
        imageMaxRatio: 0.55, // image takes ~55% of slot height when maneuvers present
        showManeuvers: true,
        metaWidthRatio: 0.35,
    },
    half: {
        metaTitleSize: 10.5,
        metaSubSize: 9,
        metaPatternSize: 9.5,
        maneuverSize: 7.5,
        maneuverLine: 9,
        imageMaxRatio: 0.58,
        showManeuvers: true,
        metaWidthRatio: 0.32,
    },
    grid: {
        metaTitleSize: 8.5,
        metaSubSize: 7.5,
        metaPatternSize: 8,
        maneuverSize: 6.5,
        maneuverLine: 7.8,
        imageMaxRatio: 0.78, // grid: give image almost all space, maneuvers optional
        showManeuvers: false, // skip maneuvers in grid mode — not enough room
        metaWidthRatio: 0.4,
    },
};

const renderMetadataBlock = (doc, item, x, y, maxW, mode) => {
    const s = MODE_SETTINGS[mode] || MODE_SETTINGS.full;
    let cursorY = y;
    doc.setTextColor(0, 0, 0);

    // Line 1: Association
    if (item.associationName) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(s.metaTitleSize);
        doc.text(item.associationName, x, cursorY, { maxWidth: maxW });
        cursorY += s.metaTitleSize + 2;
    }

    // Line 2: Discipline name (uppercase, up to 2 lines)
    if (item.disciplineName) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(s.metaSubSize);
        const discLines = doc.splitTextToSize(item.disciplineName.toUpperCase(), maxW);
        const limited = discLines.slice(0, 2);
        limited.forEach((line, i) => {
            doc.text(line, x, cursorY + i * (s.metaSubSize + 1));
        });
        cursorY += limited.length * (s.metaSubSize + 1) + 2;
    }

    // Line 3: PATTERN N
    if (item.patternName) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(s.metaPatternSize);
        doc.text(item.patternName.toUpperCase(), x, cursorY, { maxWidth: maxW });
        cursorY += s.metaPatternSize + 2;
    }

    // Line 4: Division (light italic, single line)
    if (item.division) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(Math.max(7, s.metaSubSize - 1));
        doc.setTextColor(70, 70, 70);
        const divLines = doc.splitTextToSize(item.division, maxW);
        doc.text(divLines.slice(0, 2), x, cursorY);
        cursorY += Math.min(2, divLines.length) * (s.metaSubSize + 1);
        doc.setTextColor(0, 0, 0);
    }

    return cursorY;
};

const renderManeuvers = (doc, maneuvers, x, y, w, h, mode) => {
    if (!maneuvers?.length) return;
    const s = MODE_SETTINGS[mode] || MODE_SETTINGS.full;
    if (!s.showManeuvers) return;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(s.maneuverSize);

    const sorted = [...maneuvers].sort((a, b) => (a.step_no || 0) - (b.step_no || 0));
    let cursor = y;
    const bottom = y + h;
    for (const m of sorted) {
        const stepLabel = m.step_no != null ? `${m.step_no}.` : '•';
        const line = `${stepLabel} ${m.instruction || ''}`.trim();
        const wrapped = doc.splitTextToSize(line, w);
        const needed = wrapped.length * s.maneuverLine;
        if (cursor + needed > bottom) {
            // No room left — stop (do NOT truncate silently in full/half; the
            // builder should warn when this happens, but the PDF must still be
            // produced).
            break;
        }
        doc.text(wrapped, x, cursor);
        cursor += needed + 2;
    }
};

// Render a single pattern into the given rectangle — reference-style:
// metadata-left-top, pattern diagram centered/right-of-metadata, maneuvers below.
// No border, no empty placeholder.
const renderSlot = (doc, slotRect, item, context, mode) => {
    if (!item) return;
    const { patternImagesMap, maneuversMap } = context;
    const { x, y, w, h } = slotRect;
    const s = MODE_SETTINGS[mode] || MODE_SETTINGS.full;

    // Metadata block — top-left of the slot
    const metaX = x;
    const metaY = y + 4;
    const metaMaxW = Math.max(120, w * s.metaWidthRatio);
    const metaBottom = renderMetadataBlock(doc, item, metaX, metaY + 10, metaMaxW, mode);
    const metaBlockH = Math.max(metaBottom - metaY, 40);

    // Decide where the image goes:
    // - Full/Half: metadata takes the left column, diagram spans across to the
    //   right (wider than just the remaining strip) so we let the diagram drop
    //   BELOW the metadata block and span full slot width. Reference shows the
    //   diagram centered using the full body width.
    // - Grid: same approach but tighter.
    const maneuvers = item.patternId ? maneuversMap.get(item.patternId) : null;
    const hasManeuvers = s.showManeuvers && maneuvers?.length;

    // Reserve maneuver space (approx) so image doesn't overlap.
    let maneuverReserve = 0;
    if (hasManeuvers) {
        // Estimate room for all maneuvers; cap at ~40% of slot height.
        const approxLines = maneuvers.reduce((acc, m) => {
            const text = `${m.step_no || '•'}. ${m.instruction || ''}`;
            return acc + Math.max(1, Math.ceil(doc.getTextWidth(text) / (w - 8)));
        }, 0);
        const estH = approxLines * s.maneuverLine + 4;
        maneuverReserve = Math.min(estH, Math.floor(h * 0.42));
    }

    const imgAreaTop = y + metaBlockH + 8;
    const imgAreaBottom = y + h - maneuverReserve - 4;
    const imgBoxX = x + 6;
    const imgBoxW = w - 12;
    const imgBoxY = imgAreaTop;
    const imgBoxH = Math.max(60, imgAreaBottom - imgAreaTop);

    const image = item.patternId ? patternImagesMap.get(item.patternId) : null;
    let drawnImg = { drawH: 0, drawW: 0, x: imgBoxX, y: imgBoxY };
    if (image) {
        drawnImg = addContainedImage(doc, image, imgBoxX, imgBoxY, imgBoxW, imgBoxH);
    } else {
        // Reserved space stays empty — no "Pattern Coming Soon" noise in final
        // output. (Builder warns if a slot has no pattern assigned.)
    }

    if (hasManeuvers) {
        const manY = (drawnImg.drawH > 0 ? drawnImg.y + drawnImg.drawH : imgAreaBottom) + 8;
        const manH = (y + h) - manY - 2;
        if (manH > 10) {
            renderManeuvers(doc, maneuvers, x + 8, manY, w - 16, manH, mode);
        }
    }
};

const computeSlotRects = (mode, contentRect) => {
    const { x, y, w, h } = contentRect;
    const gap = 14;
    switch (mode) {
        case 'full':
            return [{ x, y, w, h }];
        case 'half': {
            const slotH = (h - gap) / 2;
            return [
                { x, y, w, h: slotH },
                { x, y: y + slotH + gap, w, h: slotH },
            ];
        }
        case 'grid': {
            const slotW = (w - gap) / 2;
            const slotH = (h - gap) / 2;
            return [
                { x, y, w: slotW, h: slotH },
                { x: x + slotW + gap, y, w: slotW, h: slotH },
                { x, y: y + slotH + gap, w: slotW, h: slotH },
                { x: x + slotW + gap, y: y + slotH + gap, w: slotW, h: slotH },
            ];
        }
        default:
            return [{ x, y, w, h }];
    }
};

const drawPageHeader = (doc, ctx, page) => {
    const { pageWidth, margin, logoBase64 } = ctx;
    const mode = page?.mode || 'full';
    // Logo sizing per mode — reference uses a large logo on full-page spreads.
    const logoMaxW = mode === 'grid' ? 90 : mode === 'half' ? 120 : 150;
    const logoMaxH = mode === 'grid' ? 60 : mode === 'half' ? 75 : 90;

    let logoBottom = margin;
    if (logoBase64) {
        const boxX = pageWidth - margin - logoMaxW;
        const boxY = margin;
        const drawn = addContainedImage(doc, logoBase64, boxX, boxY, logoMaxW, logoMaxH);
        logoBottom = drawn.y + drawn.drawH;
    }

    // Round label below logo (right-aligned under the logo box)
    if (page?.roundLabel) {
        const lines = String(page.roundLabel).split(/\r?\n/).slice(0, 2);
        doc.setTextColor(0, 0, 0);
        doc.setFont('times', 'bold');
        const labelSize = mode === 'grid' ? 12 : mode === 'half' ? 16 : 20;
        doc.setFontSize(labelSize);
        lines.forEach((line, i) => {
            doc.text(
                line,
                pageWidth - margin,
                logoBottom + 12 + i * (labelSize + 2),
                { align: 'right' }
            );
        });
        return logoBottom + 12 + lines.length * (labelSize + 2);
    }

    return logoBottom;
};

const drawPageFooter = (doc, ctx, pageNum) => {
    const { pageHeight, pageWidth, margin, copyright, showName } = ctx;
    const baseY = pageHeight - 18;

    // Optional copyright line sits above the main brand/page line. Keeps the
    // user's configurable copyright visible without overloading the footer.
    if (copyright) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(140, 140, 140);
        doc.text(copyright, margin, baseY - 11, { maxWidth: pageWidth - margin * 2 });
    }

    // Match Layout A/B footer style: italic "{showName} – Page {N}" left,
    // equipatterns.com branding right.
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const footerText = `${showName || 'Pattern Book'} – Page ${pageNum}`;
    doc.text(footerText, margin, baseY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('equipatterns.com', pageWidth - margin, baseY, { align: 'right' });

    doc.setTextColor(0, 0, 0);
};

const drawCoverPage = (doc, ctx) => {
    const { pageWidth, pageHeight, margin, logoBase64, showName, publishedAt, version, coverDescription } = ctx;

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    const contentTop = margin + 40;
    let cursorY = contentTop;

    // Large centered logo
    if (logoBase64) {
        const boxW = Math.min(pageWidth - margin * 2 - 40, 320);
        const boxH = 180;
        const boxX = (pageWidth - boxW) / 2;
        const drawn = addContainedImage(doc, logoBase64, boxX, cursorY, boxW, boxH);
        cursorY = drawn.y + drawn.drawH + 30;
    } else {
        cursorY += 40;
    }

    // "Pattern Book" title (or show name if no show)
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(48);
    const title = 'Pattern Book';
    doc.text(title, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 60;

    // Show name (secondary)
    if (showName) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(18);
        doc.setTextColor(60, 60, 60);
        const showLines = doc.splitTextToSize(showName, pageWidth - margin * 2 - 40);
        showLines.slice(0, 2).forEach((line, i) => {
            doc.text(line, pageWidth / 2, cursorY + i * 22, { align: 'center' });
        });
        cursorY += Math.min(2, showLines.length) * 22 + 20;
    }

    // Free-text cover description paragraph
    if (coverDescription) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(30, 30, 30);
        const paragraphWidth = pageWidth - margin * 2 - 40;
        const bodyLines = doc.splitTextToSize(coverDescription, paragraphWidth);
        const lineH = 16;
        const available = pageHeight - margin - 120 - cursorY; // leave room for version stamp
        const maxLines = Math.max(4, Math.floor(available / lineH));
        const toDraw = bodyLines.slice(0, maxLines);
        toDraw.forEach((line, i) => {
            doc.text(line, pageWidth / 2, cursorY + i * lineH, { align: 'center' });
        });
        cursorY += toDraw.length * lineH + 20;
    }

    // Version + published datetime stamp at bottom
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    const stampBits = [];
    if (version) stampBits.push(`Version ${version}`);
    if (publishedAt) {
        try {
            stampBits.push(`Published ${format(new Date(publishedAt), 'MMMM d, yyyy • h:mm a')}`);
        } catch {}
    }
    if (stampBits.length) {
        doc.text(stampBits.join('  •  '), pageWidth / 2, pageHeight - margin - 24, { align: 'center' });
    }
    doc.setTextColor(0, 0, 0);
};

export async function generateCustomLayoutPdf(pbbData) {
    const customLayout = pbbData?.customLayout || buildInitialCustomLayout(pbbData);
    const pages = Array.isArray(customLayout.pages) ? customLayout.pages : [];
    const logoDataUrl = customLayout.logo?.dataUrl || null;
    const version = pbbData?.customLayoutVersion || 'v1';
    const publishedAt = pbbData?.customLayoutPublishedAt || new Date().toISOString();
    const coverDescription = customLayout.coverDescription || '';
    const copyright = customLayout.copyright || defaultCopyright(pbbData);

    const doc = new jsPDF('p', 'pt', 'letter');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;

    // Flatten items and gather referenced pattern IDs
    const items = flattenPatternItems(pbbData);
    const itemsById = new Map(items.map((i) => [i.id, i]));
    const referencedItemIds = new Set();
    pages.forEach((p) => (p.slots || []).forEach((s) => s && referencedItemIds.add(s)));
    const referencedPatternIds = Array.from(
        new Set(
            Array.from(referencedItemIds)
                .map((id) => itemsById.get(id)?.patternId)
                .filter((v) => v != null && !isNaN(v))
        )
    );

    const [patternImagesMap, maneuversMap, logoBase64] = await Promise.all([
        fetchPatternImagesForIds(referencedPatternIds),
        fetchManeuversForIds(referencedPatternIds),
        logoDataUrl
            ? (async () => {
                  try {
                      const raw = logoDataUrl.startsWith('data:') ? logoDataUrl : await fetchImageAsBase64(logoDataUrl);
                      if (!raw) return null;
                      return (await compressImage(raw, 480, 480, 0.9)) || raw;
                  } catch {
                      return null;
                  }
              })()
            : Promise.resolve(null),
    ]);

    // Cover page
    drawCoverPage(doc, {
        pageWidth,
        pageHeight,
        margin,
        logoBase64,
        showName: pbbData?.showName,
        publishedAt,
        version,
        coverDescription,
    });

    if (pages.length === 0) {
        doc.addPage();
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(14);
        doc.setTextColor(120, 120, 120);
        doc.text(
            'No pages configured in this custom layout.',
            pageWidth / 2,
            pageHeight / 2,
            { align: 'center' }
        );
        drawPageFooter(doc, { pageHeight, pageWidth, margin, copyright, showName: pbbData?.showName },1);
        return doc.output('datauristring');
    }

    pages.forEach((page, pageIdx) => {
        doc.addPage();
        const pageNum = pageIdx + 1;
        const mode = PAGE_MODES[page.mode] ? page.mode : 'full';

        // Header (logo top-right + round label)
        const headerBottom = drawPageHeader(doc, { pageWidth, margin, logoBase64 }, page);

        // Body region (between header and footer)
        const footerReserve = 30;
        const bodyTop = Math.max(headerBottom + 16, margin + 30);
        const bodyBottom = pageHeight - footerReserve;
        const bodyX = margin;
        const bodyW = pageWidth - margin * 2;
        const bodyH = bodyBottom - bodyTop;

        const rects = computeSlotRects(mode, { x: bodyX, y: bodyTop, w: bodyW, h: bodyH });
        const slotIds = page.slots || [];
        rects.forEach((rect, slotIdx) => {
            const itemId = slotIds[slotIdx];
            const item = itemId ? itemsById.get(itemId) : null;
            renderSlot(doc, rect, item, { patternImagesMap, maneuversMap }, mode);
        });

        drawPageFooter(doc, { pageHeight, pageWidth, margin, copyright, showName: pbbData?.showName },pageNum);
    });

    return doc.output('datauristring');
}
