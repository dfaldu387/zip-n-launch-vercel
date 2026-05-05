import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { renumberShowBill } from './showBillUtils';

const DEFAULT_LAYOUT = {
  showNumbers: true,
  numberingMode: 'global',
  showAssociations: true,
  showDayHeaders: true,
  showArenaHeaders: true,
  daySeparatorStyle: 'boxed',
  arenaSeparatorStyle: 'line',
  lineSpacing: 'normal',
  fontSize: 'medium',
  showHeader: true,
  showVenue: true,
  showJudges: true,
  showFooter: true,
  customFooterText: '',
  background: { id: 'none', type: 'none', value: '' },
  coverPage: {
    enabled: false,
    logoUrl: '',
    logoData: '',
    title: '',
    subtitle: '',
    customText: '',
    showDates: true,
    showVenue: true,
    bgColor: '#ffffff',
    textColor: '#000000',
    bgImageData: '',
    fontFamily: 'helvetica',
    sponsorLogos: [],
  },
};

// Font size maps: [body, subhead, heading]
const FONT_SIZES = {
  small:  { body: 8, sub: 9, head: 18, day: 11, arena: 10 },
  medium: { body: 10, sub: 11, head: 22, day: 14, arena: 12 },
  large:  { body: 12, sub: 13, head: 26, day: 16, arena: 14 },
};

// Line spacing (y-increment per body line)
const LINE_HEIGHTS = { compact: 11, normal: 14, relaxed: 18 };

