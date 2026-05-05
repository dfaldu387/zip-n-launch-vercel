import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { renumberShowBill } from './showBillUtils';
import { format, parseISO, eachDayOfInterval } from 'date-fns';

// ─── Constants ───────────────────────────────────────────────────────

const COLORS = {
  primary: [33, 82, 160],      // deep blue
  secondary: [60, 60, 60],     // dark gray
  accent: [0, 122, 204],       // lighter blue
  muted: [120, 120, 120],
  light: [240, 240, 240],
  white: [255, 255, 255],
  black: [0, 0, 0],
  rule: [180, 180, 180],
  tableHeader: [33, 82, 160],
  tableStripe: [245, 247, 250],
};

const MARGIN = 40;
const FONT_BODY = 10;
const FONT_SUB = 11;
const FONT_SECTION = 14;
const FONT_TITLE = 24;
const LINE_H = 14;

// ─── Helpers ─────────────────────────────────────────────────────────

function newPage(doc, drawHeader) {
  doc.addPage();
  if (drawHeader) drawHeader();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'EEEE, MMMM d, yyyy');
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'MMMM d, yyyy');
  } catch {
    return dateStr;
  }
}

function formatDateRange(start, end) {
  if (!start) return '';
  const s = formatDateShort(start);
  if (!end || end === start) return s;
  return `${s} — ${formatDateShort(end)}`;
}

const UNIT_TYPE_LABELS = {
  flat: '',
  per_horse: '/ horse',
  per_night: '/ night',
  per_bag: '/ bag',
  per_class: '/ class',
  custom: '',
};

function getUnitSuffix(fee) {
  if (fee.unit_type === 'custom' && fee.custom_unit_label) return `/ ${fee.custom_unit_label}`;
  return UNIT_TYPE_LABELS[fee.unit_type || fee.type] || '';
}

// ─── Main Generator ──────────────────────────────────────────────────

/**
 * Generate a multi-page Show Packet PDF from existing show data.
 *
 * @param {Object} showData - The full project_data for the show
 * @param {Object} [options] - Optional overrides
 * @param {Array}  [options.allClassItems] - Pre-computed class items
 * @param {Array}  [options.associationsData] - Association lookup array
 */
