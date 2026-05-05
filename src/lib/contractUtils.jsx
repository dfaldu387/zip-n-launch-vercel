import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { staffRoles } from '@/lib/staffingData';
import { format, differenceInCalendarDays, isValid } from 'date-fns';
import {
  DollarSign, Calendar, Plane, BaggageClaim, Car, Hotel, Fuel, Clock,
  User, Mail, Phone, Award, Briefcase, Building2, Shield, MapPin,
} from 'lucide-react';

// ─── Auto-Fill Mapping (PBB/Show → Contract) ───────────────────────────────

const PBB_TO_CONTRACT_ROLE_MAP = {
  show_manager: 'SHOW_MANAGER',
  show_secretary: 'SHOW_SECRETARY',
  office_assistant: 'OFFICE_ASSISTANT',
  show_steward: 'SHOW_STEWARD',
  trail_course_designer: 'TRAIL_COURSE_DESIGNER',
  jump_course_designer: 'JUMP_COURSE_DESIGNER',
  scribe_ring_steward: 'SCRIBE_RING_STEWARD',
  equipment_provider: 'EQUIPMENT_PROVIDER',
};

function createContractStaffMember(assocId, roleId, source = {}) {
  return {
    id: uuidv4(),
    association_id: assocId,
    role_id: roleId,
    name: source.name || '',
    email: source.email || '',
    phone: source.phone || '',
    cards_held: '',
    employment_start_date: null,
    employment_end_date: null,
    day_fee: null,
    has_overtime: false,
    overtime_hours_threshold: 10,
    overtime_rate_per_hour: null,
    reimbursable_expenses: {},
  };
}

export function mapOfficialsFromProject(pd) {
  const result = {};
  const associationIds = Object.keys(pd.associations || {}).filter(k => pd.associations[k]);
  if (associationIds.length === 0) return result;

  const pbbOfficials = (pd.officials || []).filter(o => o.name?.trim());

  if (pbbOfficials.length > 0) {
    for (const assocId of associationIds) {
      if (!result[assocId]) result[assocId] = {};

      for (const official of pbbOfficials) {
        const contractRoleId = PBB_TO_CONTRACT_ROLE_MAP[official.roleId] || official.roleId?.toUpperCase();
        if (!contractRoleId) continue;

        if (!result[assocId][contractRoleId]) {
          result[assocId][contractRoleId] = [];
        }
        result[assocId][contractRoleId].push(
          createContractStaffMember(assocId, contractRoleId, official)
        );
      }
    }
  }

  // Map judges from old PBB format (associationJudges)
  const pbbJudges = pd.associationJudges || {};
  for (const assocId of associationIds) {
    const judgeData = pbbJudges[assocId];
    if (!judgeData?.judges?.length) continue;

    if (!result[assocId]) result[assocId] = {};
    if (!result[assocId]['JUDGE']) result[assocId]['JUDGE'] = [];

    for (const judge of judgeData.judges) {
      if (!judge.name?.trim()) continue;
      result[assocId]['JUDGE'].push(
        createContractStaffMember(assocId, 'JUDGE', judge)
      );
    }
  }

  // Map judges from new PBB format (showDetails.judges via OfficialsStaffSection)
  const newJudges = pd.showDetails?.judges || {};
  for (const assocId of associationIds) {
    const judgeList = newJudges[assocId];
    if (!judgeList?.length) continue;

    // Skip if we already mapped judges for this association from the old format
    if (result[assocId]?.['JUDGE']?.length > 0) continue;

    if (!result[assocId]) result[assocId] = {};
    if (!result[assocId]['JUDGE']) result[assocId]['JUDGE'] = [];

    for (const judge of judgeList) {
      if (!judge.name?.trim()) continue;
      result[assocId]['JUDGE'].push(
        createContractStaffMember(assocId, 'JUDGE', judge)
      );
    }
  }

  // Map staff from new PBB format (showDetails.officials via OfficialsStaffSection)
  const newOfficials = pd.showDetails?.officials || {};
  for (const assocId of associationIds) {
    const assocRoles = newOfficials[assocId];
    if (!assocRoles) continue;

    if (!result[assocId]) result[assocId] = {};

    for (const [roleId, members] of Object.entries(assocRoles)) {
      // Skip judges — already handled above
      if (roleId === 'JUDGE') continue;
      // Skip if we already mapped this role from the old format
      if (result[assocId][roleId]?.length > 0) continue;

      for (const member of members) {
        if (!member.name?.trim()) continue;
        if (!result[assocId][roleId]) result[assocId][roleId] = [];
        result[assocId][roleId].push(
          createContractStaffMember(assocId, roleId, member)
        );
      }
    }
  }

  return result;
}

