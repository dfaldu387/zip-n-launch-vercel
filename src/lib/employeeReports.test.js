import { describe, it, expect } from 'vitest';
import { buildReportContext, applyFilters, runReport, findReport, formatCell, addSavedReport, removeSavedReport, usableSavedReports } from '@/lib/employeeReports';

const show = {
  showDetails: {
    officials: {
      AQHA: {
        JUDGE: [
          { id: 'j1', name: 'Anna Judge', day_fee: '500', employment_start_date: '2026-11-01', employment_end_date: '2026-11-02' },
        ],
        STEWARD: [{ id: 's1', name: 'Bob Steward' }],
      },
    },
  },
  staffSchedule: { roster: [{ id: 'h1', name: 'Hand Added' }, { id: 'j1', name: 'Anna Judge' }] },
  travelData: {},
};

// The contract keeps its own copy of each person: its own id, plus source_id = the show's id.
const contract = {
  showDetails: { officials: { AQHA: { JUDGE: [{ id: 'c-j1', source_id: 'j1', name: 'Anna Judge' }], STEWARD: [{ id: 'c-s1', name: 'Bob Steward' }] } } },
  employeeFolders: { 'c-j1': { signatureStatus: 'approved' } },
};

describe('buildReportContext', () => {
  const ctx = buildReportContext(show, contract);

  it('finds contract status through source_id when the contract copy has a different id', () => {
    expect(ctx.entries.find((e) => e.id === 'j1').contractStatus).toBe('approved');
  });

  it('falls back to the name when there is no source_id', () => {
    const byName = buildReportContext(show, {
      showDetails: { officials: { AQHA: { STEWARD: [{ id: 'x9', name: 'bob steward' }] } } },
      employeeFolders: { x9: { signatureStatus: 'signed' } },
    });
    expect(byName.entries.find((e) => e.id === 's1').contractStatus).toBe('signed');
  });

  it('lists officials plus hand-added staff once each', () => {
    expect(ctx.entries.map((e) => e.id).sort()).toEqual(['h1', 'j1', 's1']);
  });

  it('reads contract status from the contract folders, defaulting to not sent', () => {
    const byId = Object.fromEntries(ctx.entries.map((e) => [e.id, e]));
    expect(byId.j1.contractStatus).toBe('approved');
    expect(byId.s1.contractStatus).toBe('not_sent');
  });
});

describe('applyFilters', () => {
  const ctx = buildReportContext(show, contract);

  it('returns everyone with no filters', () => {
    expect(applyFilters(ctx.entries, {})).toHaveLength(3);
  });

  it('filters by contract status', () => {
    expect(applyFilters(ctx.entries, { contractStatus: 'approved' }).map((e) => e.id)).toEqual(['j1']);
  });

  it('filters by person and by travel status together', () => {
    expect(applyFilters(ctx.entries, { personId: 's1', travelStatus: 'pending' }).map((e) => e.id)).toEqual(['s1']);
    expect(applyFilters(ctx.entries, { personId: 's1', travelStatus: 'booked' })).toEqual([]);
  });
});

describe('budget-vs-actual', () => {
  const ctx = buildReportContext(show, {});
  const result = runReport(findReport('budget-vs-actual'), ctx, {});

  it('has one row per person and keeps Actual empty when nothing was entered', () => {
    expect(result.rows).toHaveLength(3);
    expect(result.rows.every((r) => r.actual === null)).toBe(true);
  });

  it('totals the budget and leaves the actual total empty', () => {
    expect(result.totals.budget).toBe(1000);
    expect(result.totals.actual).toBeNull();
  });

  it('has no totals row when the filters match nobody', () => {
    expect(runReport(findReport('budget-vs-actual'), ctx, { role: 'Nobody' }).totals).toBeNull();
  });
});

describe('formatCell', () => {
  it('shows money, and a dash for an empty value', () => {
    expect(formatCell(1234.5, 'money')).toBe('$1,234.50');
    expect(formatCell(null, 'money')).toBe('—');
    expect(formatCell(0, 'money')).toBe('$0.00');
  });
});

