import * as XLSX from 'xlsx';

/**
 * Export Travel Management overview as an Excel (.xlsx) file.
 * Columns: Employee | Role | Travel Start | Travel End | Flight | Hotel | Rental Car | Mileage | Total | Status
 */

const getContractExpense = (member, expenseKey) => {
  const expense = member.reimbursable_expenses?.[expenseKey];
  if (!expense?.reimbursed) return 0;
  return parseFloat(expense.total) || parseFloat(expense.max_value) || 0;
};

const getFlightCost = (member, travel) => parseFloat(travel.flight?.cost) || getContractExpense(member, 'airfare');
const getHotelCost = (member, travel) => parseFloat(travel.hotel?.cost) || getContractExpense(member, 'hotel');
const getRentalCost = (member, travel) => parseFloat(travel.rentalCar?.cost) || getContractExpense(member, 'rentalCar');
const getMileageCost = (member, travel) => parseFloat(travel.mileage?.cost) || getContractExpense(member, 'mileage');

const SUM_KEYS = ['Flight', 'Hotel', 'Rental Car', 'Mileage', 'Total'];

export const exportTravelToExcel = ({ personnel, travelData, showName }) => {
  if (!personnel || personnel.length === 0) return false;

  const rows = personnel.map((member) => {
    const travel = travelData[member.id] || {};
    const flight = getFlightCost(member, travel);
    const hotel = getHotelCost(member, travel);
    const rental = getRentalCost(member, travel);
    const mileage = getMileageCost(member, travel);
    const total = flight + hotel + rental + mileage;

    const hasBooking = travel.flight?.airline || travel.hotel?.hotelName || travel.rentalCar?.company;
    const status = hasBooking ? 'Booked' : total > 0 ? 'Budgeted' : 'Pending';

    return {
      Employee: member.name || 'Unnamed',
      Role: member.roleName || '',
      'Travel Start': travel.travelStart || '',
      'Travel End': travel.travelEnd || '',
      Flight: flight,
      Hotel: hotel,
      'Rental Car': rental,
      Mileage: mileage,
      Total: total,
      Status: status,
    };
  });

  // Totals row
  const totals = { Employee: 'TOTAL', Role: '', 'Travel Start': '', 'Travel End': '', Status: '' };
  for (const key of SUM_KEYS) {
    totals[key] = rows.reduce((sum, r) => sum + (r[key] || 0), 0);
  }
  rows.push(totals);

  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 22 }, // Employee
    { wch: 18 }, // Role
    { wch: 14 }, // Travel Start
    { wch: 14 }, // Travel End
    { wch: 12 }, // Flight
    { wch: 12 }, // Hotel
    { wch: 12 }, // Rental Car
    { wch: 12 }, // Mileage
    { wch: 14 }, // Total
    { wch: 12 }, // Status
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Travel Overview');

  const fileName = `${(showName || 'Untitled').replace(/[^a-zA-Z0-9 ]/g, '').trim()} - Travel Management.xlsx`;
  XLSX.writeFile(wb, fileName);
  return true;
};
