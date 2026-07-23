import { renderTagPng, getTagWidthRatio, TAG_MARGIN_RATIO } from '@/lib/scoresheetTextOverlay';

/**
 * Score sheets Robert uploads as PDFs never touch the canvas overlay, so they used to
 * come out untagged. This stamps the same tag onto EVERY page of the PDF, top-right,
 * so a judge holding page 2 still knows the show, class, date and judge.
 *
 * The tag is rendered once as a PNG and embedded once, then drawn on each page.
 */

/**
 * Place the tag at the visual top-right of a page, honouring /Rotate.
 * pdf-lib draws in unrotated user space, so a rotated page needs the anchor
 * point and the image rotation worked out per angle.
 */
const drawTagOnPage = (page, image, tagAspect, hasQr, degrees) => {
  const { width: pw, height: ph } = page.getSize();
  const angle = ((page.getRotation().angle % 360) + 360) % 360;
  const swapped = angle === 90 || angle === 270;

  // Visual page box (what the reader sees).
  const visW = swapped ? ph : pw;
  const visH = swapped ? pw : ph;

  const w = visW * getTagWidthRatio(hasQr);
  const h = w * tagAspect;
  const margin = visW * TAG_MARGIN_RATIO;

  // Target rectangle in visual coordinates (origin bottom-left).
  const x1 = visW - w - margin;
  const y1 = visH - h - margin;
  const x2 = visW - margin;
  const y2 = visH - margin;

  let x;
  let y;
  if (angle === 90) {
    x = (pw - y2) + h;
    y = x1;
  } else if (angle === 180) {
    x = (pw - x2) + w;
    y = (ph - y2) + h;
  } else if (angle === 270) {
    x = y1;
    y = (ph - x1);
  } else {
    x = x1;
    y = y1;
  }

  page.drawImage(image, { x, y, width: w, height: h, rotate: degrees(angle) });
};

/**
 * @param {Blob} pdfBlob - the score sheet PDF (cheat sheet already merged in)
 * @param {Object} overlayData - { showName, className, date, judgeName }
 * @param {string|null} qrUrl - link the printed QR should resolve to
 * @returns {Promise<Blob>} stamped PDF, or the original blob if stamping fails
 */
export const stampPdfWithTag = async (pdfBlob, overlayData, qrUrl = null, qrPlaceholder = false) => {
  try {
    const tag = await renderTagPng(overlayData, qrUrl, 1200, qrPlaceholder);
    if (!tag) return pdfBlob;

    const { PDFDocument, degrees } = await import('pdf-lib');
    const doc = await PDFDocument.load(await pdfBlob.arrayBuffer(), { ignoreEncryption: true });
    const image = await doc.embedPng(tag.bytes);

    for (const page of doc.getPages()) {
      drawTagOnPage(page, image, tag.aspect, tag.hasQr, degrees);
    }

    return new Blob([await doc.save()], { type: 'application/pdf' });
  } catch (error) {
    // A missing tag is better than a missing score sheet.
    console.warn('Could not stamp the tag onto the PDF score sheet:', error);
    return pdfBlob;
  }
};
