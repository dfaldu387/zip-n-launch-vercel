// Employee Reports Center engine.
//
// Every report is a definition (title, columns, a row builder) run over the same list of people.
// The filters, Preview, Print and later PDF / Excel all read the rows a definition returns, so a
// number can never differ between them. Reports never write anything back to the show.

import { flattenPersonnel, calculateStaffCost, expenseTypeMeta, isDirectExpense } from '@/lib/contractUtils';
import { summarizeCloseout } from '@/lib/employeeCloseout';
import { bookingStatus, bookingBoard, BOOKING_STATUS_LABELS, TRAVEL_ITEMS } from '@/lib/travelBooking';
import { hasEnteredTravel } from '@/lib/travelDefaults';
import { hotelFigures, flightFigures, rentalFigures, mileageFigures, summarizeLines } from '@/lib/travelActuals';
import { dayOf, formatDay, timeOf, assignmentsInShow } from '@/lib/travelCalendar';

export const CONTRACT_STATUS_LABELS = {
  not_sent: 'Not sent',
  sent: 'Sent',
  viewed: 'Viewed',
  signed: 'Signed',
  approved: 'Approved',
  declined: 'Declined',
};

/** The show's people: the Officials & Staff list plus anyone added by hand on Employee Scheduling. */
export function reportPeople(pd = {}) {
  const fromOfficials = flattenPersonnel({ showDetails: { officials: pd.showDetails?.officials || {} } })
    .filter((m) => (m.name || '').trim());
  const seen = new Set(fromOfficials.map((m) => m.id));
  const manual = (pd.staffSchedule?.roster || [])
    .filter((e) => e && e.id && !seen.has(e.id) && (e.name || '').trim())
    .map((e) => ({ id: e.id, name: e.name, roleName: 'Added by hand', reimbursable_expenses: {} }));
  return [...fromOfficials, ...manual];
}

const nameKey = (n) => (n || '').trim().toLowerCase();

/**
 * Finds each show person's contract folder. The contract keeps its own copy of every person with its
 * own id (and a source_id pointing at the show's id), and files the folder under that copy's id.
 * Match by source_id or id first, then by name as a last resort.
 */
export function contractFolderFinder(contractPd = {}) {
  const folders = contractPd.employeeFolders || {};
  const byShowId = new Map();
  const byName = new Map();
  for (const m of flattenPersonnel(contractPd)) {
    const folder = folders[m.id];
    if (!folder) continue;
    if (m.source_id) byShowId.set(m.source_id, folder);
    byShowId.set(m.id, folder);
    if (nameKey(m.name)) byName.set(nameKey(m.name), folder);
  }
  return (member) => byShowId.get(member.id) || folders[member.id] || byName.get(nameKey(member.name)) || {};
}

/**
 * One entry per person with everything a report or a filter may need.
 * `contractPd` is the contract record's project_data (contract status lives there, not on the show).
 */
export function buildReportContext(pd = {}, contractPd = {}) {
  const findFolder = contractFolderFinder(contractPd);
  const people = reportPeople(pd);
  const travelData = pd.travelData || {};
  const closeout = pd.closeout || {};
  const { perPerson } = summarizeCloseout(people, travelData, closeout);
  // Old assignments left from earlier show dates are left out, the same way Travel Calendar does.
  const assignments = assignmentsInShow(pd.staffSchedule?.assignments || [], dayOf(pd.startDate), dayOf(pd.endDate));
  const totals = new Map(perPerson.map((p) => [p.member.id, p.total]));
  const cellsOf = new Map(perPerson.map((p) => [p.member.id, p.cells]));

  const entries = people.map((member) => {
    const total = totals.get(member.id) || { budget: 0, actual: null, variance: null, counted: 0, total: 0 };
    const folder = findFolder(member);
    return {
      member,
      id: member.id,
      name: member.name,
      role: member.roleName || '',
      travel: travelData[member.id] || {},
      assignments: assignments.filter((a) => a.employeeId === member.id),
      fin: calculateStaffCost(member),
      cells: cellsOf.get(member.id) || [],
      total,
      travelStatus: bookingStatus(member, travelData[member.id] || {}, total.budget > 0),
      contractStatus: folder.signatureStatus || 'not_sent',
      folder,
    };
  });
  return { pd, entries, arenas: pd.arenas || [] };
}

