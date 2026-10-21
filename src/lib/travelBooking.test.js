import { describe, it, expect } from 'vitest';
import { stillToBook, missingReceipts } from '@/lib/travelBooking';

const on = { reimbursed: true };
const person = (id, expenses = {}) => ({ id, name: id, reimbursable_expenses: expenses });

describe('stillToBook', () => {
  it('lists an item that is switched on but has nothing booked', () => {
    const out = stillToBook([person('a', { hotel: on, airfare: on })], {});
    expect(out).toHaveLength(1);
    expect(out[0].items.map((i) => i.type)).toEqual(['flight', 'hotel']);
  });

  it('drops an item once it is booked', () => {
    const out = stillToBook([person('a', { hotel: on, airfare: on })], { a: { flight: { airline: 'Delta' } } });
    expect(out[0].items.map((i) => i.type)).toEqual(['hotel']);
  });

  it('leaves out people with nothing left to book', () => {
    const out = stillToBook([person('a', { hotel: on })], { a: { hotel: { hotelName: 'Hilton' } } });
    expect(out).toEqual([]);
  });

  it('ignores items that are off for the person', () => {
    expect(stillToBook([person('a', { hotel: { reimbursed: false } })], {})).toEqual([]);
  });

  it('counts an item with typed details even when it is off in Staff', () => {
    const out = stillToBook([person('a')], { a: { rentalCar: { pickupLocation: 'DFW' } } });
    expect(out[0].items.map((i) => i.type)).toEqual(['rentalCar']);
  });

  it('accepts a confirmation number or flight number as booked', () => {
    const out = stillToBook([person('a', { airfare: on, hotel: on })], { a: { flight: { flightNumber: 'DL1' }, hotel: { confirmation: 'H1' } } });
    expect(out).toEqual([]);
  });
});

describe('missingReceipts', () => {
  const receipt = [{ name: 'r.pdf' }];

  it('lists an item with an actual amount and no receipt', () => {
    const out = missingReceipts([person('a')], { a: { hotel: { actualCost: '300' } } });
    expect(out[0].items).toEqual([{ type: 'hotel', label: 'Hotel', tab: 'hotels', actual: 300 }]);
  });

  it('drops it once a receipt is attached', () => {
    expect(missingReceipts([person('a')], { a: { hotel: { actualCost: '300', receipts: receipt } } })).toEqual([]);
  });

  it('ignores lines with no actual yet, or an actual of 0', () => {
    expect(missingReceipts([person('a')], { a: { flight: { cost: '400' }, hotel: { actualCost: '0' } } })).toEqual([]);
  });

  it('works for each travel type', () => {
    const out = missingReceipts([person('a')], {
      a: { flight: { actualCost: '10' }, rentalCar: { actualCost: '20' }, mileage: { actualCost: '30' } },
    });
    expect(out[0].items.map((i) => i.type)).toEqual(['flight', 'rentalCar', 'mileage']);
  });
});
