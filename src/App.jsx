import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import HomePage from '@/pages/HomePage';
import CustomizePage from '@/pages/CustomizePage';
import ContributorPortalPage from '@/pages/ContributorPortalPage';
import ContributorsPage from '@/pages/ContributorsPage';
import EventsPage from '@/pages/EventsPage';
import ScoreSheetsPage from '@/pages/ScoreSheetsPage';
import QRCodePage from '@/pages/QRCodePage';
import SponsorshipPage from '@/pages/SponsorshipPage';
import SocialMediaPage from '@/pages/SocialMediaPage';
import EventDetailPage from '@/pages/EventDetailPage';
import DatabaseSchemaPage from '@/pages/DatabaseSchemaPage';
import AdminPage from '@/pages/AdminPage';
import PatternHubPage from '@/pages/PatternHubPage';
import ProductDetailPage from '@/pages/ProductDetailPage';
import SuccessPage from '@/pages/SuccessPage';
import PatternBookBuilderPage from '@/pages/PatternBookBuilderPage';
import ShowScheduleAnalyticsPage from '@/pages/ShowScheduleAnalyticsPage';
import DataLearningCenterPage from '@/pages/DataLearningCenterPage';
import SponsorshipAnalyticsPage from '@/pages/SponsorshipAnalyticsPage';
import FutureIdeasPage from '@/pages/FutureIdeasPage';
import FeeDocumentationPage from '@/pages/FeeDocumentationPage';
import AITrainingManualPage from '@/pages/AITrainingManualPage';
import SponsorshipIntelligencePage from '@/pages/SponsorshipIntelligencePage';
import AssetLibraryPage from '@/pages/AssetLibraryPage';
import CustomPatternSetPage from '@/pages/CustomPatternSetPage';
import PatternUploadWizardPage from '@/pages/PatternUploadWizardPage';
import ScoreSheetGeneratorPage from '@/pages/ScoreSheetGeneratorPage';
import ScoreSheetQRDownloadPage from '@/pages/ScoreSheetQRDownloadPage';
import ScoreSheetResultsPage from '@/pages/ScoreSheetResultsPage';
import AIScoreSheetManagerPage from '@/pages/AIScoreSheetManagerPage';
import AdminPatternReviewPage from '@/pages/AdminPatternReviewPage';
import AIPatternGeneratorStudioPage from '@/pages/AIPatternGeneratorStudioPage';
import MediaLibraryPage from '@/pages/MediaLibraryPage';
import MediaAssignmentsPage from '@/pages/MediaAssignmentsPage';
import AdminSiteBrandingPage from '@/pages/AdminSiteBrandingPage';
import AdminMarketingContentPage from '@/pages/AdminMarketingContentPage';
import { MediaConfigProvider } from '@/contexts/MediaConfigContext';
import PastEventsPage from '@/pages/PastEventsPage';
import StorePage from '@/pages/StorePage';
import AssetIntelligenceCenterPage from '@/pages/AssetIntelligenceCenterPage';
import CollaborationHubPage from '@/pages/CollaborationHubPage';
import { ThemeProvider } from "@/components/ThemeProvider";
import AuthModal from '@/components/AuthModal';
import SupportWidget from '@/components/SupportWidget';
import CustomerAssetLibraryPage from '@/pages/CustomerAssetLibraryPage';
import CustomerPortalPage from '@/pages/CustomerPortalPage';
import ArchivePatternsPage from '@/pages/ArchivePatternsPage';
import PatternUploadLandingPage from '@/pages/PatternUploadLandingPage';
import HorseShowManagerPage from '@/pages/HorseShowManagerPage';
import CreateShowPage from '@/pages/CreateShowPage';
import ShowStructurePage from '@/pages/ShowStructurePage';
import StallingServiceManagerPage from '@/pages/StallingServiceManagerPage';
import EmployeeArenaSchedulingManagerPage from '@/pages/EmployeeArenaSchedulingManagerPage';
import AwardsPresenterManagerPage from '@/pages/AwardsPresenterManagerPage';
import EmployeeManagementPage from '@/pages/EmployeeManagementPage';
import ContractManagementPage from '@/pages/ContractManagementPage';
import TravelManagementPage from '@/pages/TravelManagementPage';
import UpdatePasswordPage from '@/pages/UpdatePasswordPage';
import ProfilePage from '@/pages/ProfilePage';
import JudgesPortalPage from '@/pages/JudgesPortalPage';
import StaffPortalPage from '@/pages/StaffPortalPage';
import AdminRoute from '@/components/AdminRoute';
import RoleBasedRoute from '@/components/RoleBasedRoute';
import MembershipRoute from '@/components/MembershipRoute';
import NotAuthorizedPage from '@/pages/NotAuthorizedPage';
import AdminUserManagementPage from '@/pages/AdminUserManagementPage';
import AdminDisciplineManagementPage from '@/pages/AdminDisciplineManagementPage';
import AdminAssociationManagementPage from '@/pages/AdminAssociationManagementPage';
import AssociationAssetsPage from '@/pages/AssociationAssetsPage';
import AdminShowManagementPage from '@/pages/AdminShowManagementPage';
import AdminEventsManagementPage from '@/pages/AdminEventsManagementPage';
import AdminSponsorshipPackagesPage from '@/pages/AdminSponsorshipPackagesPage';
import PublicShowPage from '@/pages/PublicShowPage';
import AdminDivisionManagementPage from '@/pages/AdminDivisionManagementPage';
import AdminDivisionLevelManagementPage from '@/pages/AdminDivisionLevelManagementPage';
import ApprovalsDashboardPage from '@/pages/ApprovalsDashboardPage';
import ShowDashboardPage from '@/pages/ShowDashboardPage';
import EquiPatternsDashboard from '@/pages/EquiPatternsDashboard';
import PatternLibraryPage from '@/pages/PatternLibraryPage';
import ScoreSheetLibraryPage from '@/pages/ScoreSheetLibraryPage';
import PacketBuilderPage from '@/pages/PacketBuilderPage';
import DistributionPage from '@/pages/DistributionPage';
import JudgeKioskPage from '@/pages/KioskViews/JudgeKioskPage';
import ScribeKioskPage from '@/pages/KioskViews/ScribeKioskPage';
import AnnouncerKioskPage from '@/pages/KioskViews/AnnouncerKioskPage';
import AuditReportsPage from '@/pages/AuditReportsPage';
import AdminRoleManagementPage from '@/pages/AdminRoleManagementPage';
import AdminPatternExtractorPage from '@/pages/AdminPatternExtractorPage';
import ManualPatternEntryPage from '@/pages/ManualPatternEntryPage';
import AdminTrackingUserPage from '@/pages/AdminTrackingUserPage';
import AdminPatternLevelManagementPage from '@/pages/AdminPatternLevelManagementPage';
import AccountSecurityPage from '@/pages/AccountSecurityPage';
import PolicyPage from '@/pages/PolicyPage';
import SupportPage from '@/pages/SupportPage';
import ScoresheetUploadPage from '@/pages/ScoresheetUploadPage';
import PricingPage from '@/pages/PricingPage';
import BillingHistoryPage from '@/pages/BillingHistoryPage';
import AdminBillingReportPage from '@/pages/AdminBillingReportPage';
import EquipmentManagementPage from '@/pages/EquipmentManagementPage';
import DisciplinePlannerPage from '@/pages/DisciplinePlannerPage';
import ArenaSessionsPage from '@/pages/ArenaSessionsPage';
import EquipmentRequirementsPage from '@/pages/EquipmentRequirementsPage';
import DistributionPlanPage from '@/pages/DistributionPlanPage';
import EquipmentCheckInOutPage from '@/pages/EquipmentCheckInOutPage';
import EquipmentPlanningHubPage from '@/pages/EquipmentPlanningHubPage';
import LocationsPage from '@/pages/LocationsPage';
import ReconciliationPage from '@/pages/ReconciliationPage';
import EquipmentReportsPage from '@/pages/EquipmentReportsPage';
import CreateHorseShowWizardPage from '@/pages/CreateHorseShowWizardPage';
import ShowWorkspacePage from '@/pages/ShowWorkspacePage';
// ScheduleBuilderPage removed — merged into CreateShowPage
import ShowFinancialDashboardPage from '@/pages/ShowFinancialDashboardPage';
// ShowFinancialPickerPage removed — using LinkToExistingShow in dashboard

