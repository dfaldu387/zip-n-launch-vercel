import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatCell, countLabel } from '@/lib/employeeReports';

// PDF and Excel read the same rows the Preview shows (runReport's result), so a number can never
// differ between the screen, the print-out and the spreadsheet.

const safeName = (s) => (s || 'Untitled').replace(/[^a-zA-Z0-9 ]/g, '').trim();
const stamp = (d) => d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

// The cells of one table: a header row, the data rows and (when the report has one) a totals row.
function tableOf(result) {
  const { report, rows, totals } = result;
  const head = report.columns.map((c) => c.label);
  const body = rows.map((r) => report.columns.map((c) => formatCell(r[c.key], c.type)));
  if (totals) body.push(report.columns.map((c, i) => (i === 0 ? 'Total' : c.sum ? formatCell(totals[c.key], c.type) : '')));
  return { head, body };
}

export function exportReportToExcel({ result, showName, pulledAt = new Date() }) {
  const { report, rows, totals } = result;
  if (!rows || rows.length === 0) return false;

  // Numbers stay numbers in the sheet so they can be summed; empty cells stay empty.
  const toRow = (r) => Object.fromEntries(report.columns.map((c) => [c.label, r[c.key] ?? '']));
  const data = rows.map(toRow);
  if (totals) data.push(Object.fromEntries(report.columns.map((c, i) => [c.label, i === 0 ? 'Total' : c.sum ? totals[c.key] ?? '' : ''])));

  const ws = XLSX.utils.json_to_sheet(data, { header: report.columns.map((c) => c.label) });
  ws['!cols'] = report.columns.map((c) => ({ wch: Math.max(c.label.length + 2, c.type === 'money' ? 14 : 16) }));
  XLSX.utils.sheet_add_aoa(ws, [[`${report.title} - ${showName || ''}`, `Pulled on ${stamp(pulledAt)}`]], { origin: -1 });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, report.title.slice(0, 31));
  XLSX.writeFile(wb, `${safeName(showName)} - ${safeName(report.title)}.xlsx`);
  return true;
}

export function exportReportToPdf({ result, showName, pulledAt = new Date() }) {
  const { report, rows } = result;
  if (!rows || rows.length === 0) return false;

  const doc = new jsPDF('l', 'pt', 'letter');
  const margin = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(report.title, margin, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(showName || '', margin, 60);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Pulled on ${stamp(pulledAt)} · ${countLabel(report, result.count)}`, margin, 74);
  doc.setTextColor(0);

  const { head, body } = tableOf(result);
  const lastIsTotal = !!result.totals;
  const moneyCols = Object.fromEntries(report.columns.map((c, i) => [i, c.type === 'money' || c.type === 'count' ? { halign: 'right' } : {}]));
  doc.autoTable({
    startY: 86,
    margin: { left: margin, right: margin },
    head: [head],
    body,
    styles: { fontSize: 9, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.5 },
    headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: moneyCols,
    didParseCell: (d) => {
      if (lastIsTotal && d.section === 'body' && d.row.index === body.length - 1) d.cell.styles.fontStyle = 'bold';
    },
  });

  const pages = doc.internal.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(showName || '', margin, h - 20);
    doc.text(`Page ${i} of ${pages}`, w / 2, h - 20, { align: 'center' });
    doc.text(stamp(pulledAt), w - margin, h - 20, { align: 'right' });
  }

  doc.save(`${safeName(showName)} - ${safeName(report.title)}.pdf`);
  return true;
}