export async function generateShowBillPdf(showBill, allClassItems, associationsData, layoutSettings) {
  if (!showBill) throw new Error('No show bill data available');

  const ls = { ...DEFAULT_LAYOUT, ...layoutSettings };
  const fonts = FONT_SIZES[ls.fontSize] || FONT_SIZES.medium;
  const lineH = LINE_HEIGHTS[ls.lineSpacing] || LINE_HEIGHTS.normal;

  // Renumber with the layout's numbering mode
  const sb = JSON.parse(JSON.stringify(showBill));
  sb.settings = { ...sb.settings, numberingMode: ls.numberingMode, startClassNumber: ls.startClassNumber || 1 };
  const numberedBill = renumberShowBill(sb);

  const doc = new jsPDF('p', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  const footerHeight = ls.showFooter ? 30 : 10;
  let y = margin;

  // --- Background helper ---
  let bgImageData = null;

  // Pre-load image background if needed
  const bg = ls.background;
  if (bg?.type === 'image' && bg.value) {
    try {
      const resp = await fetch(bg.value);
      const blob = await resp.blob();
      bgImageData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Failed to load background image:', e);
    }
  }

  const parseHex = (hex) => {
    hex = hex.replace('#', '');
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
  };

  const drawBackground = () => {
    if (!bg || bg.type === 'none') return;
    if (bg.type === 'solid' && bg.value) {
      const [r, g, b] = parseHex(bg.value);
      doc.setFillColor(r, g, b);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
    } else if (bg.type === 'gradient' && bg.value) {
      // Approximate gradient with the first color as solid fill
      const match = bg.value.match(/#[0-9A-Fa-f]{6}/g);
      if (match && match[0]) {
        const [r, g, b] = parseHex(match[0]);
        doc.setFillColor(r, g, b);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
      }
    } else if (bg.type === 'image' && bgImageData) {
      try {
        const gState = new doc.GState({ opacity: 0.15 });
        doc.saveGraphicsState();
        doc.setGState(gState);
        doc.addImage(bgImageData, 'JPEG', 0, 0, pageWidth, pageHeight);
        doc.restoreGraphicsState();
      } catch (e) {
        console.warn('Failed to render background image in PDF:', e);
      }
    }
  };

  // ============================================================
  // COVER PAGE (optional — inserted as page 1)
  // ============================================================
  const cover = ls.coverPage || {};
  if (cover.enabled) {
    const coverFont = cover.fontFamily || 'helvetica';

    // Cover page background color
    const [cr, cg, cb] = cover.bgColor ? parseHex(cover.bgColor) : [255, 255, 255];
    doc.setFillColor(cr, cg, cb);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Cover background image (low opacity overlay)
    if (cover.bgImageData) {
      try {
        const gState = new doc.GState({ opacity: 0.15 });
        doc.saveGraphicsState();
        doc.setGState(gState);
        doc.addImage(cover.bgImageData, 'PNG', 0, 0, pageWidth, pageHeight);
        doc.restoreGraphicsState();
      } catch (e) {
        console.warn('Failed to render cover background image:', e);
      }
    }

    const txtColor = cover.textColor ? parseHex(cover.textColor) : [0, 0, 0];
    let cy = margin + 60;

    // Logo (supports both uploaded base64 and URL)
    const logoSrc = cover.logoData || cover.logoUrl;
    if (logoSrc) {
      try {
        let logoData = logoSrc;
        // If it's a URL (not base64), fetch it
        if (!logoSrc.startsWith('data:')) {
          const logoResp = await fetch(logoSrc);
          const logoBlob = await logoResp.blob();
          logoData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(logoBlob);
          });
        }
        const logoMaxW = 200;
        const logoMaxH = 150;
        const logoX = (pageWidth - logoMaxW) / 2;
        doc.addImage(logoData, 'PNG', logoX, cy, logoMaxW, logoMaxH);
        cy += logoMaxH + 30;
      } catch (e) {
        console.warn('Failed to load cover logo:', e);
        cy += 20;
      }
    }

    // Title (defaults to show name)
    const coverTitle = cover.title || numberedBill.header?.showName || 'Show Bill';
    doc.setFontSize(32);
    doc.setFont(coverFont, 'bold');
    doc.setTextColor(...txtColor);
    const titleLines = doc.splitTextToSize(coverTitle, contentWidth - 40);
    titleLines.forEach((line) => {
      doc.text(line, pageWidth / 2, cy, { align: 'center' });
      cy += 38;
    });
    cy += 10;

    // Subtitle
    if (cover.subtitle) {
      doc.setFontSize(18);
      doc.setFont(coverFont, 'normal');
      const subLines = doc.splitTextToSize(cover.subtitle, contentWidth - 40);
      subLines.forEach((line) => {
        doc.text(line, pageWidth / 2, cy, { align: 'center' });
        cy += 24;
      });
      cy += 10;
    }

    // Dates
    if (cover.showDates && numberedBill.header?.dates) {
      doc.setFontSize(16);
      doc.setFont(coverFont, 'normal');
      doc.text(numberedBill.header.dates, pageWidth / 2, cy, { align: 'center' });
      cy += 24;
    }

    // Venue
    if (cover.showVenue && numberedBill.header?.venue) {
      doc.setFontSize(14);
      doc.setFont(coverFont, 'normal');
      doc.text(numberedBill.header.venue, pageWidth / 2, cy, { align: 'center' });
      cy += 22;
    }

    // Custom text / advertisement
    if (cover.customText) {
      cy += 20;
      doc.setFontSize(12);
      doc.setFont(coverFont, 'normal');
      const customLines = doc.splitTextToSize(cover.customText, contentWidth - 60);
      customLines.forEach((line) => {
        doc.text(line, pageWidth / 2, cy, { align: 'center' });
        cy += 16;
      });
    }

    // Sponsor logos row
    const sponsors = cover.sponsorLogos || [];
    if (sponsors.length > 0) {
      cy += 30;
      // "Sponsors" label
      doc.setFontSize(8);
      doc.setFont(coverFont, 'normal');
      doc.setTextColor(...txtColor);
      doc.text('SPONSORS', pageWidth / 2, cy, { align: 'center' });
      cy += 14;

      const sponsorMaxH = 40;
      const sponsorMaxW = 80;
      const gap = 16;
      const totalW = sponsors.length * sponsorMaxW + (sponsors.length - 1) * gap;
      let sx = (pageWidth - totalW) / 2;

      for (const s of sponsors) {
        try {
          doc.addImage(s.data, 'PNG', sx, cy, sponsorMaxW, sponsorMaxH);
        } catch (e) {
          console.warn('Failed to render sponsor logo:', e);
        }
        sx += sponsorMaxW + gap;
      }
      cy += sponsorMaxH + 10;
    }

    // Reset font and text color for schedule pages
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);

    // Start a new page for the actual schedule
    doc.addPage();
  }

  // Draw background on first schedule page
  drawBackground();

  // --- Helpers ---
  const checkPageBreak = (needed) => {
    if (y + needed > pageHeight - margin - footerHeight) {
      doc.addPage();
      drawBackground();
      y = margin;
    }
  };

  const drawHorizontalRule = (weight = 0.5) => {
    doc.setLineWidth(weight);
    doc.setDrawColor(0);
    doc.line(margin, y, pageWidth - margin, y);
    y += 2;
  };

  const getAssocString = (classIds) => {
    if (!ls.showAssociations) return '';
    const uniqueAssocs = new Set();
    (classIds || []).forEach(cid => {
      const cls = allClassItems.find(c => c.divisionId === cid || c.id === cid);
      if (cls) {
        const assoc = associationsData?.find(a => a.id === cls.assocId);
        uniqueAssocs.add(assoc?.abbreviation || cls.assocId);
      }
    });
    return '- ' + Array.from(uniqueAssocs).join(', ');
  };

  // ============================================================
  // SHOW HEADER
  // ============================================================
  const header = numberedBill.header || {};

  if (ls.showHeader) {
    doc.setFontSize(fonts.head);
    doc.setFont(undefined, 'bold');
    doc.text(header.showName || 'Show Bill', pageWidth / 2, y, { align: 'center' });
    y += fonts.head;

    if (ls.showVenue && header.venue) {
      doc.setFontSize(fonts.sub);
      doc.setFont(undefined, 'normal');
      doc.text(header.venue, pageWidth / 2, y, { align: 'center' });
      y += lineH;
    }

    if (header.dates) {
      doc.setFontSize(fonts.sub);
      doc.setFont(undefined, 'normal');
      doc.text(header.dates, pageWidth / 2, y, { align: 'center' });
      y += lineH;
    }

    if (ls.showJudges && header.judges?.length > 0) {
      doc.setFontSize(fonts.body);
      doc.setFont(undefined, 'normal');
      doc.text(header.judges.join(', '), pageWidth / 2, y, { align: 'center', maxWidth: contentWidth - 40 });
      y += lineH;
    }

    if (header.customText) {
      doc.setFontSize(fonts.body - 1);
      doc.setFont(undefined, 'italic');
      doc.text(header.customText, pageWidth / 2, y, { align: 'center', maxWidth: contentWidth - 40 });
      y += lineH;
    }

    y += 4;
    drawHorizontalRule(1.5);
    y += 8;
  }

  // ============================================================
  // DAYS & ARENAS
  // ============================================================
  for (const day of numberedBill.days || []) {
    // --- Day Header ---
    if (ls.showDayHeaders) {
      checkPageBreak(50);
      y += 6;

      if (ls.daySeparatorStyle === 'boxed') {
        const dayHeaderHeight = Math.round(fonts.day * 1.7);
        doc.setFillColor(240, 240, 240);
        doc.setDrawColor(0);
        doc.setLineWidth(1);
        doc.rect(margin + 60, y, contentWidth - 120, dayHeaderHeight, 'FD');
        doc.setFontSize(fonts.day);
        doc.setFont(undefined, 'bold');
        doc.text(day.label || day.date, pageWidth / 2, y + dayHeaderHeight * 0.65, { align: 'center' });
        y += dayHeaderHeight + 12;
      } else if (ls.daySeparatorStyle === 'line') {
        drawHorizontalRule(0.75);
        y += 4;
        doc.setFontSize(fonts.day);
        doc.setFont(undefined, 'bold');
        doc.text(day.label || day.date, pageWidth / 2, y, { align: 'center' });
        y += fonts.day + 2;
        drawHorizontalRule(0.75);
        y += 8;
      } else {
        // 'none' — just text
        doc.setFontSize(fonts.day);
        doc.setFont(undefined, 'bold');
        doc.text(day.label || day.date, pageWidth / 2, y, { align: 'center' });
        y += fonts.day + 8;
      }
    }

    for (const arena of day.arenas || []) {
      // Skip closed arenas
      if ((numberedBill.closedArenas || {})[`${day.id}::${arena.id}`]) continue;

      // --- Arena Header ---
      if (ls.showArenaHeaders) {
        checkPageBreak(30);
        y += 4;

        doc.setFontSize(fonts.arena);
        doc.setFont(undefined, 'bold');
        const timeInfo = arena.startTime ? ` \u2013 ${arena.startTime}` : '';
        const arenaLabel = `${arena.name}${timeInfo}`;

        if (ls.arenaSeparatorStyle === 'bold-line') {
          drawHorizontalRule(1.2);
          y += 2;
          doc.text(arenaLabel, pageWidth / 2, y, { align: 'center' });
          y += fonts.arena + 2;
          drawHorizontalRule(1.2);
          y += lineH;
        } else if (ls.arenaSeparatorStyle === 'line') {
          doc.text(arenaLabel, pageWidth / 2, y, { align: 'center' });
          y += 2;
          drawHorizontalRule(0.5);
          y += lineH;
        } else {
          doc.text(arenaLabel, pageWidth / 2, y, { align: 'center' });
          y += fonts.arena + lineH;
        }
      }

      for (const item of arena.items || []) {
        // --- Section Header ---
        if (item.type === 'sectionHeader') {
          checkPageBreak(28);
          y += 6;
          doc.setFontSize(fonts.sub);
          doc.setFont(undefined, 'bold');
          doc.text(item.title, pageWidth / 2, y, { align: 'center' });
          y += 4;
          doc.setLineWidth(0.3);
          doc.line(margin + 80, y, pageWidth - margin - 80, y);
          y += 10;
          continue;
        }

        // --- Break ---
        if (item.type === 'break') {
          checkPageBreak(20);
          y += 4;
          doc.setFontSize(fonts.body);
          doc.setFont(undefined, 'bolditalic');
          const breakText = item.duration ? `${item.title} \u2013 ${item.duration}` : item.title;
          doc.text(breakText, pageWidth / 2, y, { align: 'center' });
          y += lineH;
          continue;
        }

        // --- Arena Drag ---
        if (item.type === 'drag') {
          checkPageBreak(20);
          y += 4;
          doc.setFontSize(fonts.body);
          doc.setFont(undefined, 'bolditalic');
          doc.text(item.title, pageWidth / 2, y, { align: 'center' });
          y += lineH;
          continue;
        }

        // --- Custom Event ---
        if (item.type === 'custom') {
          checkPageBreak(20);
          doc.setFontSize(fonts.body);
          doc.setFont(undefined, 'normal');
          const customText = item.content ? `${item.title}: ${item.content}` : item.title;
          doc.text(customText, margin + 10, y, { maxWidth: contentWidth - 20 });
          y += lineH;
          continue;
        }

        // --- Class Box ---
        if (item.type === 'classBox') {
          const classDetails = (item.classes || []).map(cid => allClassItems.find(c => c.divisionId === cid || c.id === cid)).filter(Boolean);
          const assocStr = getAssocString(item.classes);

          if (classDetails.length <= 1) {
            checkPageBreak(16);
            doc.setFontSize(fonts.body);

            const numStr = ls.showNumbers && item.number ? `${item.number}.` : '';
            if (numStr) {
              doc.setFont(undefined, 'bold');
              doc.text(numStr, margin, y);
            }

            const titleText = item.title || classDetails[0]?.name || 'Untitled';
            const fullLine = assocStr ? `${titleText}  ${assocStr}` : titleText;
            doc.setFont(undefined, 'normal');
            doc.text(fullLine, margin + 32, y, { maxWidth: contentWidth - 40 });
            y += lineH;
          } else {
            checkPageBreak(16 + classDetails.length * (lineH - 1));
            doc.setFontSize(fonts.body);
            doc.setFont(undefined, 'bold');

            const numStr = ls.showNumbers && item.number ? `${item.number}.` : '';
            if (numStr) doc.text(numStr, margin, y);
            doc.text(item.title || 'Grouped Classes', margin + 32, y);
            y += lineH;

            doc.setFont(undefined, 'normal');
            doc.setFontSize(fonts.body - 1);
            classDetails.forEach(cls => {
              checkPageBreak(lineH - 1);
              const assoc = associationsData?.find(a => a.id === cls.assocId);
              const assocTag = ls.showAssociations && assoc ? ` - ${assoc.abbreviation}` : '';
              doc.text(`     ${cls.name}${assocTag}`, margin + 36, y);
              y += lineH - 1;
            });
          }
        }
      }

      y += 4;
    }

    y += 4;
  }

  // ============================================================
  // PAGE FOOTERS
  // ============================================================
  if (ls.showFooter) {
    const totalPages = doc.internal.getNumberOfPages();
    const coverOffset = cover.enabled ? 1 : 0;
    const schedulePages = totalPages - coverOffset;
    for (let i = 1; i <= totalPages; i++) {
      // Skip footer on cover page
      if (cover.enabled && i === 1) continue;
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(120);
      const pageNum = i - coverOffset;
      doc.text(
        `Page ${pageNum} of ${schedulePages}`,
        pageWidth / 2,
        pageHeight - 16,
        { align: 'center' }
      );
      doc.text(
        header.showName || 'Show Bill',
        margin,
        pageHeight - 16
      );
      if (ls.customFooterText) {
        doc.text(
          ls.customFooterText,
          pageWidth - margin,
          pageHeight - 16,
          { align: 'right' }
        );
      }
      doc.setTextColor(0);
    }
  }

  doc.save(`${(header.showName || 'Show-Bill').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.pdf`);
}
