import * as XLSX from 'xlsx';
import { parseDivisionId } from '@/lib/showBillUtils';

const TIMING_LABELS = {
  before_show: 'Before Show',
  during_show: 'During Show',
  after_show: 'After Show',
};

const UNIT_LABELS = {
  flat: 'Flat Fee',
  per_day: 'Per Day',
  per_head: 'Per Head',
  per_hour: 'Per Hour',
  per_unit: 'Per Unit',
  per_person: 'Per Person',
};

const PAYMENT_TIMING_LABELS = {
  pre_entry: 'Pre-Entry / Reservation',
  at_check_in: 'At Check-In',
  settlement: 'Post-Show / Settlement',
  custom_timing: 'Custom Timing',
};

const FEE_UNIT_LABELS = {
  flat: 'Flat Fee',
  per_horse: 'Per Horse',
  per_night: 'Per Night',
  per_bag: 'Per Bag',
  per_class: 'Per Class',
};

const getFeeUnitLabel = (fee) => {
  if (fee.unit_type === 'custom' && fee.custom_unit_label) return fee.custom_unit_label;
  return FEE_UNIT_LABELS[fee.unit_type] || FEE_UNIT_LABELS[fee.type] || 'Flat Fee';
};

/**
 * Export show budget (fees + expenses + profit/loss) as an Excel file.
 */