export function applyLinkedProjectData(prev, project) {
  const pd = project.project_data || {};
  const mappedOfficials = mapOfficialsFromProject(pd);
  // Preserve existing contract officials if they already have data;
  // only use mapped officials if the contract has none yet.
  const existingOfficials = prev.showDetails?.officials || {};
  const hasExistingOfficials = Object.keys(existingOfficials).some(
    assocId => Object.keys(existingOfficials[assocId] || {}).some(
      roleId => (existingOfficials[assocId][roleId] || []).length > 0
    )
  );
  return {
    ...prev,
    linkedProjectId: project.id,
    showName: project.project_name || prev.showName,
    showNumber: pd.showNumber || prev.showNumber,
    associations: pd.associations || prev.associations,
    subAssociationSelections: pd.subAssociationSelections || prev.subAssociationSelections,
    primaryAffiliates: pd.primaryAffiliates || prev.primaryAffiliates,
    customAssociations: pd.customAssociations || prev.customAssociations,
    contractSettings: {
      ...prev.contractSettings,
      effectiveDate: pd.startDate || prev.contractSettings?.effectiveDate || '',
      expirationDate: pd.endDate || prev.contractSettings?.expirationDate || '',
    },
    showDetails: {
      ...prev.showDetails,
      officials: hasExistingOfficials ? existingOfficials : mappedOfficials,
    },
  };
}

// ─── Default Contract Template ─────────────────────────────────────────────────

export const DEFAULT_CONTRACT_TEMPLATE = `EMPLOYMENT CONTRACT

This Employment Contract ("Agreement") is entered into as of {{EFFECTIVE_DATE}}, by and between the Show Management of {{SHOW_NAME}} ("Employer") and {{EMPLOYEE_NAME}} ("Employee").

POSITION & DUTIES
Employee shall serve in the capacity of {{POSITION}} for the {{SHOW_NAME}} event, under the jurisdiction of {{ASSOCIATION_NAME}}.

TERM OF EMPLOYMENT
This Agreement shall commence on {{EMPLOYMENT_START}} and shall terminate on {{EMPLOYMENT_END}}, for a total of {{EMPLOYMENT_DAYS}} working day(s).

COMPENSATION
Employee shall receive a day rate of {{DAY_FEE}} per day, for a total compensation of {{TOTAL_DAY_PAY}} for the employment period.

Payment shall be made via {{PAYMENT_METHOD}}.

REIMBURSABLE EXPENSES
The following expenses shall be reimbursed as outlined:
- Airfare: {{EXPENSE_AIRFARE}}
- Baggage: {{EXPENSE_BAGGAGE}}
- Airport Parking: {{EXPENSE_AIRPORT_PARKING}}
- Tolls: {{EXPENSE_TOLLS}}
- Fuel: {{EXPENSE_FUEL}}
- Rental Car: {{EXPENSE_RENTAL_CAR}}
- Per Diem: {{EXPENSE_PER_DIEM}}
- Hotel: {{EXPENSE_HOTEL}}
- Mileage: {{EXPENSE_MILEAGE}}

Total Reimbursable Expenses: {{TOTAL_EXPENSES}}
Total Compensation (including expenses): {{TOTAL_COMPENSATION}}

SIGNATURES
Employee: ________________________  Date: ____________
{{EMPLOYEE_NAME}}
{{EMPLOYEE_EMAIL}} | {{EMPLOYEE_PHONE}}

Employer: ________________________  Date: ____________
Show Management, {{SHOW_NAME}}`;

// ─── Placeholder Registry ──────────────────────────────────────────────────────

