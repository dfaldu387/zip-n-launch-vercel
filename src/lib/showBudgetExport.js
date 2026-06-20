import * as XLSX from 'xlsx';
import { parseDivisionId } from '@/lib/showBillUtils';
import { computeStructuredAwardsTotal } from '@/lib/showAwardsUtils';

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

/**
 * Export show expenses (categorized expenses + class awards) as an Excel file.
 * Income/fees and profit/loss are intentionally excluded.
 */
export const exportShowBudgetToExcel = (formData) => {
  const expenses = formData.showExpenses || [];
  const showName = formData.showName || 'Untitled Show';

  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Expenses (grouped by category hierarchy) ---
  const awardExpenses = formData.awardExpenses || [];
  const classAwards = formData.classAwards || {};

  // Staff & Officials costs (saved under showDetails.officials, not formData.staff)
  const officials = formData.showDetails?.officials || {};
  const calcStaffDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end) || start > end) return 0;
    return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  };
  const staffRows = [];
  let totalStaffCosts = 0;
  Object.values(officials).forEach(assocRoles => {
    Object.values(assocRoles || {}).forEach(members => {
      (members || []).forEach(member => {
        if (!member?.name) return;
        const autoDays = calcStaffDays(member.employment_start_date, member.employment_end_date);
        const days = member.days_worked != null && member.days_worked !== '' ? (parseFloat(member.days_worked) || 0) : autoDays;
        const dayFee = (parseFloat(member.day_fee) || 0) * days;
        const hourlyFee = (parseFloat(member.hours_worked) || 0) * (parseFloat(member.hourly_rate) || 0);
        const overtimeFee = (parseFloat(member.overtime_hours) || 0) * (parseFloat(member.overtime_rate_per_hour) || 0);
        let reimbursable = 0;
        if (member.reimbursable_expenses) {
          Object.values(member.reimbursable_expenses).forEach(exp => {
            if (exp.reimbursed) reimbursable += parseFloat(exp.total) || parseFloat(exp.max_value) || 0;
          });
        }
        const memberTotal = dayFee + hourlyFee + overtimeFee + reimbursable;
        totalStaffCosts += memberTotal;
        staffRows.push({ name: member.name, total: memberTotal });
      });
    });
  });

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

  // Staff & Officials
  if (totalStaffCosts > 0) {
    expenseRows.push({ ...emptyExpenseRow });
    expenseRows.push({ ...emptyExpenseRow, Category: 'Staff & Officials' });
    for (const s of staffRows) {
      expenseRows.push({ ...emptyExpenseRow, Category: 'Staff & Officials', Item: s.name, 'Line Total': s.total });
    }
    expenseRows.push({ ...emptyExpenseRow, Category: 'SUBTOTAL STAFF & OFFICIALS', 'Line Total': totalStaffCosts });
  }

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
  // Structured awards (High Point / Circuit / Special)
  const { structuredTotal: structuredAwardsTotal } = computeStructuredAwardsTotal(formData);
  if (structuredAwardsTotal > 0) {
    expenseRows.push({ ...emptyExpenseRow, Item: 'High Point / Circuit / Special Awards', Category: 'Awards', 'Line Total': structuredAwardsTotal });
  }
  expenseRows.push({ ...emptyExpenseRow, Category: 'SUBTOTAL AWARD EXPENSES', 'Line Total': totalAwardExp + totalClassAwards + structuredAwardsTotal });

  const totalExpenses = totalShowExpenses + totalStaffCosts + totalAwardExp + totalClassAwards + structuredAwardsTotal;
  expenseRows.push({ ...emptyExpenseRow });
  expenseRows.push({ ...emptyExpenseRow, Category: 'TOTAL EXPENSES', 'Line Total': totalExpenses });

  const wsExpenses = XLSX.utils.json_to_sheet(expenseRows);
  wsExpenses['!cols'] = [
    { wch: 32 }, { wch: 24 }, { wch: 12 }, { wch: 6 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');

  // --- Sheet 2: Class Awards ---
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

  // Download
  const fileName = `${showName.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Expenses'} - Show Expenses.xlsx`;
  XLSX.writeFile(wb, fileName);
  return true;
};
