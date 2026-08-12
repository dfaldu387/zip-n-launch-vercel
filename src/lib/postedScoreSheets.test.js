import { describe, it, expect } from 'vitest';
import { validatePostedFile, MAX_POSTED_BYTES } from './postedScoreSheets';

// A stand-in for the File the browser hands us — only name, type and size matter.
const file = ({ name = 'sheet.jpg', type = 'image/jpeg', size = 2 * 1024 * 1024 } = {}) =>
  ({ name, type, size });

describe('validatePostedFile', () => {
  it('accepts a normal phone photo', () => {
    expect(validatePostedFile(file())).toBeNull();
  });

  it('accepts a PDF', () => {
    expect(validatePostedFile(file({ name: 'sheet.pdf', type: 'application/pdf' }))).toBeNull();
  });

  it('accepts a file whose type the picker left blank, going on the name', () => {
    // Some Android pickers hand over an empty type.
    expect(validatePostedFile(file({ name: 'IMG_0042.HEIC', type: '' }))).toBeNull();
  });

  it('rejects nothing selected', () => {
    expect(validatePostedFile(null)).toMatch(/no file/i);
  });

  it('rejects a file that is neither a photo nor a PDF', () => {
    expect(validatePostedFile(file({ name: 'notes.docx', type: 'application/msword' })))
      .toMatch(/photo or a PDF/i);
  });

  // The bug this guards: a full-resolution photo from a recent phone is 15-30 MB.
  // Nothing checked, so posting one on show wifi was a long silent wait.
  it('rejects an oversized photo and says what to do about it', () => {
    const problem = validatePostedFile(file({ size: 24 * 1024 * 1024 }));
    expect(problem).toMatch(/24 MB/);
    expect(problem).toMatch(/limit is 15 MB/);
    expect(problem).toMatch(/retake/i);
  });

  it('allows a file exactly on the limit', () => {
    expect(validatePostedFile(file({ size: MAX_POSTED_BYTES }))).toBeNull();
  });

  it('rejects one byte over', () => {
    expect(validatePostedFile(file({ size: MAX_POSTED_BYTES + 1 }))).not.toBeNull();
  });
});