export const PLACEHOLDER_GROUPS = [
  {
    group: 'Employee Info',
    placeholders: [
      { tag: '{{EMPLOYEE_NAME}}', label: 'Employee Name', icon: User },
      { tag: '{{EMPLOYEE_EMAIL}}', label: 'Email', icon: Mail },
      { tag: '{{EMPLOYEE_PHONE}}', label: 'Phone', icon: Phone },
      { tag: '{{EMPLOYEE_CARDS}}', label: 'Cards/License', icon: Award },
    ],
  },
  {
    group: 'Role & Show',
    placeholders: [
      { tag: '{{POSITION}}', label: 'Position', icon: Briefcase },
      { tag: '{{SHOW_NAME}}', label: 'Show Name', icon: Building2 },
      { tag: '{{ASSOCIATION_NAME}}', label: 'Association', icon: Shield },
    ],
  },
  {
    group: 'Compensation',
    placeholders: [
      { tag: '{{DAY_FEE}}', label: 'Day Fee', icon: DollarSign },
      { tag: '{{TOTAL_DAY_PAY}}', label: 'Total Day Pay', icon: DollarSign },
      { tag: '{{EMPLOYMENT_DAYS}}', label: 'Days', icon: Calendar },
      { tag: '{{EMPLOYMENT_START}}', label: 'Start Date', icon: Calendar },
      { tag: '{{EMPLOYMENT_END}}', label: 'End Date', icon: Calendar },
      { tag: '{{OVERTIME_THRESHOLD}}', label: 'OT Threshold', icon: Clock },
      { tag: '{{OVERTIME_RATE}}', label: 'OT Rate', icon: DollarSign },
    ],
  },
  {
    group: 'Expenses',
    placeholders: [
      { tag: '{{EXPENSE_AIRFARE}}', label: 'Airfare', icon: Plane },
      { tag: '{{EXPENSE_BAGGAGE}}', label: 'Baggage', icon: BaggageClaim },
      { tag: '{{EXPENSE_AIRPORT_PARKING}}', label: 'Parking', icon: Car },
      { tag: '{{EXPENSE_TOLLS}}', label: 'Tolls', icon: DollarSign },
      { tag: '{{EXPENSE_FUEL}}', label: 'Fuel', icon: Fuel },
      { tag: '{{EXPENSE_RENTAL_CAR}}', label: 'Rental Car', icon: Car },
      { tag: '{{EXPENSE_PER_DIEM}}', label: 'Per Diem', icon: DollarSign },
      { tag: '{{EXPENSE_HOTEL}}', label: 'Hotel', icon: Hotel },
      { tag: '{{EXPENSE_MILEAGE}}', label: 'Mileage', icon: MapPin },
    ],
  },
  {
    group: 'Totals',
    placeholders: [
      { tag: '{{TOTAL_EXPENSES}}', label: 'Total Expenses', icon: DollarSign },
      { tag: '{{TOTAL_COMPENSATION}}', label: 'Total Comp.', icon: DollarSign },
    ],
  },
  {
    group: 'Contract Settings',
    placeholders: [
      { tag: '{{EFFECTIVE_DATE}}', label: 'Effective Date', icon: Calendar },
      { tag: '{{EXPIRATION_DATE}}', label: 'Expiration Date', icon: Calendar },

      { tag: '{{PAYMENT_METHOD}}', label: 'Payment Method', icon: DollarSign },
      { tag: '{{SIGNING_DEADLINE}}', label: 'Signing Deadline', icon: Calendar },
    ],
  },
];

// ─── Expense Type Metadata ─────────────────────────────────────────────────────

export const expenseTypeMeta = {
  airfare: { label: 'Airfare', icon: Plane, isPerDay: false },
  baggage: { label: 'Baggage', icon: BaggageClaim, isPerDay: false },
  airportParking: { label: 'Airport Parking', icon: Car, isPerDay: true },
  tolls: { label: 'Tolls', icon: DollarSign, isPerDay: false },
  fuel: { label: 'Fuel to/from Airport', icon: Fuel, isPerDay: false },
  rentalCar: { label: 'Rental Car', icon: Car, isPerDay: true },
  perDiem: { label: 'Per Diem', icon: DollarSign, isPerDay: true },
  hotel: { label: 'Hotel', icon: Hotel, isPerDay: true },
  mileage: { label: 'Mileage', icon: MapPin, isMileage: true },
};

