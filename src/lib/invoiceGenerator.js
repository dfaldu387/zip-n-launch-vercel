// Invoice PDF generator — uses jsPDF + jspdf-autotable.
// Pure: takes booking + show data, returns/downloads a PDF. No DB calls.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { buildLineItems, computeBookingTotal } from '@/lib/bookingPricing';

const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const safeDate = (iso, fmt = 'MMM d, yyyy') => {
    if (!iso) return '';
    try { return format(parseISO(iso), fmt); } catch { return String(iso).slice(0, 10); }
};

// Brand color (Tailwind primary blue)
const PRIMARY = [37, 99, 235];   // rgb(37, 99, 235)
const MUTED   = [100, 116, 139]; // slate-500
const DANGER  = [220, 38, 38];   // red-600
const SUCCESS = [16, 185, 129];  // emerald-500

const STATUS_BADGE = {
    pending:     { label: 'UNPAID',       color: [245, 158, 11] }, // amber
    confirmed:   { label: 'UNPAID',       color: [245, 158, 11] },
    checked_in:  { label: 'AT SHOW',      color: SUCCESS },
    checked_out: { label: 'COMPLETED',    color: MUTED },
    cancelled:   { label: 'CANCELLED',    color: DANGER },
};

const PAY_BADGE = {
    paid:     { label: 'PAID',        color: SUCCESS },
    partial:  { label: 'PARTIAL',     color: [245, 158, 11] },
    unpaid:   { label: 'UNPAID',      color: DANGER },
    refunded: { label: 'REFUNDED',    color: MUTED },
};

// ───── Helpers ─────

