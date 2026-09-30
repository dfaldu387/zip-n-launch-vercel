// "1001" → 1001, 1002…   "A101" → A101, A102…   "007" → 007, 008…
// Returns a function that gives the label for the k-th item (k = 0, 1, 2…), or
// null when the start has no number at the end.
export function sequenceFrom(start) {
    const m = String(start ?? '').trim().match(/^(.*?)(\d+)$/);
    if (!m) return null;
    const [, prefix, digits] = m;
    const width = digits.startsWith('0') ? digits.length : 0;
    const first = parseInt(digits, 10);
    return (k) => `${prefix}${String(first + k).padStart(width, '0')}`;
}