// ─── Budget Freeze ───────────────────────────────────────────────────────────

export const isBudgetFrozen = (formData) => {
  const folders = formData?.employeeFolders;
  if (!folders || typeof folders !== 'object') return false;
  return Object.values(folders).some(
    (f) => f.signatureStatus && f.signatureStatus !== 'not_sent'
  );
};

export const isMemberFrozen = (memberId, formData) => {
  const folder = formData?.employeeFolders?.[memberId];
  if (!folder) return false;
  return !!folder.signatureStatus && folder.signatureStatus !== 'not_sent';
};

// ─── Helper Functions ──────────────────────────────────────────────────────────

export const currency = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? '$0.00' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

export const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    return isValid(d) ? format(d, 'PPP') : '';
  } catch {
    return '';
  }
};

export const calculateDays = (startDate, endDate, isHotel = false) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (!isValid(start) || !isValid(end) || start > end) return 0;
  const diff = differenceInCalendarDays(end, start);
  return isHotel ? diff : diff + 1;
};

export const flattenPersonnel = (formData) => {
  const officials = formData?.showDetails?.officials || {};
  const result = [];
  for (const assocId of Object.keys(officials)) {
    for (const roleId of Object.keys(officials[assocId])) {
      const members = officials[assocId][roleId] || [];
      const role = staffRoles[roleId];
      const roleName = roleId === 'CUSTOM' ? null : (role?.name || roleId);
      for (const member of members) {
        result.push({
          ...member,
          assocId,
          roleId,
          roleName: member.custom_role_name || roleName || 'Unknown Role',
        });
      }
    }
  }
  return result;
};

export const calculateMemberFinancials = (member) => {
  const employmentDays = calculateDays(member.employment_start_date, member.employment_end_date);
  const dayFee = parseFloat(member.day_fee) || 0;
  const totalDayFee = employmentDays * dayFee;

  const expenseBreakdown = {};
  let totalExpenses = 0;

  if (member.reimbursable_expenses) {
    for (const [expId, expense] of Object.entries(member.reimbursable_expenses)) {
      if (expense.reimbursed) {
        const meta = expenseTypeMeta[expId];
        const amount = (meta?.isPerDay || meta?.isMileage)
          ? (parseFloat(expense.total) || 0)
          : (parseFloat(expense.max_value) || 0);
        expenseBreakdown[expId] = amount;
        totalExpenses += amount;
      }
    }
  }

  return {
    employmentDays,
    dayFee,
    totalDayFee,
    expenseBreakdown,
    totalExpenses,
    totalCompensation: totalDayFee + totalExpenses,
    hasOvertime: member.has_overtime,
    overtimeThreshold: member.overtime_hours_threshold,
    overtimeRate: member.overtime_rate_per_hour,
  };
};

export const getTravelMethod = (member) => {
  const expenses = member.reimbursable_expenses || {};
  if (expenses.airfare?.reimbursed) return { label: 'Air Travel', icon: Plane };
  if (expenses.rentalCar?.reimbursed) return { label: 'Rental Car', icon: Car };
  if (expenses.fuel?.reimbursed) return { label: 'Driving', icon: Car };
  return { label: 'Not specified', icon: null };
};

