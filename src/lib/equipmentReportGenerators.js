import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Re-export the existing arena kit list generator
export { generateArenaKitListPdf } from './arenaKitListPdfGenerator';

/**
 * Shared PDF helpers
 */
function createDoc() {
  return new jsPDF('p', 'pt', 'letter');
}

function addHeader(doc, title, subtitle, y = 36) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 28;

  if (subtitle) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
    y += 20;
  }

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(new Date().toLocaleDateString(), pageWidth / 2, y, { align: 'center' });
  y += 14;

  const margin = 36;
  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  doc.setTextColor(0);
  return y;
}

function addFooter(doc, showName) {
  const totalPages = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
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
}

/**
 * Generate Daily Equipment Summary PDF.
 *
 * @param {object} options
 * @param {string} options.showName
 * @param {Array}  options.items - [{ name, category, unit_type, total_qty_owned, planned, checkedIn, checkedOut, available }]
 */
export function generateDailyEquipmentSummaryPdf({ showName, items }) {
  const doc = createDoc();
  const margin = 36;
  let y = addHeader(doc, 'Daily Equipment Summary', showName);

  // Group by category
  const categories = {};
  for (const item of items) {
    const cat = item.category || 'General';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  }

  for (const [category, catItems] of Object.entries(categories).sort(([a], [b]) => a.localeCompare(b))) {
    // Category section header
    if (y + 40 > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(category, margin, y);
    y += 6;

    const rows = catItems.map(item => [
      item.name,
      String(item.total_qty_owned || 0),
      String(item.planned || 0),
      String(item.checkedIn || 0),
      String(item.checkedOut || 0),
      String(item.available ?? (item.total_qty_owned || 0) - (item.checkedOut || 0)),
      item.unit_type || 'each',
    ]);

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Equipment', 'Owned', 'Planned', 'In', 'Out', 'Available', 'Unit']],
      body: rows,
      styles: { fontSize: 9, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.5 },
      headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 50, halign: 'center' },
        2: { cellWidth: 50, halign: 'center' },
        3: { cellWidth: 40, halign: 'center' },
        4: { cellWidth: 40, halign: 'center' },
        5: { cellWidth: 55, halign: 'center', fontStyle: 'bold' },
        6: { cellWidth: 45, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const val = parseInt(data.cell.raw, 10);
          if (val <= 0) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    y = doc.lastAutoTable.finalY + 16;
  }

  // Totals
  const totalOwned = items.reduce((s, i) => s + (i.total_qty_owned || 0), 0);
  const totalPlanned = items.reduce((s, i) => s + (i.planned || 0), 0);

  if (y + 30 > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${items.length} items | ${totalOwned} owned | ${totalPlanned} planned`, margin, y);

  addFooter(doc, showName);
  doc.save(`${showName.replace(/[^a-zA-Z0-9]/g, '_')}_Daily_Summary.pdf`);
}

/**
 * Generate Shortage Report PDF.
 *
 * @param {object} options
 * @param {string} options.showName
 * @param {Array}  options.shortages - [{ name, category, required, owned, shortage }]
 */
export function generateShortageReportPdf({ showName, shortages }) {
  const doc = createDoc();
  const margin = 36;
  let y = addHeader(doc, 'Shortage Report', showName);

  if (shortages.length === 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(22, 163, 74);
    doc.text('No shortages detected. All equipment needs are covered.', doc.internal.pageSize.getWidth() / 2, y + 30, { align: 'center' });
  } else {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`${shortages.length} Shortage${shortages.length !== 1 ? 's' : ''} Detected`, margin, y);
    y += 14;
    doc.setTextColor(0);

    const rows = shortages.map(item => [
      item.name,
      item.category || '',
      String(item.required || 0),
      String(item.owned || 0),
      String(item.shortage || 0),
    ]);

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Equipment', 'Category', 'Required', 'Owned', 'Shortage']],
      body: rows,
      styles: { fontSize: 9, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.5 },
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 100 },
        2: { cellWidth: 65, halign: 'center' },
        3: { cellWidth: 65, halign: 'center' },
        4: { cellWidth: 65, halign: 'center', fontStyle: 'bold', textColor: [220, 38, 38] },
      },
    });
  }

  addFooter(doc, showName);
  doc.save(`${showName.replace(/[^a-zA-Z0-9]/g, '_')}_Shortage_Report.pdf`);
}

/**
 * Generate Distribution by Location PDF.
 *
 * @param {object} options
 * @param {string} options.showName
 * @param {Array}  options.arenas - [{ name, type, items: [{ name, category, planned_qty, unit_type }] }]
 */
export function generateDistributionByLocationPdf({ showName, arenas }) {
  const doc = createDoc();
  const margin = 36;
  let y = addHeader(doc, 'Distribution by Location', showName);

  for (const arena of arenas) {
    if (y + 50 > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const arenaLabel = arena.type ? `${arena.name} (${arena.type})` : arena.name;
    doc.text(arenaLabel, margin, y);
    y += 6;

    if (arena.items.length === 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('No equipment assigned', margin + 10, y + 10);
      y += 24;
      continue;
    }

    const rows = arena.items.map(item => [
      item.name,
      item.category || '',
      String(item.planned_qty || 0),
      item.unit_type || 'each',
    ]);

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Equipment', 'Category', 'Planned Qty', 'Unit']],
      body: rows,
      styles: { fontSize: 9, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.5 },
      headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 100 },
        2: { cellWidth: 70, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 50, halign: 'center' },
      },
    });

    y = doc.lastAutoTable.finalY + 20;
  }

  // Summary
  const totalItems = arenas.reduce((s, a) => s + a.items.length, 0);
  const totalQty = arenas.reduce((s, a) => s + a.items.reduce((q, i) => q + (i.planned_qty || 0), 0), 0);

  if (y + 30 > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${arenas.length} locations | ${totalItems} assignments | ${totalQty} total items`, margin, y);

  addFooter(doc, showName);
  doc.save(`${showName.replace(/[^a-zA-Z0-9]/g, '_')}_Distribution_By_Location.pdf`);
}