/** Filters are all optional; an empty value means "everyone". */
export function applyFilters(entries, filters = {}) {
  return entries.filter((e) => {
    if (filters.personId && e.id !== filters.personId) return false;
    if (filters.role && e.role !== filters.role) return false;
    if (filters.travelStatus && e.travelStatus !== filters.travelStatus) return false;
    if (filters.contractStatus && e.contractStatus !== filters.contractStatus) return false;
    return true;
  });
}

export const REPORT_CATEGORIES = [
  { id: 'finance', title: 'Budget & Costs' },
  { id: 'staffing', title: 'Staffing & Scheduling' },
  { id: 'travel', title: 'Travel & Logistics' },
  { id: 'readiness', title: 'Contracts & Employee Readiness' },
];

const cents = (n) => Math.round(n * 100) / 100;
const orNull = (n) => (n > 0 ? cents(n) : null);
const TRAVEL_CELL_KEYS = ['flight', 'hotel', 'rentalCar', 'mileage'];
const ACTUAL_OF = { flight: flightFigures, hotel: hotelFigures, rentalCar: rentalFigures, mileage: mileageFigures };

const clock = (t) => {
  const m = typeof t === 'string' && t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};
const day = (iso) => (dayOf(iso) ? formatDay(dayOf(iso), { weekday: 'short', month: 'short', day: 'numeric' }) : '');
// "Fri, Oct 23 7:30 AM" for a date-time field; just the date when it has no time.
const when = (iso) => [day(iso), timeOf(iso)].filter(Boolean).join(' ');

const travelItem = (type) => TRAVEL_ITEMS.find((i) => i.type === type);
// A person needs an item when it is switched on in Officials & Staff, or details were already typed.
const needs = (e, type) => !!e.member.reimbursable_expenses?.[travelItem(type).expenseKey]?.reimbursed || hasEnteredTravel(e.travel, type);
const bookedText = (type, card) => (travelItem(type).booked(card) ? 'Booked' : 'Not booked');
// A rate typed under Actual wins; then the actual total over the nights or days; then the budget over
// them. So the rate always sits on the same basis as the Actual column beside it.
const ratePer = (card, figures, quantity) => {
  const typed = parseFloat(card.actualRate);
  if (typed > 0) return typed;
  const basis = figures.actual !== null ? figures.actual : figures.budget;
  return basis > 0 && quantity > 0 ? Math.round((basis / quantity) * 100) / 100 : null;
};

