// "Live Scoring by Time": pure helpers. Fastest (lowest) time places first.

// "17.342" -> 17.342. Empty, text or a time of 0 or less -> null (no valid time).
export const parseTime = (v) => {
  const s = String(v ?? '').trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// 17.3 -> "17.300". Three decimals, like a timer shows.
export const formatTime = (n) => (Number.isFinite(Number(n)) && n !== null && n !== '' ? Number(n).toFixed(3) : '');

// Ranks the horses by time. Equal times share a placing (1, 1, 3). Horses with no time typed yet, or
// marked "No time", get placing null. Returns { ranked, waiting, noTime }.
//   ranked: timed horses first (fastest first), then horses with no time yet, then "No time" horses.
export const rankByTime = (entries) => {
  const list = entries || [];
  const timed = list
    .filter((e) => !e.no_time && parseTime(e.time_seconds) !== null)
    .map((e) => ({ ...e, time: parseTime(e.time_seconds) }))
    .sort((a, b) => a.time - b.time || (Number(a.work_order) || 0) - (Number(b.work_order) || 0));
  let lastTime = null;
  let lastPlace = 0;
  const placed = timed.map((e, i) => {
    const placing = e.time === lastTime ? lastPlace : i + 1;
    lastTime = e.time;
    lastPlace = placing;
    return { ...e, placing };
  });
  const byWork = (a, b) => (Number(a.work_order) || 0) - (Number(b.work_order) || 0);
  const waiting = list.filter((e) => !e.no_time && parseTime(e.time_seconds) === null).sort(byWork).map((e) => ({ ...e, time: null, placing: null }));
  const noTime = list.filter((e) => e.no_time).sort(byWork).map((e) => ({ ...e, time: null, placing: null }));
  return { ranked: [...placed, ...waiting, ...noTime], waiting: waiting.length, noTime: noTime.length };
};
