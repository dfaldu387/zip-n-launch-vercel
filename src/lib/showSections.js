// Route map for a show's scoped tool sections. Keys mirror SHOW_SECTIONS in
// HorseShowManagerPage.jsx (Manage Access section picker) and the `modules`
// list in ShowWorkspacePage.jsx — an admin's `sections` entry uses these keys.
// Kept here too so StaffPortalPage can navigate straight to a scoped tool
// without importing a page component's local module list.
export const SHOW_SECTION_ROUTES = {
  editWizard: (showId) => `/horse-show-manager/edit/${showId}`,
  showStructure: (showId) => `/horse-show-manager/show-structure-expenses/${showId}`,
  feeStructure: (showId) => `/horse-show-manager/fee-structure/${showId}`,
  contracts: (showId) => `/horse-show-manager/employee-management/contracts?showId=${showId}`,
  patternBook: (showId) => `/horse-show-manager/show/${showId}`,
  budgeting: (showId) => `/horse-show-manager/employee-budgeting/${showId}`,
  employeeScheduling: (showId) => `/horse-show-manager/employee-scheduling/${showId}`,
  equipment: (showId) => `/horse-show-manager/equipment-planning/${showId}`,
  results: (showId) => `/horse-show-manager/results-management/${showId}`,
  awards: (showId) => `/horse-show-manager/awards-management/${showId}`,
  financials: (showId) => `/horse-show-manager/financials/${showId}`,
  housing: (showId) => `/horse-show-manager/housing-grounds-manager/${showId}`,
};

export const SHOW_SECTION_TITLES = {
  editWizard: 'Edit Show Wizard',
  showStructure: 'Show Structure & Expenses',
  feeStructure: 'Fee Structure & Sponsors',
  contracts: 'Contract Management',
  patternBook: 'Pattern Book',
  budgeting: 'Employee Budgeting Tool',
  employeeScheduling: 'Employee / Arena Scheduling',
  equipment: 'Equipment Management',
  results: 'Results Entry',
  awards: 'Awards Management',
  financials: 'Financials & Analytics',
  housing: 'Housing & Grounds Manager',
};

// Where a click on a show/role entry should land: Full Admin (and anyone with
// more than one section) goes to the show's hub; a Section Admin scoped to
// exactly one section jumps straight to that tool.
export const routeForShowAccess = (showId, role, sections = []) => {
  if (role === 'section_admin' && sections.length === 1 && SHOW_SECTION_ROUTES[sections[0]]) {
    return SHOW_SECTION_ROUTES[sections[0]](showId);
  }
  return `/horse-show-manager/show/${showId}`;
};
