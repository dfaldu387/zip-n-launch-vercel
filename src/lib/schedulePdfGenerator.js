import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Time like "07:30" -> "7:30" (afternoon keeps PM), matching the calendar cells.
const fmt = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? ' PM' : ''}`;
};

const dayHead = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })}\n${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
};

/**
 * Printable Arena & Staff calendar.
 *
 * @param {object} options
 * @param {string} options.showName
 * @param {string[]} options.columns - ISO dates, one column each
 * @param {Array} options.groups - [{ name, rows: [{ label, cells: [{ name, report, start } | null | 'x' | '-'] }] }]
 */
export function generateSchedulePdf({ showName, columns, groups }) {
  const doc = new jsPDF('l', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 28;
  let y = margin;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Arena & Staff Calendar', margin, y + 6);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(showName || '', pageWidth - margin, y + 6, { align: 'right' });
  y += 22;

  for (const g of groups) {
    const body = g.rows.map(r => [
      r.label,
      ...r.cells.map(c => {
        if (c === 'x') return 'Not needed';
        if (c === '-' || c === undefined) return '—';
        if (!c) return '+ Unassigned';
        const times = [c.report && `Rpt ${fmt(c.report)}`, c.start && `Start ${fmt(c.start)}`].filter(Boolean).join(' | ');
        return times ? `${c.name}\n${times}` : c.name;
      }),
    ]);
    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [[{ content: g.name, colSpan: columns.length + 1, styles: { halign: 'left', fillColor: [124, 58, 237] } }],
        ['Position / Personnel', ...columns.map(dayHead)]],
      body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, halign: 'center', valign: 'middle', lineColor: [221, 214, 254] },
      headStyles: { fillColor: [237, 233, 254], textColor: [40, 30, 90] },
      columnStyles: { 0: { halign: 'left', cellWidth: 110, fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          const v = String(data.cell.raw);
          if (v === '+ Unassigned') data.cell.styles.textColor = [150, 150, 150];
          else if (v !== '—' && v !== 'Not needed') data.cell.styles.fillColor = [245, 243, 255];
          else data.cell.styles.textColor = [170, 170, 170];
        }
      },
    });
    y = doc.lastAutoTable.finalY + 14;
  }

  doc.save(`${(showName || 'show').replace(/[^a-z0-9]+/gi, '-')}-staff-calendar.pdf`);
}