// A column's `type` decides how a cell is shown: money, count or text.
export const REPORTS = [
  {
    id: 'budget-vs-actual',
    category: 'finance',
    title: 'Budget vs Actual',
    description: 'Each person\'s budget next to what was actually spent, and the difference.',
    columns: [
      { key: 'name', label: 'Employee', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'budget', label: 'Budget', type: 'money', sum: true },
      { key: 'actual', label: 'Actual', type: 'money', sum: true },
      { key: 'variance', label: 'Over / (Under)', type: 'money', sum: true },
      { key: 'lines', label: 'Actuals entered', type: 'text' },
    ],
    // Actual stays empty until a real number exists, so a missing actual never looks like a saving.
    rows: (entries) => entries.map((e) => ({
      name: e.name,
      role: e.role,
      budget: e.total.budget,
      actual: e.total.actual,
      variance: e.total.variance,
      lines: e.total.total > 0 ? `${e.total.counted} of ${e.total.total}` : '',
    })),
  },
  {
    id: 'staffing-cost',
    category: 'finance',
    title: 'Complete Staffing Cost',
    description: 'What each person costs the show: pay, overtime, reimbursements and direct expenses.',
    columns: [
      { key: 'name', label: 'Employee', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'pay', label: 'Pay', type: 'money', sum: true },
      { key: 'overtime', label: 'Overtime', type: 'money', sum: true },
      { key: 'reimbursed', label: 'Reimbursements', type: 'money', sum: true },
      { key: 'direct', label: 'Direct expenses', type: 'money', sum: true },
      { key: 'total', label: 'Total show cost', type: 'money', sum: true },
    ],
    // The planned cost from Officials & Staff, the same totals Show Structure shows for each person.
    rows: (entries) => entries.map((e) => ({
      name: e.name,
      role: e.role,
      pay: orNull(e.fin.dayPay + e.fin.hourlyPay),
      overtime: orNull(e.fin.overtimePay),
      reimbursed: orNull(e.fin.totalExpenses),
      direct: orNull(e.fin.directExpenses),
      total: orNull(e.fin.totalShowCost),
    })),
  },
  {
    id: 'travel-budget',
    category: 'finance',
    title: 'Travel Budget & Expense',
    description: 'Travel budget by flight, hotel, rental car and mileage, next to the actual spent.',
    columns: [
      { key: 'name', label: 'Employee', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'flight', label: 'Flight', type: 'money', sum: true },
      { key: 'hotel', label: 'Hotel', type: 'money', sum: true },
      { key: 'rentalCar', label: 'Rental car', type: 'money', sum: true },
      { key: 'mileage', label: 'Mileage', type: 'money', sum: true },
      { key: 'budget', label: 'Travel budget', type: 'money', sum: true },
      { key: 'actual', label: 'Travel actual', type: 'money', sum: true },
      { key: 'variance', label: 'Over / (Under)', type: 'money', sum: true },
    ],
    // Budget columns come from the Travel cards; actuals are only the lines that have one entered.
    rows: (entries) => entries
      .map((e) => {
        const lines = e.cells.filter((c) => TRAVEL_CELL_KEYS.includes(c.key));
        const budgetOf = (key) => orNull(lines.find((c) => c.key === key)?.budget || 0);
        const sum = summarizeLines(lines);
        return {
          name: e.name,
          role: e.role,
          flight: budgetOf('flight'),
          hotel: budgetOf('hotel'),
          rentalCar: budgetOf('rentalCar'),
          mileage: budgetOf('mileage'),
          budget: orNull(sum.budget),
          actual: sum.actual,
          variance: sum.variance,
          hasTravel: sum.total > 0,
        };
      })
      .filter((r) => r.hasTravel),
  },
  {
    id: 'reimbursement-direct',
    category: 'finance',
    title: 'Reimbursement & Direct Expense',
    rowNoun: ['expense', 'expenses'],
    description: 'Each expense, split into paid directly by the show and reimbursed to the person.',
    columns: [
      { key: 'name', label: 'Employee', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'expense', label: 'Expense', type: 'text' },
      { key: 'paidBy', label: 'Paid by', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'money', sum: true },
      { key: 'contract', label: 'Contract', type: 'text' },
    ],
    // One row per switched-on expense. "Direct" is paid by the show; everything else is reimbursed.
    rows: (entries) => entries
      .flatMap((e) => Object.entries(e.member.reimbursable_expenses || {})
        .filter(([, exp]) => exp?.reimbursed)
        .map(([key, exp]) => ({
          name: e.name,
          role: e.role,
          expense: expenseTypeMeta[key]?.label || key,
          direct: isDirectExpense(exp),
          paidBy: isDirectExpense(exp) ? 'Show pays directly' : 'Reimbursed to person',
          amount: orNull(e.fin.directBreakdown[key] ?? e.fin.expenseBreakdown[key] ?? 0),
          contract: CONTRACT_STATUS_LABELS[e.contractStatus],
        })))
      .sort((a, b) => Number(b.direct) - Number(a.direct) || a.name.localeCompare(b.name) || a.expense.localeCompare(b.expense)),
  },
  {
    id: 'daily-staffing',
    category: 'staffing',
    title: 'Daily Staffing and Assignment',
    rowNoun: ['assignment', 'assignments'],
    description: 'Who works which arena each day, with report and start times.',
    columns: [
      { key: 'date', label: 'Date', type: 'text' },
      { key: 'arena', label: 'Arena', type: 'text' },
      { key: 'name', label: 'Employee', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'reportTime', label: 'Report time', type: 'text' },
      { key: 'startTime', label: 'Start time', type: 'text' },
    ],
    // One row per assignment, in date order. Sorting uses the raw ISO date kept in `sortDate`.
    rows: (entries, ctx) => {
      const arenaName = (id) => (id === '__shared__' ? 'Shared staff' : ctx.arenas.find((a) => a.id === id)?.name || '');
      return entries
        .flatMap((e) => e.assignments.map((a) => ({
          sortDate: dayOf(a.date),
          date: day(a.date),
          arena: arenaName(a.arenaId),
          name: e.name,
          role: e.role,
          reportTime: clock(a.reportTime),
          startTime: clock(a.startTime),
        })))
        .filter((r) => r.sortDate)
        .sort((x, y) => x.sortDate.localeCompare(y.sortDate) || x.arena.localeCompare(y.arena) || x.name.localeCompare(y.name));
    },
  },
  {
    id: 'hotel-room-night',
    category: 'travel',
    title: 'Hotel Room / Night',
    description: "Each person's hotel, room type, nights and cost.",
    columns: [
      { key: 'name', label: 'Employee', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'hotel', label: 'Hotel', type: 'text' },
      { key: 'roomType', label: 'Room type', type: 'text' },
      { key: 'checkIn', label: 'Check-in', type: 'text' },
      { key: 'checkOut', label: 'Check-out', type: 'text' },
      { key: 'nights', label: 'Nights', type: 'count', sum: true },
      { key: 'rate', label: 'Rate / night', type: 'money' },
      { key: 'budget', label: 'Budget', type: 'money', sum: true },
      { key: 'actual', label: 'Actual', type: 'money', sum: true },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    rows: (entries) => entries
      .filter((e) => needs(e, 'hotel'))
      .map((e) => {
        const card = e.travel.hotel || {};
        const f = hotelFigures(card);
        return {
          name: e.name,
          role: e.role,
          hotel: card.hotelName || '',
          roomType: card.roomType || '',
          checkIn: day(card.checkIn),
          checkOut: day(card.checkOut),
          nights: f.nights > 0 ? f.nights : null,
          rate: ratePer(card, f, f.nights),
          budget: f.budget > 0 ? f.budget : null,
          actual: f.actual,
          status: bookedText('hotel', card),
        };
      }),
  },
  {
    id: 'flight-travel',
    category: 'travel',
    title: 'Flight & Travel',
    rowNoun: ['flight', 'flights'],
    description: 'Airline, route, times, confirmation and airfare for each person.',
    columns: [
      { key: 'name', label: 'Employee', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'flight', label: 'Airline / flight', type: 'text' },
      { key: 'route', label: 'Route', type: 'text' },
      { key: 'departs', label: 'Departs', type: 'text' },
      { key: 'arrives', label: 'Arrives', type: 'text' },
      { key: 'returnDeparts', label: 'Return departs', type: 'text' },
      { key: 'confirmation', label: 'Confirmation', type: 'text' },
      { key: 'budget', label: 'Budget', type: 'money', sum: true },
      { key: 'actual', label: 'Actual', type: 'money', sum: true },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    rows: (entries) => entries
      .filter((e) => needs(e, 'flight'))
      .map((e) => {
        const card = e.travel.flight || {};
        const f = flightFigures(card);
        return {
          name: e.name,
          role: e.role,
          flight: [card.airline, card.flightNumber].filter(Boolean).join(' '),
          route: [card.departureAirport, card.arrivalAirport].filter(Boolean).join(' → '),
          departs: when(card.departureTime),
          arrives: when(card.arrivalTime),
          returnDeparts: when(card.returnDepartureTime),
          confirmation: card.confirmation || '',
          budget: f.budget > 0 ? f.budget : null,
          actual: f.actual,
          status: bookedText('flight', card),
        };
      }),
  },
  {
    id: 'rental-car',
    category: 'travel',
    title: 'Rental Car',
    rowNoun: ['rental', 'rentals'],
    description: 'Rental provider, pickup and return, days and total cost.',
    columns: [
      { key: 'name', label: 'Employee', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'company', label: 'Provider', type: 'text' },
      { key: 'vehicle', label: 'Vehicle', type: 'text' },
      { key: 'location', label: 'Pickup location', type: 'text' },
      { key: 'pickup', label: 'Pickup', type: 'text' },
      { key: 'returns', label: 'Return', type: 'text' },
      { key: 'days', label: 'Days', type: 'count', sum: true },
      { key: 'rate', label: 'Rate / day', type: 'money' },
      { key: 'budget', label: 'Budget', type: 'money', sum: true },
      { key: 'actual', label: 'Actual', type: 'money', sum: true },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    rows: (entries) => entries
      .filter((e) => needs(e, 'rentalCar'))
      .map((e) => {
        const card = e.travel.rentalCar || {};
        const f = rentalFigures(card);
        return {
          name: e.name,
          role: e.role,
          company: card.company || '',
          vehicle: card.vehicleType || '',
          location: card.pickupLocation || '',
          pickup: when(card.pickupTime),
          returns: when(card.returnTime),
          days: f.days > 0 ? f.days : null,
          rate: ratePer(card, f, f.days),
          budget: f.budget > 0 ? f.budget : null,
          actual: f.actual,
          status: bookedText('rentalCar', card),
        };
      }),
  },
  {
    id: 'travel-logistics',
    category: 'travel',
    title: 'Travel Logistics',
    description: 'Everything each person has booked in one row, and what is still to book.',
    columns: [
      { key: 'name', label: 'Employee', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'arrives', label: 'Arrives', type: 'text' },
      { key: 'departs', label: 'Departs', type: 'text' },
      { key: 'hotel', label: 'Hotel', type: 'text' },
      { key: 'car', label: 'Rental car', type: 'text' },
      { key: 'miles', label: 'Miles', type: 'count', sum: true },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'toBook', label: 'Still to book', type: 'text' },
    ],
    // One row per person who needs any travel item.
    rows: (entries) => entries
      .map((e) => ({ e, board: bookingBoard([e.member], { [e.id]: e.travel })[0] }))
      .filter(({ board }) => board)
      .map(({ e, board }) => {
        const t = e.travel;
        const miles = parseFloat(t.mileage?.miles) || 0;
        return {
          name: e.name,
          role: e.role,
          arrives: when(t.flight?.arrivalTime),
          departs: when(t.flight?.returnDepartureTime),
          hotel: t.hotel?.hotelName || '',
          car: t.rentalCar?.company || '',
          miles: miles > 0 ? miles : null,
          status: BOOKING_STATUS_LABELS[e.travelStatus],
          toBook: board.items.map((i) => i.label).join(', '),
        };
      }),
  },
  {
    id: 'receipts',
    category: 'readiness',
    title: 'Receipt Report',
    rowNoun: ['item', 'items'],
    description: 'For each travel item: receipt submitted, missing, or pending an actual amount.',
    columns: [
      { key: 'name', label: 'Employee', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'item', label: 'Item', type: 'text' },
      { key: 'actual', label: 'Actual', type: 'money', sum: true },
      { key: 'receipts', label: 'Receipts', type: 'count', sum: true },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    // Submitted = a receipt is attached. Missing = an actual amount but no receipt.
    // Pending = needed, but no actual amount entered yet.
    rows: (entries) => entries.flatMap((e) => TRAVEL_ITEMS
      .filter((item) => needs(e, item.type))
      .map((item) => {
        const card = e.travel[item.type] || {};
        const actual = ACTUAL_OF[item.type](card).actual;
        const count = Array.isArray(card.receipts) ? card.receipts.length : 0;
        return {
          name: e.name,
          role: e.role,
          item: item.label,
          actual: actual > 0 ? actual : null,
          receipts: count > 0 ? count : null,
          status: count > 0 ? 'Submitted' : actual > 0 ? 'Missing' : 'Pending',
        };
      })),
  },
];

/** "3 people" / "1 assignment": the header count, in the unit this report lists. */
export function countLabel(report, count) {
  const [one, many] = report.rowNoun || ['person', 'people'];
  return `${count} ${count === 1 ? one : many}`;
}

export const findReport = (id) => REPORTS.find((r) => r.id === id) || null;

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Text for one cell. An empty value shows as a dash. */
export function formatCell(value, type) {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'money') return money.format(value);
  return String(value);
}

/**
 * Run a report: its rows for the filtered people, plus a totals row for the columns marked `sum`.
 * A sum skips empty cells, and stays empty when every cell in the column is empty.
 */
export function runReport(report, context, filters = {}) {
  const entries = applyFilters(context.entries, filters);
  const rows = report.rows(entries, context);
  const totals = {};
  for (const col of report.columns) {
    if (!col.sum) continue;
    const nums = rows.map((r) => r[col.key]).filter((v) => typeof v === 'number');
    totals[col.key] = nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100 : null;
  }
  const hasSums = report.columns.some((c) => c.sum);
  return { report, rows, totals: rows.length > 0 && hasSums ? totals : null, count: rows.length };
}

export const TRAVEL_STATUS_OPTIONS = Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => ({ value, label }));
export const CONTRACT_STATUS_OPTIONS = Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => ({ value, label }));

// ── Saved reports ──
// A saved report is only a recipe: which report and which filters, never the numbers. Opening one runs
// it again on today's data, so the "pulled on" time is always when it was last run.

const cleanFilters = (filters = {}) => Object.fromEntries(Object.entries(filters).filter(([, v]) => v));

/** The saved list with one more report on the end. Returns the same list when the name is empty. */
export function addSavedReport(list = [], { name, reportId, filters }, now = new Date(), id = `rpt-${now.getTime()}`) {
  const trimmed = (name || '').trim();
  if (!trimmed || !findReport(reportId)) return list;
  return [...list, { id, name: trimmed, reportId, filters: cleanFilters(filters), savedAt: now.toISOString() }];
}

export const removeSavedReport = (list = [], id) => list.filter((r) => r.id !== id);

/** Saved reports whose report still exists (a removed report never breaks the list). */
export const usableSavedReports = (list = []) => list.filter((r) => findReport(r.reportId));