function drawHeader(doc, { brandName, invoiceNumber, issuedAt, dueAt }) {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...PRIMARY);
    doc.text(brandName || 'EquiPatterns', 40, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text('Horse Show Reservation Invoice', 40, 68);

    // Right-aligned invoice meta
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('INVOICE', pageWidth - 40, 50, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(`# ${invoiceNumber}`, pageWidth - 40, 65, { align: 'right' });
    doc.text(`Issued: ${safeDate(issuedAt)}`, pageWidth - 40, 80, { align: 'right' });
    if (dueAt) doc.text(`Due: ${safeDate(dueAt)}`, pageWidth - 40, 94, { align: 'right' });

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(40, 108, pageWidth - 40, 108);
}

function drawStatusBadge(doc, x, y, status, paymentStatus) {
    const payMeta = PAY_BADGE[paymentStatus] || null;
    const statusMeta = STATUS_BADGE[status] || null;
    const meta = payMeta || statusMeta || { label: (status || 'pending').toUpperCase(), color: MUTED };

    doc.setFillColor(...meta.color);
    const labelW = doc.getTextWidth(meta.label) + 16;
    doc.roundedRect(x, y - 11, labelW, 16, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(meta.label, x + 8, y);
}

function drawShowAndBillTo(doc, { show, booking }) {
    const startY = 130;
    const colGap = 280;

    // Show info column
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('SHOW', 40, startY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(show?.name || 'Untitled Show', 40, startY + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);

    let row = startY + 32;
    if (show?.startDate || show?.endDate) {
        doc.text(`${safeDate(show?.startDate)} – ${safeDate(show?.endDate)}`, 40, row);
        row += 14;
    }
    if (show?.venueFacility) {
        doc.text(show.venueFacility, 40, row);
        row += 14;
    }

    // Bill-to column
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('BILL TO', 40 + colGap, startY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(booking.exhibitorName || 'Exhibitor', 40 + colGap, startY + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    let billRow = startY + 32;
    if (booking.trainerName) {
        doc.text(`Trainer/Ranch: ${booking.trainerName}`, 40 + colGap, billRow);
        billRow += 14;
    }
    if (booking.email) {
        doc.text(booking.email, 40 + colGap, billRow);
        billRow += 14;
    }
    if (booking.phone) {
        doc.text(booking.phone, 40 + colGap, billRow);
        billRow += 14;
    }

    return Math.max(row, billRow) + 14;
}

// Line items and totals live in bookingPricing.js so the UI, this PDF, and the
// unit tests all share one implementation. Re-exported so existing
// `import { computeBookingTotal } from '@/lib/invoiceGenerator'` callers keep working.
export { buildLineItems, computeBookingTotal };

function drawTotals(doc, { subtotal, total, amountPaid = 0, balanceDue = null }) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const labelX = pageWidth - 180;
    const valueX = pageWidth - 40;
    let y = doc.lastAutoTable.finalY + 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);

    doc.text('Subtotal', labelX, y);
    doc.text(fmtMoney(subtotal), valueX, y, { align: 'right' });
    y += 16;

    if (amountPaid > 0) {
        doc.text('Amount Paid', labelX, y);
        doc.setTextColor(...SUCCESS);
        doc.text(`-${fmtMoney(amountPaid)}`, valueX, y, { align: 'right' });
        doc.setTextColor(71, 85, 105);
        y += 16;
    }

    // Divider above total
    doc.setDrawColor(226, 232, 240);
    doc.line(labelX, y - 6, valueX, y - 6);
    y += 6;

    // Final total or balance due
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    const finalLabel = balanceDue != null ? 'Balance Due' : 'Total';
    const finalValue = balanceDue != null ? balanceDue : total;
    doc.text(finalLabel, labelX, y);
    doc.text(fmtMoney(finalValue), valueX, y, { align: 'right' });

    return y + 24;
}

function drawFooter(doc, { booking, show, organizerContact }) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const y = pageHeight - 70;

    doc.setDrawColor(226, 232, 240);
    doc.line(40, y - 14, pageWidth - 40, y - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);

    const shortRef = String(booking.id || '').slice(0, 8).toUpperCase();
    doc.text(`Booking Reference: ${shortRef}`, 40, y);
    if (booking.arrivalDate && booking.departureDate) {
        doc.text(
            `Stay: ${safeDate(booking.arrivalDate)} – ${safeDate(booking.departureDate)} (${booking.nights || 0} night${booking.nights !== 1 ? 's' : ''})`,
            40, y + 12
        );
    }
    if (booking.preferences) {
        doc.text(`Notes: ${booking.preferences}`.slice(0, 110), 40, y + 24);
    }

    if (organizerContact) {
        doc.text(`Show organizer: ${organizerContact}`, pageWidth - 40, y, { align: 'right' });
    }
    doc.text(`Generated ${format(new Date(), 'MMM d, yyyy h:mm a')}`, pageWidth - 40, y + 12, { align: 'right' });
}

// ───── Public API ─────

/**
 * Returns a jsPDF instance for the invoice. Caller can .save(), .output(), or .save('name.pdf').
 *
 * @param {object} params
 * @param {object} params.booking          Booking object (with items[], exhibitorName, etc.)
 * @param {object} params.show             { id, name, startDate, endDate, venueFacility }
 * @param {Array}  [params.assignedStalls] Optional: pre-computed stall assignments to print
 * @param {object} [params.options]
 * @param {string} [params.options.brandName]        Header name (default: "EquiPatterns")
 * @param {string} [params.options.invoiceNumber]    Custom invoice number (default: derived from booking id)
 * @param {string} [params.options.issuedAt]         ISO date (default: booking.createdAt or now)
 * @param {string} [params.options.dueAt]            ISO date (default: 7 days from issuedAt)
 * @param {string} [params.options.organizerContact] Email/phone shown in footer
 * @param {number} [params.options.amountPaid]       Amount already paid (default 0)
 */
export function generateInvoicePdf({ booking, show, assignedStalls = [], options = {} }) {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    const shortRef = String(booking?.id || '').slice(0, 8).toUpperCase();
    const invoiceNumber = options.invoiceNumber || `INV-${shortRef}`;
    const issuedAt = options.issuedAt || booking?.createdAt || new Date().toISOString();
    const dueAt = options.dueAt
        || (booking?.arrivalDate ? booking.arrivalDate : null);

    drawHeader(doc, {
        brandName: options.brandName,
        invoiceNumber,
        issuedAt,
        dueAt,
    });

    drawStatusBadge(
        doc,
        40,
        96,
        booking?.status,
        booking?.paymentStatus,
    );

    const tableStartY = drawShowAndBillTo(doc, { show, booking });

    // Line items table
    const items = buildLineItems(booking || {}, assignedStalls);
    const subtotal = items.reduce((s, r) => s + (Number(r.total) || 0), 0);

    autoTable(doc, {
        startY: tableStartY,
        head: [['Description', 'Qty', 'Unit Price', 'Total']],
        body: items.map(r => [
            r.description,
            String(r.qty),
            fmtMoney(r.unitPrice),
            fmtMoney(r.total),
        ]),
        styles: { fontSize: 10, cellPadding: 8, valign: 'top' },
        headStyles: {
            fillColor: PRIMARY,
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10,
        },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 50, halign: 'center' },
            2: { cellWidth: 90, halign: 'right' },
            3: { cellWidth: 90, halign: 'right' },
        },
        margin: { left: 40, right: 40 },
        theme: 'striped',
        alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const amountPaid = Number(options.amountPaid) || 0;
    const balanceDue = amountPaid > 0 ? Math.max(subtotal - amountPaid, 0) : null;

    drawTotals(doc, {
        subtotal,
        total: subtotal,
        amountPaid,
        balanceDue,
    });

    drawFooter(doc, {
        booking,
        show,
        organizerContact: options.organizerContact,
    });

    return doc;
}

/** One-call download: builds the PDF and triggers a file download. */
export function downloadInvoicePdf(params) {
    const doc = generateInvoicePdf(params);
    const shortRef = String(params?.booking?.id || 'INVOICE').slice(0, 8).toUpperCase();
    const safeShow = (params?.show?.name || 'Show').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 30);
    doc.save(`Invoice-${safeShow}-${shortRef}.pdf`);
}