import EmployeeBudgetingToolPage from '@/pages/EmployeeBudgetingToolPage';
import VenueArenaSetupPage from '@/pages/VenueArenaSetupPage';
import EmployeeSchedulingPage from '@/pages/EmployeeSchedulingPage';
import AwardsManagementPage from '@/pages/AwardsManagementPage';
import ResultsManagementPage from '@/pages/ResultsManagementPage';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';

function App() {
  return (
      <MediaConfigProvider>
          <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <AnalyticsProvider>
              <div className="min-h-screen">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/update-password" element={<UpdatePasswordPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/account-security" element={<AccountSecurityPage />} />
                  <Route path="/billing-history" element={<BillingHistoryPage />} />
                  <Route path="/customize/:id" element={<CustomizePage />} />
                  <Route path="/contributors" element={<ContributorsPage />} />
                  <Route path="/contributor-portal" element={<MembershipRoute><ContributorPortalPage /></MembershipRoute>} />
                  <Route path="/events" element={<EventsPage />} />
                  <Route path="/events/past" element={<PastEventsPage />} />
                  <Route path="/event-detail/:id" element={<EventDetailPage />} />
                  <Route path="/social-media" element={<SocialMediaPage />} />
                  <Route path="/score-sheets" element={<ScoreSheetsPage />} />
                  <Route path="/qr/:code" element={<QRCodePage />} />
                  <Route path="/sponsorship" element={<SponsorshipPage />} />
                  <Route path="/advertisement" element={<SponsorshipPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/terms-of-service" element={<PolicyPage />} />
                  <Route path="/privacy-policy" element={<PolicyPage />} />
                  <Route path="/refund-policy" element={<PolicyPage />} />
                  <Route path="/support" element={<SupportPage />} />
                  <Route path="/membership" element={<PricingPage />} />
                  <Route path="/database-schema" element={<DatabaseSchemaPage />} />
                  <Route path="/not-authorized" element={<NotAuthorizedPage />} />
                  <Route path="/show/:showId" element={<PublicShowPage />} />
                  
                  {/* EquiPatterns Routes */}
                  <Route path="/dashboard" element={<RoleBasedRoute requiredPermission="ep_dashboard:view"><EquiPatternsDashboard /></RoleBasedRoute>} />
                  <Route path="/library/patterns" element={<RoleBasedRoute requiredPermission="ep_patterns:manage"><PatternLibraryPage /></RoleBasedRoute>} />
                  <Route path="/library/scoresheets" element={<RoleBasedRoute requiredPermission="ep_scoresheets:manage"><ScoreSheetLibraryPage /></RoleBasedRoute>} />
                  <Route path="/packet-builder" element={<RoleBasedRoute requiredPermission="ep_packets:manage"><PacketBuilderPage /></RoleBasedRoute>} />
                  <Route path="/distribution" element={<RoleBasedRoute requiredPermission="ep_distributions:manage"><DistributionPage /></RoleBasedRoute>} />
                  <Route path="/audit-reports" element={<RoleBasedRoute requiredPermission="ep_audits:view"><AuditReportsPage /></RoleBasedRoute>} />
                  <Route path="/kiosk/judge" element={<RoleBasedRoute requiredPermission="kiosks:use"><JudgeKioskPage /></RoleBasedRoute>} />
                  <Route path="/kiosk/scribe" element={<RoleBasedRoute requiredPermission="kiosks:use"><ScribeKioskPage /></RoleBasedRoute>} />
                  <Route path="/kiosk/announcer" element={<RoleBasedRoute requiredPermission="kiosks:use"><AnnouncerKioskPage /></RoleBasedRoute>} />
                  <Route path="/approvals" element={<RoleBasedRoute requiredPermission="ep_approvals:manage"><ApprovalsDashboardPage /></RoleBasedRoute>} />

                  <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
                  <Route path="/admin/users" element={<AdminRoute><AdminUserManagementPage /></AdminRoute>} />
                  <Route path="/admin/roles" element={<AdminRoute><AdminRoleManagementPage /></AdminRoute>} />
                  <Route path="/admin/disciplines" element={<AdminRoute><AdminDisciplineManagementPage /></AdminRoute>} />
                  <Route path="/admin/associations" element={<AdminRoute><AdminAssociationManagementPage /></AdminRoute>} />
                  <Route path="/admin/divisions" element={<AdminRoute><AdminDivisionManagementPage /></AdminRoute>} />
                  <Route path="/admin/division-levels" element={<AdminRoute><AdminDivisionLevelManagementPage /></AdminRoute>} />
                  <Route path="/admin/sponsorship-analytics" element={<AdminRoute><SponsorshipAnalyticsPage /></AdminRoute>} />
                  <Route path="/admin/sponsorship-packages" element={<AdminRoute><AdminSponsorshipPackagesPage /></AdminRoute>} />
                  <Route path="/admin/schedule-analytics" element={<AdminRoute><ShowScheduleAnalyticsPage /></AdminRoute>} />
                  <Route path="/admin/learning-center" element={<AdminRoute><DataLearningCenterPage /></AdminRoute>} />
                  <Route path="/admin/future-ideas" element={<AdminRoute><FutureIdeasPage /></AdminRoute>} />
                  <Route path="/admin/fee-documentation" element={<AdminRoute><FeeDocumentationPage /></AdminRoute>} />
                  <Route path="/admin/ai-training-manual" element={<AdminRoute><AITrainingManualPage /></AdminRoute>} />
                  <Route path="/admin/ai-pattern-studio" element={<AdminRoute><AIPatternGeneratorStudioPage /></AdminRoute>} />
                  <Route path="/admin/sponsorship-intelligence" element={<AdminRoute><SponsorshipIntelligencePage /></AdminRoute>} />
                  <Route path="/admin/asset-library" element={<AdminRoute><AssetLibraryPage /></AdminRoute>} />
                  <Route path="/admin/asset-library/association/:associationId" element={<AdminRoute><AssociationAssetsPage /></AdminRoute>} />
                  <Route path="/admin/asset-intelligence" element={<AdminRoute><AssetIntelligenceCenterPage /></AdminRoute>} />
                  <Route path="/admin/media-library" element={<AdminRoute><MediaLibraryPage /></AdminRoute>} />
                  <Route path="/admin/media-assignments" element={<AdminRoute><MediaAssignmentsPage /></AdminRoute>} />
                  <Route path="/admin/site-branding" element={<AdminRoute><AdminSiteBrandingPage /></AdminRoute>} />
                  <Route path="/admin/marketing-content" element={<AdminRoute><AdminMarketingContentPage /></AdminRoute>} />
                  <Route path="/admin/custom-pattern-set/:classType" element={<AdminRoute><CustomPatternSetPage /></AdminRoute>} />
                  <Route path="/admin/ai-scoresheet-manager" element={<AdminRoute><AIScoreSheetManagerPage /></AdminRoute>} />
                  <Route path="/admin/pattern-review" element={<AdminRoute><AdminPatternReviewPage /></AdminRoute>} />
                  <Route path="/admin/pattern-extractor" element={<AdminRoute><AdminPatternExtractorPage /></AdminRoute>} />
                  <Route path="/admin/manual-pattern-entry" element={<AdminRoute><ManualPatternEntryPage /></AdminRoute>} />
                  <Route path="/admin/tracking-user" element={<AdminRoute><AdminTrackingUserPage /></AdminRoute>} />
                  <Route path="/admin/pattern-levels" element={<AdminRoute><AdminPatternLevelManagementPage /></AdminRoute>} />
                  <Route path="/admin/scoresheet-upload" element={<AdminRoute><ScoresheetUploadPage /></AdminRoute>} />
                  <Route path="/admin/customer-asset-library" element={<AdminRoute><CustomerAssetLibraryPage /></AdminRoute>} />
                  <Route path="/admin/show-management" element={<AdminRoute><AdminShowManagementPage /></AdminRoute>} />
                  <Route path="/admin/events" element={<AdminRoute><AdminEventsManagementPage /></AdminRoute>} />
                  <Route path="/admin/billing-report" element={<AdminRoute><AdminBillingReportPage /></AdminRoute>} />
                  <Route path="/horse-show-manager/equipment" element={<MembershipRoute requiredPermission="equipment:manage"><EquipmentManagementPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/discipline-planner" element={<MembershipRoute requiredPermission="equipment:manage"><DisciplinePlannerPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/arena-sessions" element={<MembershipRoute requiredPermission="equipment:manage"><ArenaSessionsPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/equipment-requirements" element={<MembershipRoute requiredPermission="equipment:manage"><EquipmentRequirementsPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/distribution-plan" element={<MembershipRoute requiredPermission="equipment:manage"><DistributionPlanPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/equipment-check-in-out" element={<MembershipRoute requiredPermission="equipment:manage"><EquipmentCheckInOutPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/equipment-planning" element={<MembershipRoute requiredPermission="equipment:manage"><EquipmentPlanningHubPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/equipment-planning/:showId" element={<MembershipRoute requiredPermission="equipment:manage"><EquipmentPlanningHubPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/locations" element={<MembershipRoute requiredPermission="equipment:manage"><LocationsPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/reconciliation" element={<MembershipRoute requiredPermission="equipment:manage"><ReconciliationPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/equipment-reports" element={<MembershipRoute requiredPermission="equipment:manage"><EquipmentReportsPage /></MembershipRoute>} />

                  <Route path="/customer-portal" element={<MembershipRoute><CustomerPortalPage /></MembershipRoute>} />
                  <Route path="/archive-patterns" element={<MembershipRoute><ArchivePatternsPage /></MembershipRoute>} />
                  <Route path="/judges-portal" element={<JudgesPortalPage />} />
                  <Route path="/staff-portal" element={<StaffPortalPage />} />
                  <Route path="/pattern-hub" element={<MembershipRoute><PatternHubPage /></MembershipRoute>} />
                  <Route path="/pattern-hub/:projectId" element={<MembershipRoute><PatternHubPage /></MembershipRoute>} />
                  <Route path="/store" element={<StorePage />} />
                  <Route path="/product/:id" element={<ProductDetailPage />} />
                  <Route path="/success" element={<SuccessPage />} />
                  <Route path="/pattern-book-builder" element={<MembershipRoute><PatternBookBuilderPage /></MembershipRoute>} />
                  <Route path="/pattern-book-builder/:projectId" element={<MembershipRoute><PatternBookBuilderPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager" element={<MembershipRoute><HorseShowManagerPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/show/:showId" element={<MembershipRoute><ShowWorkspacePage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/create" element={<MembershipRoute><CreateShowPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/edit/:showId" element={<MembershipRoute><CreateShowPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/schedule-builder" element={<MembershipRoute><CreateShowPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/schedule-builder/:showId" element={<MembershipRoute><CreateShowPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/show-structure-expenses" element={<MembershipRoute><ShowStructurePage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/show-structure-expenses/:showId" element={<MembershipRoute><ShowStructurePage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/fee-structure" element={<MembershipRoute><CreateHorseShowWizardPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/fee-structure/:showId" element={<MembershipRoute><CreateHorseShowWizardPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/show-dashboard/:showId" element={<MembershipRoute><ShowDashboardPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/financials" element={<MembershipRoute><ShowFinancialDashboardPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/financials/:showId" element={<MembershipRoute><ShowFinancialDashboardPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/stalling-service-manager" element={<MembershipRoute><StallingServiceManagerPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/stalling-service-manager/:showId" element={<MembershipRoute><StallingServiceManagerPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/employee-scheduling" element={<MembershipRoute><EmployeeArenaSchedulingManagerPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/employee-scheduling/:showId" element={<MembershipRoute><EmployeeArenaSchedulingManagerPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/employee-budgeting" element={<MembershipRoute><EmployeeBudgetingToolPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/employee-budgeting/:showId" element={<MembershipRoute><EmployeeBudgetingToolPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/venue-arena-setup" element={<MembershipRoute><VenueArenaSetupPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/venue-arena-setup/:showId" element={<MembershipRoute><VenueArenaSetupPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/employee-scheduling/assign" element={<MembershipRoute><EmployeeSchedulingPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/employee-scheduling/assign/:showId" element={<MembershipRoute><EmployeeSchedulingPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/employee-management" element={<MembershipRoute><EmployeeManagementPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/employee-management/contracts" element={<MembershipRoute><ContractManagementPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/employee-management/contracts/:projectId" element={<MembershipRoute><ContractManagementPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/travel-management" element={<MembershipRoute><TravelManagementPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/awards-presenters" element={<MembershipRoute><AwardsPresenterManagerPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/awards-management" element={<MembershipRoute><AwardsManagementPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/awards-management/:showId" element={<MembershipRoute><AwardsManagementPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/results-management" element={<MembershipRoute><ResultsManagementPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/results-management/:showId" element={<MembershipRoute><ResultsManagementPage /></MembershipRoute>} />
                  <Route path="/collaboration-hub" element={<CollaborationHubPage />} />
                  <Route path="/upload-patterns" element={<PatternUploadLandingPage />} />
                  <Route path="/upload-patterns/new" element={<MembershipRoute><PatternUploadWizardPage /></MembershipRoute>} />
                  <Route path="/upload-patterns/edit/:projectId" element={<MembershipRoute><PatternUploadWizardPage /></MembershipRoute>} />
                  <Route path="/upload-patterns/extractor" element={<AdminRoute><AdminPatternExtractorPage /></AdminRoute>} />
                  <Route path="/score-sheet-generator" element={<ScoreSheetGeneratorPage />} />
                  <Route path="/s/:id" element={<ScoreSheetQRDownloadPage />} />
                  <Route path="/s/:id/results" element={<ScoreSheetResultsPage />} />
                </Routes>
                <Toaster />
                <AuthModal />
                <SupportWidget />
              </div>
            </AnalyticsProvider>
          </ThemeProvider>
      </MediaConfigProvider>
  );
}

export default App;