describe('daily-staffing', () => {
  const withSchedule = {
    ...show,
    arenas: [{ id: 'a1', name: 'Main Arena' }],
    staffSchedule: {
      ...show.staffSchedule,
      assignments: [
        { employeeId: 's1', arenaId: '__shared__', date: '2026-11-02', reportTime: '07:30', startTime: '08:00' },
        { employeeId: 'j1', arenaId: 'a1', date: '2026-11-01', reportTime: '13:05' },
        { employeeId: 'gone', arenaId: 'a1', date: '2026-11-01' },
      ],
    },
  };
  const result = runReport(findReport('daily-staffing'), buildReportContext(withSchedule, contract), {});

  it('lists one row per assignment in date order, skipping people no longer on the show', () => {
    expect(result.rows.map((r) => r.name)).toEqual(['Anna Judge', 'Bob Steward']);
  });

  it('names the arena, shows times in 12-hour form and calls shared staff by name', () => {
    expect(result.rows[0]).toMatchObject({ arena: 'Main Arena', reportTime: '1:05 PM', startTime: '' });
    expect(result.rows[1]).toMatchObject({ arena: 'Shared staff', reportTime: '7:30 AM', startTime: '8:00 AM' });
  });
});

describe('hotel-room-night', () => {
  const withHotel = {
    ...show,
    travelData: {
      j1: { hotel: { hotelName: 'Hilton', roomType: 'King', checkIn: '2026-11-01', checkOut: '2026-11-03', cost: '300' } },
    },
  };
  const result = runReport(findReport('hotel-room-night'), buildReportContext(withHotel, contract), {});

  it('lists only people who have a hotel', () => {
    expect(result.rows.map((r) => r.name)).toEqual(['Anna Judge']);
  });

  it('shows nights, budget and booked status, and totals the nights', () => {
    expect(result.rows[0]).toMatchObject({ hotel: 'Hilton', roomType: 'King', nights: 2, budget: 300, actual: null, status: 'Booked' });
    expect(result.totals.nights).toBe(2);
  });
});

describe('daily-staffing edge cases', () => {
  const pd = {
    ...show,
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    staffSchedule: {
      ...show.staffSchedule,
      assignments: [
        { employeeId: 'j1', arenaId: 'a1', date: '2026-06-19' },
        { employeeId: 'j1', arenaId: 'a1', date: '2026-11-02' },
      ],
    },
  };
  const result = runReport(findReport('daily-staffing'), buildReportContext(pd, contract), {});

  it('leaves out assignments from before or after the show dates', () => {
    expect(result.rows).toHaveLength(1);
  });

  it('has no totals row when the report has no number columns', () => {
    expect(result.totals).toBeNull();
  });
});

describe('saved reports', () => {
  const now = new Date('2026-10-27T15:00:00Z');

  it('saves the report and its filters, dropping empty filters', () => {
    const out = addSavedReport([], { name: ' Approved staff ', reportId: 'budget-vs-actual', filters: { contractStatus: 'approved', role: '' } }, now, 'r1');
    expect(out).toEqual([{ id: 'r1', name: 'Approved staff', reportId: 'budget-vs-actual', filters: { contractStatus: 'approved' }, savedAt: now.toISOString() }]);
  });

  it('does not save without a name or for an unknown report', () => {
    expect(addSavedReport([], { name: '  ', reportId: 'budget-vs-actual' }, now)).toEqual([]);
    expect(addSavedReport([], { name: 'X', reportId: 'nope' }, now)).toEqual([]);
  });

  it('removes one by id and hides ones whose report no longer exists', () => {
    const list = [{ id: 'a', reportId: 'budget-vs-actual' }, { id: 'b', reportId: 'gone' }];
    expect(removeSavedReport(list, 'a').map((r) => r.id)).toEqual(['b']);
    expect(usableSavedReports(list).map((r) => r.id)).toEqual(['a']);
  });
});

