// Placing order for "Live Scoring with Notes". Pure helpers, tested in scoringNotesOrder.test.js.

// Horses with a place_order come first (1, 2, 3...). Horses without one go after them, in the order
// they were added.
export const sortByPlaceOrder = (entries) =>
  [...(entries || [])].sort((a, b) => {
    const pa = Number(a.place_order) || Infinity;
    const pb = Number(b.place_order) || Infinity;
    if (pa !== pb) return pa < pb ? -1 : 1;
    return (Number(a.work_order) || 0) - (Number(b.work_order) || 0);
  });

// Give the list (already in its new order) the places 1..n. Returns the updated list and only the
// rows whose place actually changed, so a drop saves as few rows as possible.
export const reorderPlaces = (list) => {
  const changes = [];
  const next = list.map((x, i) => {
    const place = i + 1;
    if (Number(x.place_order) !== place) changes.push({ id: x.id, place_order: place });
    return { ...x, place_order: place };
  });
  return { next, changes };
};
