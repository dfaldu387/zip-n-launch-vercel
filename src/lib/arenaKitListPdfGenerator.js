import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate a printable Arena Kit List PDF.
 *
 * @param {object} options
 * @param {string} options.showName
 * @param {string} options.arenaName
 * @param {string} [options.arenaType]
 * @param {Array}  options.items - [{ name, category, unit_type, planned_qty, owned, checkedIn }]
 * @param {Array}  [options.setupNotes] - [{ className, notes }]
 * @param {string} [options.dateLabel] - e.g. "Feb 20–22, 2026"
 */
export function generateArenaKitListPdf({
  showName,
  arenaName,
  arenaType,
  items,
  setupNotes = [],
  dateLabel = '',
}) {
  const doc = new jsPDF('p', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ---- Header ----
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Arena Kit List', pageWidth / 2, y, { align: 'center' });
  y += 28;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(showName, pageWidth / 2, y, { align: 'center' });
  y += 20;

  doc.setFontSize(12);
  const arenaLabel = arenaType ? `${arenaName} (${arenaType})` : arenaName;
  doc.text(arenaLabel, pageWidth / 2, y, { align: 'center' });
  y += 16;

  if (dateLabel) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(dateLabel, pageWidth / 2, y, { align: 'center' });
    y += 14;
  }

  // Separator
  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  // ---- Equipment Checklist Table ----
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Equipment Checklist', margin, y);
  y += 6;

  // Determine shortages
  const tableRows = items.map(item => {
    const planned = item.planned_qty || 0;
    const owned = item.owned ?? '-';
    const checkedIn = item.checkedIn ?? '-';
    const shortage = typeof item.owned === 'number' && planned > item.owned
      ? planned - item.owned
      : 0;
    return [
      '☐',
      item.name || 'Unknown',
      item.category || '',
      String(planned),
      item.unit_type || 'each',
      typeof owned === 'number' ? String(owned) : owned,
      typeof checkedIn === 'number' ? String(checkedIn) : checkedIn,
      shortage > 0 ? `SHORT ${shortage}` : 'OK',
    ];
  });

  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [['✓', 'Equipment', 'Category', 'Qty Needed', 'Unit', 'Owned', 'Checked In', 'Status']],
    body: tableRows,
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [200, 200, 200],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [50, 50, 50],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center', fontSize: 12 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 80 },
      3: { cellWidth: 55, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 40, halign: 'center' },
      5: { cellWidth: 45, halign: 'center' },
      6: { cellWidth: 55, halign: 'center' },
      7: { cellWidth: 55, halign: 'center' },
    },
    didParseCell: (data) => {
      // Highlight shortage rows
      if (data.section === 'body' && data.column.index === 7) {
        const val = data.cell.raw;
        if (typeof val === 'string' && val.startsWith('SHORT')) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'OK') {
          data.cell.styles.textColor = [22, 163, 74];
        }
      }
    },
  });

  y = doc.lastAutoTable.finalY + 20;

  // ---- Setup Notes Section ----
  const activeNotes = setupNotes.filter(n => n.notes);
  if (activeNotes.length > 0) {
    // Check page break
    if (y + 60 > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Setup Notes', margin, y);
    y += 14;

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Class / Template', 'Notes']],
      body: activeNotes.map(n => [n.className || 'General', n.notes]),
      styles: {
        fontSize: 9,
        cellPadding: 4,
        lineColor: [200, 200, 200],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [50, 50, 50],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 140, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
      },
    });

    y = doc.lastAutoTable.finalY + 20;
  }

  // ---- Shortage Warnings Section ----
  const shortages = items.filter(item =>
    typeof item.owned === 'number' && (item.planned_qty || 0) > item.owned
  );

  if (shortages.length > 0) {
    if (y + 60 > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`⚠ Shortage Warnings (${shortages.length})`, margin, y);
    y += 14;

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Equipment', 'Needed', 'Owned', 'Shortage']],
      body: shortages.map(item => [
        item.name,
        String(item.planned_qty || 0),
        String(item.owned ?? 0),
        String((item.planned_qty || 0) - (item.owned ?? 0)),
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 4,
        lineColor: [200, 200, 200],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [220, 38, 38],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 70, halign: 'center' },
        2: { cellWidth: 70, halign: 'center' },
        3: { cellWidth: 70, halign: 'center', fontStyle: 'bold', textColor: [220, 38, 38] },
      },
    });

    y = doc.lastAutoTable.finalY + 20;
  }

  // ---- Footer on all pages ----
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(showName, margin, pageH - 20);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageH - 20, { align: 'center' });
    doc.text(new Date().toLocaleDateString(), pageWidth - margin, pageH - 20, { align: 'right' });
  }

  // ---- Save ----
  const safeName = `${arenaName.replace(/[^a-zA-Z0-9]/g, '_')}_Kit_List`;
  doc.save(`${safeName}.pdf`);
}