export const resolvePlaceholders = (templateText, member, formData) => {
  const financials = calculateMemberFinancials(member);
  const contractSettings = formData.contractSettings || {};
  const showName = formData.selectedShow?.name || formData.showName || '';
  const fmt = (val) => (val != null && val !== '') ? String(val) : '';

  const expenseLabel = (expId) => {
    const expense = member.reimbursable_expenses?.[expId];
    if (!expense?.reimbursed) return 'N/A';
    return currency(financials.expenseBreakdown[expId] || 0);
  };

  const paymentMethodMap = {
    check: 'Check', direct_deposit: 'Direct Deposit',
    wire: 'Wire Transfer', paypal: 'PayPal',
  };

  const replacements = {
    '{{EMPLOYEE_NAME}}': fmt(member.name),
    '{{EMPLOYEE_EMAIL}}': fmt(member.email),
    '{{EMPLOYEE_PHONE}}': fmt(member.phone),
    '{{EMPLOYEE_CARDS}}': fmt(member.cards_held),
    '{{POSITION}}': fmt(member.roleName),
    '{{SHOW_NAME}}': fmt(showName),
    '{{ASSOCIATION_NAME}}': fmt(member.assocId),
    '{{DAY_FEE}}': currency(financials.dayFee),
    '{{TOTAL_DAY_PAY}}': currency(financials.totalDayFee),
    '{{EMPLOYMENT_DAYS}}': String(financials.employmentDays),
    '{{EMPLOYMENT_START}}': formatDate(member.employment_start_date),
    '{{EMPLOYMENT_END}}': formatDate(member.employment_end_date),
    '{{OVERTIME_THRESHOLD}}': financials.hasOvertime ? `${financials.overtimeThreshold || 10} hours` : 'N/A',
    '{{OVERTIME_RATE}}': financials.hasOvertime ? currency(financials.overtimeRate) : 'N/A',
    '{{EXPENSE_AIRFARE}}': expenseLabel('airfare'),
    '{{EXPENSE_BAGGAGE}}': expenseLabel('baggage'),
    '{{EXPENSE_AIRPORT_PARKING}}': expenseLabel('airportParking'),
    '{{EXPENSE_TOLLS}}': expenseLabel('tolls'),
    '{{EXPENSE_FUEL}}': expenseLabel('fuel'),
    '{{EXPENSE_RENTAL_CAR}}': expenseLabel('rentalCar'),
    '{{EXPENSE_PER_DIEM}}': expenseLabel('perDiem'),
    '{{EXPENSE_HOTEL}}': expenseLabel('hotel'),
    '{{EXPENSE_MILEAGE}}': expenseLabel('mileage'),
    '{{TOTAL_EXPENSES}}': currency(financials.totalExpenses),
    '{{TOTAL_COMPENSATION}}': currency(financials.totalCompensation),
    '{{EFFECTIVE_DATE}}': formatDate(contractSettings.effectiveDate),
    '{{EXPIRATION_DATE}}': formatDate(contractSettings.expirationDate),

    '{{PAYMENT_METHOD}}': paymentMethodMap[contractSettings.paymentMethod] || fmt(contractSettings.paymentMethod),
    '{{SIGNING_DEADLINE}}': formatDate(contractSettings.signingDeadline),
  };

  let result = templateText;
  for (const [tag, value] of Object.entries(replacements)) {
    if (value && value !== '') {
      result = result.replaceAll(tag, value);
    }
  }
  return result;
};

export const countPlaceholders = (text) => {
  const matches = text.match(/\{\{[A-Z_]+\}\}/g);
  return matches ? new Set(matches).size : 0;
};

export const renderResolvedPreview = (resolvedText) => {
  const parts = resolvedText.split(/(\{\{[A-Z_]+\}\})/g);
  return parts.map((part, i) => {
    if (/^\{\{[A-Z_]+\}\}$/.test(part)) {
      return (
        <span key={i} className="text-amber-500 bg-amber-500/10 px-0.5 rounded text-xs font-semibold">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

// ─── Shared Sub-Component ──────────────────────────────────────────────────────

export const PlaceholderToolbar = ({ onInsert }) => {
  return (
    <div className="space-y-2">
      {PLACEHOLDER_GROUPS.map((group) => (
        <div key={group.group} className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-20 shrink-0">
            {group.group}
          </span>
          {group.placeholders.map((ph) => {
            const Icon = ph.icon;
            return (
              <button
                key={ph.tag}
                type="button"
                onClick={() => onInsert(ph.tag)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium border rounded-md
                  bg-muted/50 hover:bg-primary/10 hover:border-primary/50 hover:text-primary
                  transition-colors cursor-pointer"
              >
                <Icon className="h-3 w-3" />
                {ph.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
