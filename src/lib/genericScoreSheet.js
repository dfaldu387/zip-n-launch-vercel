import { jsPDF } from 'jspdf';

/**
 * Shared score-sheet layout constants.
 * Every consumer (bookGenerator, patternBookDownloader, pdfUtils) should
 * reference these so output looks identical regardless of entry-point.
 */
export const SCORESHEET_LAYOUT = {
  margin: 20,            // minimal margins to maximise printable area
  headerGap: 6,          // space between header lines
  gridCols: 3,
  gridRows: 5,
  gridGapX: 8,
  gridGapY: 6,
  penaltyHeight: 34,
  brandingText: 'Equipatterns',
};

/**
 * Draws a generic Trail-style scoresheet page onto an existing jsPDF document.
 * Includes show metadata and 15 empty numbered boxes (3x5 grid).
 * Boxes expand dynamically to fill the full printable area.
 *
 * @param {jsPDF} doc - The jsPDF document instance (page should already be set/added)
 * @param {object} info - Metadata to display on the scoresheet
 * @param {string} info.association - Association name
 * @param {string} info.showName - Show name
 * @param {string} info.discipline - Discipline/class name
 * @param {string} info.division - Division name(s)
 * @param {string} info.date - Competition date string
 * @param {string} info.judge - Judge name
 */
export function drawGenericScoreSheetPage(doc, info) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const { margin, gridCols: cols, gridRows: rows, gridGapX: gapX, gridGapY: gapY, penaltyHeight } = SCORESHEET_LAYOUT;
  let y = margin;

  // -- Title / Branding --
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  const title = info.showName || SCORESHEET_LAYOUT.brandingText;
  doc.text(title.toUpperCase(), pageWidth / 2, y + 16, { align: 'center' });
  y += 26;

  // -- Association --
  if (info.association) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(info.association.toUpperCase(), pageWidth / 2, y + 12, { align: 'center' });
    y += 18;
  }

  // -- Subtitle: SCORE SHEET --
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('SCORE SHEET', pageWidth / 2, y + 10, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 18;

  // -- Metadata rows --
  doc.setFontSize(10);
  const leftX = margin;
  const rightX = pageWidth - margin;

  // Class / Discipline + Date
  if (info.discipline) {
    doc.setFont('helvetica', 'bold');
    doc.text('Class:', leftX, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.text(info.discipline, leftX + 36, y + 10);
  }
  if (info.date) {
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', rightX - 110, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.text(info.date, rightX - 78, y + 10);
  }
  y += 18;

  // Division
  if (info.division) {
    doc.setFont('helvetica', 'bold');
    doc.text('Division:', leftX, y + 10);
    doc.setFont('helvetica', 'normal');
    const divLines = doc.splitTextToSize(info.division, pageWidth - margin * 2 - 55);
    doc.text(divLines, leftX + 50, y + 10);
    y += divLines.length * 12 + 4;
  } else {
    y += 12;
  }

  // Judge
  if (info.judge) {
    doc.setFont('helvetica', 'bold');
    doc.text('Judge:', leftX, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.text(info.judge, leftX + 38, y + 10);
  }
  y += 18;

  // -- Separator line --
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // -- Label --
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('Obstacle / Maneuver Scores', pageWidth / 2, y + 8, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 16;

  // -- Dynamic 15-box grid (3 cols x 5 rows) --
  // Compute box height dynamically so the grid + penalty section fills remaining space
  const gridWidth = pageWidth - margin * 2;
  const boxWidth = (gridWidth - (cols - 1) * gapX) / cols;

  const footerReserve = 28; // space for branding footer
  const availableGridHeight = pageHeight - y - penaltyHeight - gapY - footerReserve - margin;
  const boxHeight = (availableGridHeight - (rows - 1) * gapY) / rows;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const boxNum = i * cols + j + 1;
      const bx = margin + j * (boxWidth + gapX);
      const by = y + i * (boxHeight + gapY);

      // Box outline
      doc.setDrawColor(140, 140, 140);
      doc.setLineWidth(0.75);
      doc.rect(bx, by, boxWidth, boxHeight);

      // Box number (top-left)
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80, 80, 80);
      doc.text(String(boxNum), bx + 5, by + 14);

      // Score line at bottom of box
      doc.setDrawColor(190, 190, 190);
      doc.setLineWidth(0.5);
      const lineY = by + boxHeight - 12;
      doc.line(bx + boxWidth * 0.5, lineY, bx + boxWidth - 8, lineY);

      // "Score" label
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 160, 160);
      doc.text('Score', bx + boxWidth - 8, lineY - 2, { align: 'right' });

      doc.setTextColor(0, 0, 0);
    }
  }

  // Move y past the grid
  y += rows * (boxHeight + gapY) + gapY;

  // -- Penalty / Total area --
  const penaltyWidth = (gridWidth - gapX) / 2;

  doc.setDrawColor(140, 140, 140);
  doc.setLineWidth(0.75);

  // Penalty box
  doc.rect(margin, y, penaltyWidth, penaltyHeight);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Penalties:', margin + 8, y + penaltyHeight / 2 + 3);

  // Total box
  const totalX = margin + penaltyWidth + gapX;
  doc.rect(totalX, y, penaltyWidth, penaltyHeight);
  doc.text('Total Score:', totalX + 8, y + penaltyHeight / 2 + 3);

  // -- Footer branding --
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 160);
  doc.text(SCORESHEET_LAYOUT.brandingText.toLowerCase() + '.com', pageWidth / 2, pageHeight - margin + 6, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

/**
 * Creates a standalone generic scoresheet PDF blob.
 * Used by the ZIP downloader.
 */
export function createGenericScoreSheetPdf(info) {
  const doc = new jsPDF('p', 'pt', 'letter');
  drawGenericScoreSheetPage(doc, info);
  return doc.output('blob');
}
