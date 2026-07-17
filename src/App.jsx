import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import ErrorBoundary from '@/components/ErrorBoundary';
import { MediaConfigProvider } from '@/contexts/MediaConfigContext';
import { ThemeProvider } from "@/components/ThemeProvider";
import AuthModal from '@/components/AuthModal';
import SupportWidget from '@/components/SupportWidget';
import AdminRoute from '@/components/AdminRoute';
import RoleBasedRoute from '@/components/RoleBasedRoute';
import MembershipRoute from '@/components/MembershipRoute';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';

// Pages are lazy-loaded so each route ships as its own chunk. This keeps the
// initial download small — a visitor only fetches the code for the page they
// open, instead of the whole app (all ~130 pages) up front.
const HomePage = lazy(() => import('@/pages/HomePage'));
const CustomizePage = lazy(() => import('@/pages/CustomizePage'));
const ContributorPortalPage = lazy(() => import('@/pages/ContributorPortalPage'));
const ContributorsPage = lazy(() => import('@/pages/ContributorsPage'));
const EventsPage = lazy(() => import('@/pages/EventsPage'));
const ScoreSheetsPage = lazy(() => import('@/pages/ScoreSheetsPage'));
const QRCodePage = lazy(() => import('@/pages/QRCodePage'));
const SponsorshipPage = lazy(() => import('@/pages/SponsorshipPage'));
const SocialMediaPage = lazy(() => import('@/pages/SocialMediaPage'));
const EventDetailPage = lazy(() => import('@/pages/EventDetailPage'));
const DatabaseSchemaPage = lazy(() => import('@/pages/DatabaseSchemaPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const PatternHubPage = lazy(() => import('@/pages/PatternHubPage'));
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage'));
const SuccessPage = lazy(() => import('@/pages/SuccessPage'));
const PatternBookBuilderPage = lazy(() => import('@/pages/PatternBookBuilderPage'));
const ShowScheduleAnalyticsPage = lazy(() => import('@/pages/ShowScheduleAnalyticsPage'));
const DataLearningCenterPage = lazy(() => import('@/pages/DataLearningCenterPage'));
const SponsorshipAnalyticsPage = lazy(() => import('@/pages/SponsorshipAnalyticsPage'));
const FutureIdeasPage = lazy(() => import('@/pages/FutureIdeasPage'));
const FeeDocumentationPage = lazy(() => import('@/pages/FeeDocumentationPage'));
const AITrainingManualPage = lazy(() => import('@/pages/AITrainingManualPage'));
const SponsorshipIntelligencePage = lazy(() => import('@/pages/SponsorshipIntelligencePage'));
const AssetLibraryPage = lazy(() => import('@/pages/AssetLibraryPage'));
const CustomPatternSetPage = lazy(() => import('@/pages/CustomPatternSetPage'));
const PatternUploadWizardPage = lazy(() => import('@/pages/PatternUploadWizardPage'));
const ScoreSheetGeneratorPage = lazy(() => import('@/pages/ScoreSheetGeneratorPage'));
const ScoreSheetQRDownloadPage = lazy(() => import('@/pages/ScoreSheetQRDownloadPage'));
const ScoreSheetResultsPage = lazy(() => import('@/pages/ScoreSheetResultsPage'));
const AIScoreSheetManagerPage = lazy(() => import('@/pages/AIScoreSheetManagerPage'));
const AdminPatternReviewPage = lazy(() => import('@/pages/AdminPatternReviewPage'));
const AIPatternGeneratorStudioPage = lazy(() => import('@/pages/AIPatternGeneratorStudioPage'));
const MediaLibraryPage = lazy(() => import('@/pages/MediaLibraryPage'));
const MediaAssignmentsPage = lazy(() => import('@/pages/MediaAssignmentsPage'));
const AdminSiteBrandingPage = lazy(() => import('@/pages/AdminSiteBrandingPage'));
const AdminMarketingContentPage = lazy(() => import('@/pages/AdminMarketingContentPage'));
const PastEventsPage = lazy(() => import('@/pages/PastEventsPage'));
const StorePage = lazy(() => import('@/pages/StorePage'));
const AssetIntelligenceCenterPage = lazy(() => import('@/pages/AssetIntelligenceCenterPage'));
const CollaborationHubPage = lazy(() => import('@/pages/CollaborationHubPage'));
const CustomerAssetLibraryPage = lazy(() => import('@/pages/CustomerAssetLibraryPage'));
const CustomerPortalPage = lazy(() => import('@/pages/CustomerPortalPage'));
const ArchivePatternsPage = lazy(() => import('@/pages/ArchivePatternsPage'));
const PatternUploadLandingPage = lazy(() => import('@/pages/PatternUploadLandingPage'));
const PatternUploadRequestPage = lazy(() => import('@/pages/PatternUploadRequestPage'));
const PatternJudgeRequestPage = lazy(() => import('@/pages/PatternJudgeRequestPage'));
const HorseShowManagerPage = lazy(() => import('@/pages/HorseShowManagerPage'));
const CreateShowPage = lazy(() => import('@/pages/CreateShowPage'));
const ShowStructurePage = lazy(() => import('@/pages/ShowStructurePage'));
const HousingGroundsManagerPage = lazy(() => import('@/pages/HousingGroundsManagerPage'));
const EmployeeArenaSchedulingManagerPage = lazy(() => import('@/pages/EmployeeArenaSchedulingManagerPage'));
const AwardsPresenterManagerPage = lazy(() => import('@/pages/AwardsPresenterManagerPage'));
const EmployeeManagementPage = lazy(() => import('@/pages/EmployeeManagementPage'));
const ContractManagementPage = lazy(() => import('@/pages/ContractManagementPage'));
const TravelManagementPage = lazy(() => import('@/pages/TravelManagementPage'));
const UpdatePasswordPage = lazy(() => import('@/pages/UpdatePasswordPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const JudgesPortalPage = lazy(() => import('@/pages/JudgesPortalPage'));
const StaffPortalPage = lazy(() => import('@/pages/StaffPortalPage'));
const NotAuthorizedPage = lazy(() => import('@/pages/NotAuthorizedPage'));
const AdminUserManagementPage = lazy(() => import('@/pages/AdminUserManagementPage'));
const AdminDisciplineManagementPage = lazy(() => import('@/pages/AdminDisciplineManagementPage'));
const AdminAssociationManagementPage = lazy(() => import('@/pages/AdminAssociationManagementPage'));
const AssociationAssetsPage = lazy(() => import('@/pages/AssociationAssetsPage'));
const AdminShowManagementPage = lazy(() => import('@/pages/AdminShowManagementPage'));
const AdminEventsManagementPage = lazy(() => import('@/pages/AdminEventsManagementPage'));
const AdminSponsorshipPackagesPage = lazy(() => import('@/pages/AdminSponsorshipPackagesPage'));
const PublicShowPage = lazy(() => import('@/pages/PublicShowPage'));
const PublicBookingPage = lazy(() => import('@/pages/PublicBookingPage'));
const QuickSupplyOrderPage = lazy(() => import('@/pages/QuickSupplyOrderPage'));
const PublicShowsListPage = lazy(() => import('@/pages/PublicShowsListPage'));
const CheckInPage = lazy(() => import('@/pages/CheckInPage'));
const BookingStatusPage = lazy(() => import('@/pages/BookingStatusPage'));
const FindBookingPage = lazy(() => import('@/pages/FindBookingPage'));
const AdminDivisionManagementPage = lazy(() => import('@/pages/AdminDivisionManagementPage'));
const AdminDivisionLevelManagementPage = lazy(() => import('@/pages/AdminDivisionLevelManagementPage'));
const ApprovalsDashboardPage = lazy(() => import('@/pages/ApprovalsDashboardPage'));
const ShowDashboardPage = lazy(() => import('@/pages/ShowDashboardPage'));
const EquiPatternsDashboard = lazy(() => import('@/pages/EquiPatternsDashboard'));
const PatternLibraryPage = lazy(() => import('@/pages/PatternLibraryPage'));
const ScoreSheetLibraryPage = lazy(() => import('@/pages/ScoreSheetLibraryPage'));
const PacketBuilderPage = lazy(() => import('@/pages/PacketBuilderPage'));
const DistributionPage = lazy(() => import('@/pages/DistributionPage'));
const JudgeKioskPage = lazy(() => import('@/pages/KioskViews/JudgeKioskPage'));
const ScribeKioskPage = lazy(() => import('@/pages/KioskViews/ScribeKioskPage'));
const AnnouncerKioskPage = lazy(() => import('@/pages/KioskViews/AnnouncerKioskPage'));
const AuditReportsPage = lazy(() => import('@/pages/AuditReportsPage'));
const AdminRoleManagementPage = lazy(() => import('@/pages/AdminRoleManagementPage'));
const AdminPatternExtractorPage = lazy(() => import('@/pages/AdminPatternExtractorPage'));
const ManualPatternEntryPage = lazy(() => import('@/pages/ManualPatternEntryPage'));
const AdminTrackingUserPage = lazy(() => import('@/pages/AdminTrackingUserPage'));
const AdminPatternLevelManagementPage = lazy(() => import('@/pages/AdminPatternLevelManagementPage'));
const AccountSecurityPage = lazy(() => import('@/pages/AccountSecurityPage'));
const PolicyPage = lazy(() => import('@/pages/PolicyPage'));
const SupportPage = lazy(() => import('@/pages/SupportPage'));
const ScoresheetUploadPage = lazy(() => import('@/pages/ScoresheetUploadPage'));
const PricingPage = lazy(() => import('@/pages/PricingPage'));
const BillingHistoryPage = lazy(() => import('@/pages/BillingHistoryPage'));
const AdminBillingReportPage = lazy(() => import('@/pages/AdminBillingReportPage'));
const EquipmentManagementPage = lazy(() => import('@/pages/EquipmentManagementPage'));
const DisciplinePlannerPage = lazy(() => import('@/pages/DisciplinePlannerPage'));
const ArenaSessionsPage = lazy(() => import('@/pages/ArenaSessionsPage'));
const EquipmentRequirementsPage = lazy(() => import('@/pages/EquipmentRequirementsPage'));
const DistributionPlanPage = lazy(() => import('@/pages/DistributionPlanPage'));
const EquipmentCheckInOutPage = lazy(() => import('@/pages/EquipmentCheckInOutPage'));
const EquipmentPlanningHubPage = lazy(() => import('@/pages/EquipmentPlanningHubPage'));
const LocationsPage = lazy(() => import('@/pages/LocationsPage'));
const ReconciliationPage = lazy(() => import('@/pages/ReconciliationPage'));
const EquipmentReportsPage = lazy(() => import('@/pages/EquipmentReportsPage'));
const CreateHorseShowWizardPage = lazy(() => import('@/pages/CreateHorseShowWizardPage'));
const ShowWorkspacePage = lazy(() => import('@/pages/ShowWorkspacePage'));
const ShowFinancialDashboardPage = lazy(() => import('@/pages/ShowFinancialDashboardPage'));
const EmployeeBudgetingToolPage = lazy(() => import('@/pages/EmployeeBudgetingToolPage'));
const VenueArenaSetupPage = lazy(() => import('@/pages/VenueArenaSetupPage'));
const EmployeeSchedulingPage = lazy(() => import('@/pages/EmployeeSchedulingPage'));
const AwardsManagementPage = lazy(() => import('@/pages/AwardsManagementPage'));
const ResultsManagementPage = lazy(() => import('@/pages/ResultsManagementPage'));

// Shown while a route's chunk is being fetched.
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

function App() {
  return (
      <MediaConfigProvider>
          <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <AnalyticsProvider>
              <div className="min-h-screen">
                <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
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
                  <Route path="/book-stalls" element={<PublicShowsListPage />} />
                  <Route path="/show/:showId" element={<PublicShowPage />} />
                  <Route path="/upload-request/:token" element={<PatternUploadRequestPage />} />
                  <Route path="/judge-request/:token" element={<PatternJudgeRequestPage />} />
                  <Route path="/show/:showId/book" element={<PublicBookingPage />} />
                  <Route path="/show/:showId/order-supplies" element={<QuickSupplyOrderPage />} />
                  <Route path="/booking/:bookingId" element={<BookingStatusPage />} />
                  <Route path="/find-booking" element={<FindBookingPage />} />

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
                  <Route path="/horse-show-manager/housing-grounds-manager" element={<MembershipRoute><HousingGroundsManagerPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/housing-grounds-manager/:showId" element={<MembershipRoute><HousingGroundsManagerPage /></MembershipRoute>} />
                  <Route path="/horse-show-manager/check-in/:showId" element={<MembershipRoute><CheckInPage /></MembershipRoute>} />
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
                  {/* Catch-all: any unknown URL redirects to home instead of a blank page */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                </Suspense>
                </ErrorBoundary>
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