export const exportShowBudgetToExcel = (formData) => {
  const fees = formData.fees || [];
  const expenses = formData.showExpenses || [];
  const showName = formData.showName || 'Untitled Show';

  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Income (Fees + Sponsorship) ---
  const sponsorshipItems = formData.sponsorshipRevenue || [];

  const emptyFeeRow = { Name: '', 'Unit Type': '', Amount: '', 'Payment Timing': '', 'Per Judge': '', Notes: '' };

  const feeRows = fees.map(fee => ({
    'Name': fee.name || '',
    'Unit Type': getFeeUnitLabel(fee),
    'Amount': parseFloat(fee.amount) || 0,
    'Payment Timing': PAYMENT_TIMING_LABELS[fee.payment_timing] || fee.payment_timing || '',
    'Per Judge': fee.apply_per_judge ? 'Yes' : 'No',
    'Notes': fee.notes || '',
  }));
  const totalFeeIncome = feeRows.reduce((sum, r) => sum + r['Amount'], 0);
  feeRows.push({ ...emptyFeeRow, Name: 'SUBTOTAL FEE REVENUE', Amount: totalFeeIncome });

  feeRows.push({ ...emptyFeeRow });
  for (const sponsor of sponsorshipItems.filter(s => s.name)) {
    feeRows.push({
      ...emptyFeeRow,
      Name: sponsor.name,
      'Unit Type': 'Sponsorship',
      Amount: parseFloat(sponsor.amount) || 0,
      Notes: sponsor.notes || '',
    });
  }
  const totalSponsorship = sponsorshipItems.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  feeRows.push({ ...emptyFeeRow, Name: 'SUBTOTAL SPONSORSHIP', Amount: totalSponsorship });

  const totalIncome = totalFeeIncome + totalSponsorship;
  feeRows.push({ ...emptyFeeRow });
  feeRows.push({ ...emptyFeeRow, Name: 'TOTAL INCOME', Amount: totalIncome });

  const wsFees = XLSX.utils.json_to_sheet(feeRows);
  wsFees['!cols'] = [
    { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 10 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsFees, 'Income');

  // --- Sheet 2: Expenses (grouped by category hierarchy) ---
  const awardExpenses = formData.awardExpenses || [];
  const classAwards = formData.classAwards || {};
  const expenseRows = [];
  let totalShowExpenses = 0;

  const emptyExpenseRow = { Category: '', Item: '', Amount: '', Unit: '', Qty: '', Timing: '', 'Due Date': '', 'Line Total': '', Notes: '' };

  // Known category labels for display
  const CATEGORY_LABELS = {
    facilities: 'Facilities',
    operations: 'Operations',
    marketing: 'Marketing',
    equipment: 'Equipment',
    hospitality: 'Hospitality',
  };

  // Group expenses by category, preserving user's sort order
  const categoryIds = [];
  const byCategory = {};
  for (const expense of expenses) {
    if (!expense.name) continue;
    const cat = expense.category || 'other';
    if (!byCategory[cat]) {
      byCategory[cat] = [];
      categoryIds.push(cat);
    }
    byCategory[cat].push(expense);
  }

  for (const catId of categoryIds) {
    const catLabel = CATEGORY_LABELS[catId] || catId;
    const catExpenses = byCategory[catId];
    // Category header row
    expenseRows.push({ ...emptyExpenseRow, Category: catLabel });
    let catTotal = 0;
    for (const expense of catExpenses) {
      const unitCost = parseFloat(expense.amount) || 0;
      const qty = parseInt(expense.quantity) || 1;
      const lineTotal = unitCost * qty;
      catTotal += lineTotal;
      totalShowExpenses += lineTotal;
      expenseRows.push({
        Category: catLabel,
        Item: expense.name,
        Amount: unitCost,
        Unit: UNIT_LABELS[expense.unit] || expense.unit || 'Flat Fee',
        Qty: qty,
        Timing: TIMING_LABELS[expense.timing] || '',
        'Due Date': expense.dueDate || '',
        'Line Total': lineTotal,
        Notes: expense.notes || '',
      });
    }
    expenseRows.push({ ...emptyExpenseRow, Category: `Subtotal ${catLabel}`, 'Line Total': catTotal });
    expenseRows.push({ ...emptyExpenseRow });
  }

  expenseRows.push({ ...emptyExpenseRow, Category: 'SUBTOTAL SHOW EXPENSES', 'Line Total': totalShowExpenses });

  // Award expenses
  expenseRows.push({ ...emptyExpenseRow });
  expenseRows.push({ ...emptyExpenseRow, Category: 'Awards' });
  for (const award of awardExpenses.filter(a => a.name)) {
    const lineTotal = (parseFloat(award.amount) || 0) * (parseInt(award.qty) || 1);
    expenseRows.push({
      Category: 'Awards',
      Item: award.name,
      Amount: parseFloat(award.amount) || 0,
      Unit: '',
      Qty: parseInt(award.qty) || 1,
      Timing: '',
      'Due Date': '',
      'Line Total': lineTotal,
      Notes: award.qty > 1 ? `${award.qty} x $${award.amount}` : '',
    });
  }
  const totalAwardExp = awardExpenses.reduce((sum, a) => sum + ((parseFloat(a.amount) || 0) * (parseInt(a.qty) || 1)), 0);
  // Support both legacy (budget field) and new (items array) class awards format
  const totalClassAwards = Object.values(classAwards).reduce((sum, ca) => {
    const items = ca.items || [];
    if (items.length === 0 && ca.budget) return sum + (parseFloat(ca.budget) || 0);
    return sum + items.reduce((s, i) => s + ((parseFloat(i.cost) || 0) * (parseInt(i.qty) || 1)), 0);
  }, 0);
  if (totalClassAwards > 0) {
    expenseRows.push({ ...emptyExpenseRow, Item: 'Class Awards Budget', Category: 'Awards', 'Line Total': totalClassAwards });
  }
  expenseRows.push({ ...emptyExpenseRow, Category: 'SUBTOTAL AWARD EXPENSES', 'Line Total': totalAwardExp + totalClassAwards });

  const totalExpenses = totalShowExpenses + totalAwardExp + totalClassAwards;
  expenseRows.push({ ...emptyExpenseRow });
  expenseRows.push({ ...emptyExpenseRow, Category: 'TOTAL EXPENSES', 'Line Total': totalExpenses });

  const wsExpenses = XLSX.utils.json_to_sheet(expenseRows);
  wsExpenses['!cols'] = [
    { wch: 32 }, { wch: 24 }, { wch: 12 }, { wch: 6 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');

  // --- Sheet 3: Class Awards ---
  const classAwardRows = [];
  const disciplines = formData.disciplines || [];
  for (const disc of disciplines) {
    for (const divId of (disc.divisionOrder || [])) {
      const divName = disc.divisionPrintTitles?.[divId] || parseDivisionId(divId).divisionName;
      const ca = classAwards[divId] || {};
      const items = ca.items || [];
      if (items.length === 0) continue;
      for (const item of items) {
        const lineTotal = (parseFloat(item.cost) || 0) * (parseInt(item.qty) || 1);
        classAwardRows.push({
          Division: divName,
          Class: disc.name,
          Placement: item.placement || '',
          Type: item.type || '',
          Description: item.description || '',
          Cost: parseFloat(item.cost) || 0,
          Qty: parseInt(item.qty) || 1,
          'Line Total': lineTotal,
        });
      }
    }
  }
  if (classAwardRows.length > 0) {
    classAwardRows.push({ Division: '', Class: '', Placement: '', Type: '', Description: '', Cost: '', Qty: '', 'Line Total': '' });
    classAwardRows.push({ Division: 'TOTAL CLASS AWARDS', Class: '', Placement: '', Type: '', Description: '', Cost: '', Qty: '', 'Line Total': totalClassAwards });
    const wsClassAwards = XLSX.utils.json_to_sheet(classAwardRows);
    wsClassAwards['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 10 }, { wch: 6 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsClassAwards, 'Class Awards');
  }

  // --- Sheet 4: Budget Summary ---
  const summaryRows = [
    { 'Item': 'Fee Revenue', 'Amount': totalFeeIncome },
    { 'Item': 'Sponsorship Revenue', 'Amount': totalSponsorship },
    { 'Item': 'Total Revenue', 'Amount': totalIncome },
    { 'Item': '', 'Amount': '' },
    { 'Item': 'Total Expenses', 'Amount': totalExpenses },
    { 'Item': '', 'Amount': '' },
    { 'Item': 'Projected Profit / Loss', 'Amount': totalIncome - totalExpenses },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Budget Summary');

  // Download
  const fileName = `${showName.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Budget'} - Show Budget.xlsx`;
  XLSX.writeFile(wb, fileName);
  return true;
};