describe('travel reports', () => {
  const pd = {
    ...show,
    travelData: {
      j1: {
        flight: { airline: 'Delta', flightNumber: 'DL100', departureAirport: 'DFW', arrivalAirport: 'LAX', departureTime: '2026-11-01T07:30', arrivalTime: '2026-11-01T09:00', returnDepartureTime: '2026-11-03T18:00', confirmation: 'ABC123', cost: '400', actualCost: '380' },
        hotel: { hotelName: 'Hilton', checkIn: '2026-11-01', checkOut: '2026-11-03', cost: '300', actualRate: '175' },
        rentalCar: { company: 'Hertz', vehicleType: 'SUV', pickupLocation: 'LAX', pickupTime: '2026-11-01T10:00', returnTime: '2026-11-03T10:00', cost: '200' },
      },
    },
  };
  const ctx = buildReportContext(pd, contract);
  const run = (id) => runReport(findReport(id), ctx, {});

  it('flight report lists the route, times, confirmation and amounts', () => {
    const [row] = run('flight-travel').rows;
    expect(row).toMatchObject({ name: 'Anna Judge', flight: 'Delta DL100', route: 'DFW → LAX', confirmation: 'ABC123', budget: 400, actual: 380, status: 'Booked' });
    expect(row.departs).toContain('7:30 AM');
    expect(row.returnDeparts).toContain('6:00 PM');
  });

  it('hotel report shows the typed nightly rate, or the budget spread over the nights', () => {
    expect(run('hotel-room-night').rows[0].rate).toBe(175);
    const noRate = buildReportContext({ ...pd, travelData: { j1: { hotel: { hotelName: 'Hilton', checkIn: '2026-11-01', checkOut: '2026-11-03', cost: '300' } } } }, contract);
    expect(runReport(findReport('hotel-room-night'), noRate, {}).rows[0].rate).toBe(150);
  });

  it('rental report shows provider, days and rate per day', () => {
    expect(run('rental-car').rows[0]).toMatchObject({ company: 'Hertz', vehicle: 'SUV', days: 2, rate: 100, status: 'Booked' });
  });

  it('logistics report has one row per person with travel and names what is still to book', () => {
    const rows = run('travel-logistics').rows;
    expect(rows.map((r) => r.name)).toEqual(['Anna Judge']);
    expect(rows[0]).toMatchObject({ hotel: 'Hilton', car: 'Hertz', toBook: '' });
  });

  it('the flight report skips people who need no flight', () => {
    expect(run('flight-travel').rows).toHaveLength(1);
    expect(run('rental-car').rows).toHaveLength(1);
  });
});

describe('rate columns follow the Actual column', () => {
  const build = (card) => buildReportContext({ ...show, travelData: { j1: { hotel: { hotelName: 'Hilton', checkIn: '2026-11-01', checkOut: '2026-11-03', cost: '300', ...card } } } }, contract);
  const rate = (card) => runReport(findReport('hotel-room-night'), build(card), {}).rows[0].rate;

  it('uses a typed actual rate first', () => expect(rate({ actualRate: '175' })).toBe(175));
  it('then the actual total over the nights', () => expect(rate({ actualCost: '240' })).toBe(120));
  it('then the budget over the nights', () => expect(rate({})).toBe(150));
});

describe('money reports', () => {
  const money = {
    showDetails: {
      officials: {
        AQHA: {
          JUDGE: [{
            id: 'j1', name: 'Anna Judge', day_fee: '500', employment_start_date: '2026-11-01', employment_end_date: '2026-11-02',
            reimbursable_expenses: {
              airfare: { reimbursed: true, max_value: '400' },
              hotel: { reimbursed: true, expense_type: 'direct', total: '300' },
            },
          }],
          STEWARD: [{ id: 's1', name: 'Bob Steward' }],
        },
      },
    },
    travelData: {
      j1: {
        flight: { airline: 'Delta', cost: '400', actualCost: '380', receipts: [{ name: 'r.pdf' }] },
        hotel: { hotelName: 'Hilton', cost: '300', actualCost: '310' },
      },
    },
  };
  const ctx = buildReportContext(money, {});
  const run = (id) => runReport(findReport(id), ctx, {});

  it('staffing cost adds pay, reimbursements and direct expenses into the total', () => {
    const [row] = run('staffing-cost').rows;
    expect(row).toMatchObject({ name: 'Anna Judge', pay: 1000, reimbursed: 400, direct: 300, total: 1700 });
  });

  it('travel budget lists only people with travel, with budget and actual per type', () => {
    const { rows } = run('travel-budget');
    expect(rows.map((r) => r.name)).toEqual(['Anna Judge']);
    expect(rows[0]).toMatchObject({ flight: 400, hotel: 300, budget: 700, actual: 690, variance: -10 });
  });

  it('reimbursement report has one row per expense, direct ones first, with the right payer', () => {
    const { rows, totals } = run('reimbursement-direct');
    expect(rows.map((r) => [r.expense, r.paidBy, r.amount])).toEqual([
      ['Hotel', 'Show pays directly', 300],
      ['Airfare', 'Reimbursed to person', 400],
    ]);
    expect(totals.amount).toBe(700);
  });

  it('receipt report marks submitted, missing and pending', () => {
    const rows = run('receipts').rows;
    expect(rows.find((r) => r.item === 'Flight')).toMatchObject({ receipts: 1, status: 'Submitted' });
    expect(rows.find((r) => r.item === 'Hotel')).toMatchObject({ actual: 310, receipts: null, status: 'Missing' });
  });
});
