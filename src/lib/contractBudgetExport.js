import * as XLSX from 'xlsx';
import { flattenPersonnel, calculateMemberFinancials, expenseTypeMeta } from '@/lib/contractUtils';

/**
 * Export fully itemized budget as an Excel (.xlsx) file.
 * Columns: Name | Role | Association | Days | Day Rate | Day Pay |
 *          Airfare | Baggage | Airport Parking | Tolls | Fuel | Rental Car | Per Diem | Hotel |
 *          Total Expenses | Total
 */

const EXPENSE_COLUMNS = [
  { key: 'airfare',        label: 'Airfare' },
  { key: 'baggage',        label: 'Baggage' },
  { key: 'airportParking', label: 'Airport Parking' },
  { key: 'tolls',          label: 'Tolls' },
  { key: 'fuel',           label: 'Fuel' },
  { key: 'rentalCar',      label: 'Rental Car' },
  { key: 'perDiem',        label: 'Per Diem' },
  { key: 'hotel',          label: 'Hotel' },
  { key: 'mileage',        label: 'Mileage' },
];

// Numeric columns that get summed in the totals row
const SUM_KEYS = ['Days', 'Day Pay', ...EXPENSE_COLUMNS.map(e => e.label), 'Expenses', 'Total'];

export const exportBudgetToExcel = (formData) => {
  const personnel = flattenPersonnel(formData);
  if (personnel.length === 0) return false;

  const showName = formData.showName || 'Untitled Show';

  // Build rows
  const rows = personnel.map((member) => {
    const fin = calculateMemberFinancials(member);
    const row = {
      Name: member.name || 'Unnamed',
      Role: member.roleName || '',
      Association: member.assocId || '',
      Days: fin.employmentDays,
      'Day Rate': fin.dayFee,
      'Day Pay': fin.totalDayFee,
    };

    // Add each expense type as its own column
    for (const col of EXPENSE_COLUMNS) {
      row[col.label] = fin.expenseBreakdown[col.key] || 0;
    }

    row['Expenses'] = fin.totalExpenses;
    row['Total'] = fin.totalCompensation;
    return row;
  });

  // Add totals row
  const totals = { Name: 'TOTAL', Role: '', Association: '', 'Day Rate': '' };
  for (const key of SUM_KEYS) {
    totals[key] = rows.reduce((sum, r) => sum + (r[key] || 0), 0);
  }
  rows.push(totals);

  // Create workbook
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 22 }, // Name
    { wch: 18 }, // Role
    { wch: 14 }, // Association
    { wch: 6 },  // Days
    { wch: 12 }, // Day Rate
    { wch: 12 }, // Day Pay
    { wch: 12 }, // Airfare
    { wch: 12 }, // Baggage
    { wch: 16 }, // Airport Parking
    { wch: 10 }, // Tolls
    { wch: 10 }, // Fuel
    { wch: 12 }, // Rental Car
    { wch: 12 }, // Per Diem
    { wch: 12 }, // Hotel
    { wch: 12 }, // Mileage
    { wch: 14 }, // Expenses
    { wch: 14 }, // Total
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Budget');

  // Download
  const fileName = `${showName.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Budget'} - Contract Budget.xlsx`;
  XLSX.writeFile(wb, fileName);
  return true;
};