export async function generateShowPacketPdf(showData, options = {}) {
  if (!showData) throw new Error('No show data provided');

  const pd = showData;
  const showName = pd.showName || 'Horse Show';
  const showNumber = pd.showNumber ? `#${pd.showNumber}` : '';
  const venue = pd.venueName || '';
  const venueAddress = pd.venueAddress || '';
  const dateRange = formatDateRange(pd.startDate, pd.endDate);

  const doc = new jsPDF('p', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  // ── Page footer helper ──
  const drawFooter = (pageNum) => {
    // Thin line above footer
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, pageHeight - 28, pageWidth - MARGIN, pageHeight - 28);
    // Left: show name, Right: page number
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(showName, MARGIN, pageHeight - 18);
    doc.text(`Page ${pageNum}`, pageWidth - MARGIN, pageHeight - 18, { align: 'right' });
    doc.setTextColor(0);
    doc.setDrawColor(0);
  };

  // ── Check page break ──
  const checkBreak = (needed) => {
    if (y + needed > pageHeight - MARGIN - 30) {
      doc.addPage();
      y = MARGIN;
      return true;
    }
    return false;
  };

  // ── Horizontal rule ──
  const drawRule = (weight = 0.5) => {
    doc.setLineWidth(weight);
    doc.setDrawColor(...COLORS.rule);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 4;
  };

  // ════════════════════════════════════════════════════════════════════
  // PAGE 1: COVER PAGE — Professional event document
  // ════════════════════════════════════════════════════════════════════
  {
    const CX = pageWidth / 2;
    const navy = [35, 75, 140];
    const darkText = [26, 26, 26];
    const grayText = [85, 85, 85];
    const lightGray = [200, 200, 200];

    // Short accent line helper
    const accentLine = (len) => {
      doc.setDrawColor(...navy);
      doc.setLineWidth(1.5);
      doc.line(CX - len / 2, y, CX + len / 2, y);
      doc.setDrawColor(0);
    };

    // Subtle divider helper
    const subtleDivider = () => {
      doc.setDrawColor(...lightGray);
      doc.setLineWidth(0.4);
      doc.line(MARGIN + 100, y, pageWidth - MARGIN - 100, y);
      doc.setDrawColor(0);
    };

    // Section label helper
    const sectionLabel = (label) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...navy);
      // Spaced uppercase
      const spaced = label.toUpperCase().split('').join(' ');
      doc.text(spaced, CX, y, { align: 'center' });
      doc.setTextColor(...darkText);
    };

    // ── Thin accent stripe at very top ──
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 5, 'F');

    // ── Show Title — large, bold serif with character spacing ──
    y = 115;
    doc.setFont('times', 'bold');
    doc.setFontSize(46);
    doc.setTextColor(...darkText);
    doc.setCharSpace(1.5); // slight letter spacing
    const titleStr = `${showName} ${showNumber}`.trim();
    const titleLines = doc.splitTextToSize(titleStr, contentWidth - 60);
    titleLines.forEach((line) => {
      doc.text(line, CX, y, { align: 'center' });
      y += 52;
    });
    doc.setCharSpace(0);

    // ── Accent line under title — wider ──
    y += 4;
    accentLine(180);
    y += 24;

    // ── Date range ──
    if (dateRange) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(...grayText);
      doc.text(dateRange, CX, y, { align: 'center' });
      y += 20;
    }

    // ── Venue + address ──
    if (venue) {
      doc.setFontSize(12);
      doc.setTextColor(...grayText);
      doc.text(venue, CX, y, { align: 'center' });
      y += 16;
    }
    if (venueAddress && venueAddress !== venue) {
      doc.setFontSize(11);
      doc.setTextColor(110, 110, 110);
      doc.text(venueAddress, CX, y, { align: 'center' });
      y += 16;
    }

    // ── Divider ──
    y += 12;
    subtleDivider();
    y += 24;

    // ── "SHOW PACKET" — spaced uppercase, darker ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(10, 10, 10);
    doc.setCharSpace(3);
    doc.text('SHOW PACKET', CX, y, { align: 'center' });
    doc.setCharSpace(0);
    doc.setTextColor(...darkText);
    y += 30;

    // ── Table of Contents ──
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayText);

    const tocItems = [
      'Class Schedule',
      'Fees & Rules',
      'Stall / Shavings / RV Booking Form',
    ];

    tocItems.forEach((item, i) => {
      doc.text(`${i + 1}.  ${item}`, CX, y, { align: 'center' });
      y += 18;
    });

    // ── Divider ──
    y += 10;
    subtleDivider();
    y += 18;

    // ── Officials / Judges ──
    const officials = pd.officials || [];
    const judges = pd.associationJudges
      ? Object.values(pd.associationJudges).flat().filter((v, i, a) => a.indexOf(v) === i)
      : [];

    if (judges.length > 0 || officials.length > 0) {
      sectionLabel('Officials');
      y += 14;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...grayText);

      if (judges.length > 0) {
        doc.text(`Judges: ${judges.join(', ')}`, CX, y, { align: 'center', maxWidth: contentWidth - 80 });
        y += 14;
      }

      officials.forEach((off) => {
        if (off.name) {
          const role = off.role ? ` (${off.role})` : '';
          doc.text(`${off.name}${role}`, CX, y, { align: 'center' });
          y += 13;
        }
      });
      y += 8;
    }

    // ── Associations ──
    const selectedAssocs = Object.entries(pd.associations || {})
      .filter(([, v]) => v)
      .map(([id]) => {
        const assoc = (options.associationsData || []).find(a => a.id === id);
        return assoc?.abbreviation || assoc?.name || id;
      });

    if (selectedAssocs.length > 0) {
      y += 4;
      sectionLabel('Sanctioned By');
      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...grayText);
      doc.text(selectedAssocs.join('   \u2022   '), CX, y, { align: 'center' });
      y += 20;
    }

    // ── Sponsors — always vertical list ──
    const allCoverNames = new Set();
    (pd.sponsors || []).forEach(s => { if (s.name) allCoverNames.add(s.name); if (s.companyName) allCoverNames.add(s.companyName); });
    (pd.classSponsors || []).forEach(s => { if (s.sponsorName) allCoverNames.add(s.sponsorName); });
    (pd.arenaSponsors || []).forEach(s => { if (s.sponsorName) allCoverNames.add(s.sponsorName); });
    (pd.customSponsors || []).forEach(s => { if (s.name) allCoverNames.add(s.name); });

    const coverNames = Array.from(allCoverNames);
    if (coverNames.length > 0) {
      y += 8;
      subtleDivider();
      y += 20;

      sectionLabel('Sponsors');
      y += 16;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...grayText);

      // Always vertical centered list
      coverNames.forEach(name => {
        doc.text(name, CX, y, { align: 'center' });
        y += 16;
      });
    }

    // ── Bottom accent stripe ──
    doc.setFillColor(...navy);
    doc.rect(0, pageHeight - 5, pageWidth, 5, 'F');
  }

  // ════════════════════════════════════════════════════════════════════
  // SECTION 1: CLASS SCHEDULE PAGES — Print-ready B&W format
  // ════════════════════════════════════════════════════════════════════
  const showBill = pd.showBill;

  if (showBill && showBill.days && showBill.days.length > 0) {
    const sb = JSON.parse(JSON.stringify(showBill));
    const numberedBill = renumberShowBill(sb);
    const allClassItems = options.allClassItems || [];
    const associationsData = options.associationsData || [];

    // Association string: "- APHA" or "- APHA, AQHA"
    const getAssocTag = (classIds) => {
      const uniq = new Set();
      (classIds || []).forEach(cid => {
        const cls = allClassItems.find(c => c.divisionId === cid || c.id === cid);
        if (cls) {
          const a = associationsData.find(x => x.id === cls.assocId);
          uniq.add(a?.abbreviation || cls.assocId);
        }
      });
      return uniq.size > 0 ? `  - ${Array.from(uniq).join(', ')}` : '';
    };

    // --- Start schedule on new page ---
    doc.addPage();
    y = MARGIN;

    // ── Schedule header: show name, subtitle, date range, then line ──
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`${showName} ${showNumber}`.trim(), pageWidth / 2, y, { align: 'center' });
    y += 18;

    // Venue as subtitle
    if (venue) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(venue, pageWidth / 2, y, { align: 'center' });
      y += 14;
    }

    // Date range
    if (dateRange) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(dateRange, pageWidth / 2, y, { align: 'center' });
      y += 14;
    }

    // Horizontal rule
    doc.setLineWidth(1.5);
    doc.setDrawColor(0);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 14;

    // ── Render each day ──
    for (let di = 0; di < numberedBill.days.length; di++) {
      const day = numberedBill.days[di];

      // Check if enough room for day header + at least one class (~60pt)
      checkBreak(60);
      if (di > 0) y += 10; // spacer between days

      // ── DAY HEADER: boxed rectangle with text ──
      const dayLabel = day.label || formatDate(day.date) || 'Schedule';
      const boxH = 24;
      const boxInset = 80; // inset from margins on each side
      const boxL = MARGIN + boxInset;
      const boxW = contentWidth - boxInset * 2;

      doc.setFillColor(240, 240, 240);
      doc.setDrawColor(0);
      doc.setLineWidth(1);
      doc.rect(boxL, y, boxW, boxH, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(dayLabel, pageWidth / 2, y + boxH * 0.68, { align: 'center' });
      y += boxH + 14;

      // ── Arenas within this day ──
      for (const arena of day.arenas || []) {
        if ((numberedBill.closedArenas || {})[`${day.id}::${arena.id}`]) continue;

        // Arena header: centered bold, with line underneath
        checkBreak(36);
        const timeStr = arena.startTime ? ` \u2013 ${arena.startTime}` : '';
        const arenaLabel = `${arena.name}${timeStr}`;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(arenaLabel, pageWidth / 2, y, { align: 'center' });
        y += 5;
        doc.setLineWidth(0.5);
        doc.setDrawColor(0);
        doc.line(MARGIN + 60, y, pageWidth - MARGIN - 60, y);
        y += 12;

        // ── Items: classes, breaks, sections ──
        for (const item of arena.items || []) {

          // --- Section Header ---
          if (item.type === 'sectionHeader') {
            checkBreak(20);
            y += 4;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.text(item.title, pageWidth / 2, y, { align: 'center' });
            y += 4;
            doc.setLineWidth(0.3);
            doc.line(MARGIN + 100, y, pageWidth - MARGIN - 100, y);
            y += 8;
            continue;
          }

          // --- Break ---
          if (item.type === 'break') {
            checkBreak(14);
            doc.setFont('helvetica', 'bolditalic');
            doc.setFontSize(9);
            doc.setTextColor(0);
            const bTxt = item.duration ? `${item.title} \u2013 ${item.duration}` : item.title;
            doc.text(bTxt, pageWidth / 2, y, { align: 'center' });
            y += 12;
            continue;
          }

          // --- Drag ---
          if (item.type === 'drag') {
            checkBreak(14);
            doc.setFont('helvetica', 'bolditalic');
            doc.setFontSize(9);
            doc.setTextColor(0);
            doc.text(item.title, pageWidth / 2, y, { align: 'center' });
            y += 12;
            continue;
          }

          // --- Custom ---
          if (item.type === 'custom') {
            checkBreak(14);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(0);
            const cTxt = item.content ? `${item.title}: ${item.content}` : item.title;
            doc.text(cTxt, MARGIN + 8, y, { maxWidth: contentWidth - 16 });
            y += 12;
            continue;
          }

          // --- Class Box ---
          if (item.type === 'classBox') {
            const classDetails = (item.classes || [])
              .map(cid => allClassItems.find(c => c.divisionId === cid || c.id === cid))
              .filter(Boolean);
            const assocTag = getAssocTag(item.classes);

            if (classDetails.length <= 1) {
              checkBreak(13);
              doc.setFontSize(10);
              doc.setTextColor(0);

              // Number (bold)
              const numStr = item.number ? `${item.number}.` : '';
              if (numStr) {
                doc.setFont('helvetica', 'bold');
                doc.text(numStr, MARGIN, y);
              }

              // Title + association tag (normal)
              const titleText = item.title || classDetails[0]?.name || 'Untitled';
              doc.setFont('helvetica', 'normal');
              doc.text(`${titleText}${assocTag}`, MARGIN + 36, y, { maxWidth: contentWidth - 44 });
              y += 13;
            } else {
              // Grouped classes
              checkBreak(13 + classDetails.length * 11);
              doc.setFontSize(10);
              doc.setTextColor(0);

              const numStr = item.number ? `${item.number}.` : '';
              if (numStr) {
                doc.setFont('helvetica', 'bold');
                doc.text(numStr, MARGIN, y);
              }
              doc.setFont('helvetica', 'bold');
              doc.text(`${item.title || 'Grouped Classes'}${assocTag}`, MARGIN + 36, y);
              y += 13;

              doc.setFont('helvetica', 'normal');
              doc.setFontSize(9);
              classDetails.forEach(cls => {
                checkBreak(11);
                const a = associationsData.find(x => x.id === cls.assocId);
                const aTag = a ? `  - ${a.abbreviation}` : '';
                doc.text(`     ${cls.name}${aTag}`, MARGIN + 38, y);
                y += 11;
              });
              y += 2;
            }
          }
        }

        y += 4; // small gap after arena
      }
    }
  } else {
    // No show bill
    doc.addPage();
    y = MARGIN;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Class Schedule', pageWidth / 2, y, { align: 'center' });
    y += 24;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Schedule has not been built yet. Use the Schedule Builder to create the show schedule.', pageWidth / 2, y, { align: 'center', maxWidth: contentWidth - 40 });
  }

  // ════════════════════════════════════════════════════════════════════
  // SECTION 2: FEES & RULES PAGE
  // ════════════════════════════════════════════════════════════════════
  {
    doc.addPage();
    y = MARGIN;

    // Section header
    doc.setFillColor(...COLORS.primary);
    doc.rect(MARGIN, y, contentWidth, 32, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(FONT_SECTION);
    doc.setFont('helvetica', 'bold');
    doc.text('Fees & Rules', MARGIN + 12, y + 22);
    doc.setTextColor(...COLORS.black);
    y += 44;

    // Show info
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.text(`${showName} ${showNumber}`.trim(), MARGIN, y);
    doc.text(dateRange, pageWidth - MARGIN, y, { align: 'right' });
    y += 16;
    drawRule(0.75);
    y += 8;

    // Collect fees from multiple sources
    const standardFees = pd.standardFees || [];
    const customFees = pd.fees || [];
    const allFees = [...standardFees, ...customFees].filter(f => f.name && f.amount);

    // Group by payment timing
    const timingGroups = {
      pre_entry: { label: 'Pre-Entry / Reservation Fees', fees: [] },
      at_check_in: { label: 'At Check-In Fees', fees: [] },
      settlement: { label: 'Post-Show / Settlement Fees', fees: [] },
      custom_timing: { label: 'Other Fees', fees: [] },
    };

    allFees.forEach(fee => {
      const timing = fee.payment_timing || 'custom_timing';
      if (timingGroups[timing]) {
        timingGroups[timing].fees.push(fee);
      } else {
        timingGroups.custom_timing.fees.push(fee);
      }
    });

    // If no structured fees, show simple fee list
    const hasStructuredFees = allFees.length > 0;

    if (hasStructuredFees) {
      Object.values(timingGroups).forEach(group => {
        if (group.fees.length === 0) return;

        checkBreak(60);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.primary);
        doc.text(group.label, MARGIN, y);
        y += 6;
        doc.setLineWidth(0.75);
        doc.setDrawColor(...COLORS.primary);
        doc.line(MARGIN, y, MARGIN + 180, y);
        doc.setDrawColor(...COLORS.rule);
        y += 12;

        // Fee table using autoTable
        const tableBody = group.fees.map(fee => {
          const suffix = getUnitSuffix(fee);
          const amountStr = `$${Number(fee.amount).toFixed(2)}${suffix ? ' ' + suffix : ''}`;
          const assoc = fee.association_specific || 'All';
          const notes = fee.notes || '';
          return [fee.name, amountStr, assoc, notes];
        });

        doc.autoTable({
          startY: y,
          margin: { left: MARGIN, right: MARGIN },
          head: [['Fee', 'Amount', 'Applies To', 'Notes']],
          body: tableBody,
          styles: {
            fontSize: 9,
            cellPadding: 5,
            lineColor: [220, 220, 220],
            lineWidth: 0.25,
          },
          headStyles: {
            fillColor: COLORS.tableHeader,
            textColor: COLORS.white,
            fontStyle: 'bold',
            fontSize: 9,
          },
          alternateRowStyles: {
            fillColor: COLORS.tableStripe,
          },
          columnStyles: {
            0: { cellWidth: 160 },
            1: { cellWidth: 90, halign: 'right' },
            2: { cellWidth: 70 },
            3: { cellWidth: 'auto' },
          },
        });

        y = doc.lastAutoTable.finalY + 16;
      });
    } else if (customFees.length > 0) {
      // Simple fee list (legacy formData.fees format)
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.primary);
      doc.text('Entry Fees', MARGIN, y);
      y += 18;

      const tableBody = customFees
        .filter(f => f.name && f.amount)
        .map(f => [f.name, `$${Number(f.amount).toFixed(2)}`]);

      if (tableBody.length > 0) {
        doc.autoTable({
          startY: y,
          margin: { left: MARGIN, right: MARGIN },
          head: [['Fee', 'Amount']],
          body: tableBody,
          styles: { fontSize: 10, cellPadding: 6 },
          headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: COLORS.tableStripe },
        });
        y = doc.lastAutoTable.finalY + 16;
      }
    } else {
      doc.setFontSize(FONT_BODY);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...COLORS.muted);
      doc.text('Fee information has not been configured yet.', MARGIN, y);
      y += LINE_H * 2;
    }

    // ── Rules / Additional Information ──
    checkBreak(60);
    doc.setTextColor(...COLORS.black);
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Important Information', MARGIN, y);
    y += 6;
    doc.setLineWidth(0.75);
    doc.setDrawColor(...COLORS.primary);
    doc.line(MARGIN, y, MARGIN + 180, y);
    doc.setDrawColor(...COLORS.rule);
    y += 14;

    doc.setFontSize(FONT_BODY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.secondary);

    const rules = [];

    // Payment methods
    rules.push('• Visa, MasterCard, and American Express accepted.');
    rules.push('• Personal checks accepted — $50 NSF fee for returned checks.');

    // Stall info from fees
    const stallFee = allFees.find(f => f.standard_id === 'stall_fee' || f.name?.toLowerCase().includes('stall'));
    if (stallFee) {
      rules.push(`• Stalls: $${Number(stallFee.amount).toFixed(2)} ${getUnitSuffix(stallFee) || 'each'}. ${stallFee.notes || ''}`);
    }

    // Shavings
    const shavingsFee = allFees.find(f => f.standard_id === 'shavings_fee' || f.name?.toLowerCase().includes('shaving'));
    if (shavingsFee) {
      rules.push(`• Shavings: $${Number(shavingsFee.amount).toFixed(2)} ${getUnitSuffix(shavingsFee) || 'per bag'}. No outside shavings permitted.`);
    }

    // Late fee
    const lateFee = allFees.find(f => f.standard_id === 'late_entry_fee');
    if (lateFee) {
      rules.push(`• Late entries: $${Number(lateFee.amount).toFixed(2)} surcharge after pre-entry deadline.`);
    }

    // Generic rules
    rules.push('• All exhibitors must provide proof of current health certificates and Coggins tests.');
    rules.push('• Management reserves the right to refuse entry or remove any exhibitor for cause.');

    rules.forEach(rule => {
      checkBreak(LINE_H);
      const lines = doc.splitTextToSize(rule, contentWidth - 20);
      lines.forEach(line => {
        doc.text(line, MARGIN + 8, y);
        y += LINE_H;
      });
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // SECTION 3: STALL / SHAVINGS / RV BOOKING FORM
  // ════════════════════════════════════════════════════════════════════
  {
    doc.addPage();

    // Page geometry — letter size = 612 x 792 pt
    const L  = 50;                          // left margin
    const R  = pageWidth - 50;              // right margin
    const W  = R - L;                       // usable width
    const CX = pageWidth / 2;              // centre X

    // We lay out top-down and track y. The reference fills the full page
    // with ~35pt top margin and ~30pt bottom margin.
    y = 38;

    // ────────────────────────────────────────────────────────────
    // UTILITY FUNCTIONS
    // ────────────────────────────────────────────────────────────

    /** Draw label + underline extending to endX on current y */
    const ff = (label, x, endX) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(label, x, y);
      const tw = doc.getTextWidth(label) + 2;
      doc.setLineWidth(0.4);
      doc.setDrawColor(0);
      doc.line(x + tw, y + 2, endX, y + 2);
    };

    /** Centered text */
    const cText = (txt, opts = {}) => {
      doc.setFont('helvetica', opts.bold ? 'bold' : (opts.italic ? 'italic' : 'normal'));
      doc.setFontSize(opts.size || 10);
      doc.setTextColor(...(opts.color || [0, 0, 0]));
      doc.text(txt, CX, y, { align: 'center', maxWidth: W });
    };

    /** Left-aligned text */
    const lText = (txt, x, opts = {}) => {
      doc.setFont('helvetica', opts.bold ? 'bold' : (opts.italic ? 'italic' : 'normal'));
      doc.setFontSize(opts.size || 9);
      doc.setTextColor(...(opts.color || [0, 0, 0]));
      doc.text(txt, x, y, { maxWidth: R - x });
    };

    // Collect all fees once
    const allFeesList = [...(pd.standardFees || []), ...(pd.fees || [])];
    const stallF  = allFeesList.find(f => f.standard_id === 'stall_fee'    || (f.name && f.name.toLowerCase().includes('stall')));
    const shavF   = allFeesList.find(f => f.standard_id === 'shavings_fee' || (f.name && f.name.toLowerCase().includes('shaving')));
    const rvF     = allFeesList.find(f => f.standard_id === 'rv_fee'       || (f.name && f.name.toLowerCase().includes('rv')));
    const sAmt  = stallF ? Number(stallF.amount).toFixed(0)  : '___';
    const shAmt = shavF  ? Number(shavF.amount).toFixed(2)   : '___';
    const rv30  = rvF    ? `$${Number(rvF.amount).toFixed(0)}` : '$___';
    const rv50  = rvF    ? `$${(Number(rvF.amount) + 15).toFixed(0)}` : '$___';

    // ────────────────────────────────────────────────────────────
    // TITLE
    // ────────────────────────────────────────────────────────────
    doc.setFont('times', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(0);
    doc.text('Stall/Shavings/RV Form', CX, y, { align: 'center' });
    y += 36;

    // ────────────────────────────────────────────────────────────
    // MAIL-TO BLOCK
    // ────────────────────────────────────────────────────────────
    cText('Mail this form to & check payable to:', { bold: true, size: 11 });
    y += 18;
    if (venue) {
      cText(venue, { bold: true, size: 11 });
      y += 16;
    }
    if (venueAddress && venueAddress !== venue) {
      cText(venueAddress, { size: 10 });
      y += 15;
    }
    // Phone / email
    const cp = [];
    if (pd.contactPhone) cp.push(pd.contactPhone);
    if (pd.contactEmail) cp.push(pd.contactEmail);
    if (cp.length > 0) {
      cText(cp.join('     '), { size: 10 });
      y += 15;
    }
    // Italic confirmation line
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(9);
    doc.setTextColor(0, 100, 0);
    doc.text('Email confirmations will be sent upon receipt AND when payment is processed.', CX, y, { align: 'center' });
    doc.setTextColor(0);
    y += 30;

    // ────────────────────────────────────────────────────────────
    // CONTACT FIELDS — 5 rows
    // ────────────────────────────────────────────────────────────
    const rh = 28;  // generous row height for form fields

    // Name __________________________________ Date ___________
    ff('Name', L, L + W * 0.72);
    ff('Date', L + W * 0.76, R);
    y += rh;

    // Address _______________________________ City ___________
    ff('Address', L, L + W * 0.72);
    ff('City', L + W * 0.76, R);
    y += rh;

    // State _________ Zip _________ Cell Phone ________________
    ff('State', L, L + W * 0.22);
    ff('Zip', L + W * 0.25, L + W * 0.44);
    ff('Cell Phone', L + W * 0.48, R);
    y += rh;

    // Do you accept text: Y  N     Email (please print clearly) ___
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text('Do you except text:  Y   N', L, y);
    ff('Email (please print clearly)', L + W * 0.32, R);
    y += rh;

    // Trainer/Stalling With: ___________________________________
    ff('Trainer/Stalling With:', L, R);
    y += 38;

    // ────────────────────────────────────────────────────────────
    // STALLS
    // ────────────────────────────────────────────────────────────
    doc.setFont('times', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(0);
    doc.text('Stalls', CX, y, { align: 'center' });
    y += 24;

    // Total # of stalls needed____ X $130 each stall = _________ ($130 pre-paid by ...)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Total # of stalls needed', L, y);
    doc.setLineWidth(0.4);
    doc.setDrawColor(0);
    doc.line(L + 138, y + 2, L + 168, y + 2);
    doc.text(`X  $${sAmt}  each stall  =`, L + 172, y);
    doc.line(L + 292, y + 2, L + 362, y + 2);
    if (stallF?.due_date) {
      doc.setFontSize(9);
      doc.text(`($${sAmt} pre-paid by ${formatDateShort(stallF.due_date)}.)`, L + 366, y);
    }
    y += 18;

    // Detail lines: late price, refund policy, stalls limited
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (stallF?.late_fee_amount && Number(stallF.late_fee_amount) > 0) {
      const lateP = Number(sAmt) + Number(stallF.late_fee_amount);
      doc.text(`Each stall is $${lateP} after deadline. No refunds on stalls after deadline. Stalls are limited. All stalls will be unlocked upon arrival and`, L, y, { maxWidth: W });
      y += 12;
      doc.text('receipt of payment.', L, y);
      y += 28;
    } else {
      doc.text('Stalls are limited. All stalls will be unlocked upon arrival and receipt of payment.', L, y);
      y += 32;
    }

    // ────────────────────────────────────────────────────────────
    // SHAVINGS
    // ────────────────────────────────────────────────────────────
    doc.setFont('times', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(0);
    doc.text('Shavings', CX, y, { align: 'center' });
    y += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (shavF?.due_date) {
      doc.text(
        `ALL shavings PRE-PAID by ${formatDateShort(shavF.due_date)} will receive a $1.00/bag discount and will include pre-delivery, free of charge. Save money`,
        L, y, { maxWidth: W }
      );
      y += 12;
      doc.text('& pre-order! NO outside shavings permitted.', L, y);
      y += 20;
    } else {
      doc.text('NO outside shavings permitted. Pre-order to save money & get free delivery.', L, y);
      y += 20;
    }

    // Total # of shavings needed _____ X $8.00/bag = _________ ($9/bag AT the show.)
    doc.setFontSize(10);
    doc.text('Total # of shavings needed', L, y);
    doc.line(L + 155, y + 2, L + 190, y + 2);
    doc.text(`X  $${shAmt}/bag  =`, L + 194, y);
    doc.line(L + 288, y + 2, L + 358, y + 2);
    if (shavF?.late_fee_amount && Number(shavF.late_fee_amount) > 0) {
      const atShow = (Number(shavF.amount) + Number(shavF.late_fee_amount)).toFixed(2);
      doc.setFontSize(9);
      doc.text(`($${atShow}/bag AT the show.)`, L + 362, y);
    }
    y += 38;

    // ────────────────────────────────────────────────────────────
    // RV HOOKUPS
    // ────────────────────────────────────────────────────────────
    doc.setFont('times', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(0);
    doc.text('RV Hookups', CX, y, { align: 'center' });
    y += 22;

    // Two-part row at 8.5pt so it fits
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    doc.text('Total # of 30 amp hook-ups needed', L, y);
    doc.line(L + 173, y + 2, L + 198, y + 2);
    doc.text(`X ${rv30}/night`, L + 202, y);

    const c2x = CX + 10;
    doc.text('Total # of 50 amp hook-up needed', c2x, y);
    doc.line(c2x + 168, y + 2, c2x + 193, y + 2);
    doc.text(`X ${rv50}/night`, c2x + 197, y);
    y += 16;

    // Please NOTE – each hook-up is ELECTRIC only ...
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const nPre = 'Please NOTE \u2013 each hook-up is ';
    doc.text(nPre, L, y);
    const bX = L + doc.getTextWidth(nPre);
    doc.setFont('helvetica', 'bold');
    doc.text('ELECTRIC', bX, y);
    doc.setFont('helvetica', 'normal');
    const bX2 = bX + doc.getTextWidth('ELECTRIC');
    doc.text(' only and will be billed to your show tab. Showers are available on the grounds.', bX2, y);
    y += 36;

    // ────────────────────────────────────────────────────────────
    // PAYMENT SECTION
    // ────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0);
    doc.text(
      'Visa/Master Card & American Express Accepted \u2013 4% service charge will be applied to any credit card order.',
      CX, y, { align: 'center', maxWidth: W - 10 }
    );
    y += 24;

    // CC# ______________________________ expiration __________ Security code ______
    ff('CC#', L, L + W * 0.56);
    ff('expiration', L + W * 0.59, L + W * 0.78);
    ff('Security code', L + W * 0.81, R);
    y += rh;

    // Name on Card ______________________________ cell phone ______________
    ff('Name on Card', L, L + W * 0.60);
    ff('cell phone', L + W * 0.64, R);
    y += rh;

    // Zip code to billing address of cc ____________ total to be chg'd $ __________
    ff('Zip code to billing address of cc', L, L + W * 0.50);
    ff('total to be chg\'d  $', L + W * 0.54, R);
    y += rh;

    // Paid by Check # ________________ Amount of Check $ ________________
    ff('Paid by Check #', L, L + W * 0.38);
    ff('Amount of Check $', L + W * 0.44, R);
    y += 32;

    // ────────────────────────────────────────────────────────────
    // DEADLINE NOTE (red, bold, centered)
    // ────────────────────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 0, 0);

    let dlNote = 'NOTE \u2013 two weeks prior to the show';
    if (pd.startDate) dlNote += ` \u2013 ${formatDateShort(pd.startDate)}`;
    dlNote += ' - ALL stall/shavings checks or credit cards will be processed. No refunds after deadline.';

    const dlLines = doc.splitTextToSize(dlNote, W - 20);
    dlLines.forEach(line => {
      doc.text(line, CX, y, { align: 'center' });
      y += 12;
    });
    doc.setTextColor(0);
  }

  // ════════════════════════════════════════════════════════════════════
  // ADD PAGE FOOTERS TO ALL PAGES
  // ════════════════════════════════════════════════════════════════════
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i);
  }

  // ── Save ──
  const filename = `${(showName || 'Show-Packet').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Packet.pdf`;
  doc.save(filename);
}
