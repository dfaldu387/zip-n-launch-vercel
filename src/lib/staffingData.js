import { User, Award, Shield, Users, Rabbit as Horse, Star, School as University, Clover, ClipboardCheck, Construction, Timer, FileText, Calendar, Wrench, Send, Briefcase, Megaphone, Ticket as Gate, Map, Settings, Edit, List, CheckSquare, Percent, Clock, PlayCircle, Flag, ShieldCheck, Ruler, Tractor, PlusCircle, Camera, Video, Share2, Radio, Trophy } from 'lucide-react';

export const staffRoles = {
    // Show Management & Administration
    SHOW_MANAGER: { id: 'SHOW_MANAGER', name: 'Show Manager', icon: Briefcase, hasCards: true, group: 'management' },
    SHOW_SECRETARY: { id: 'SHOW_SECRETARY', name: 'Show Secretary', icon: Edit, hasCards: true, group: 'management' },
    ASSISTANT_SHOW_MANAGER: { id: 'ASSISTANT_SHOW_MANAGER', name: 'Assistant Show Manager', icon: User, group: 'management' },
    OFFICE_ASSISTANT: { id: 'OFFICE_ASSISTANT', name: 'Office Assistant', icon: User, group: 'management' },
    ANNOUNCER: { id: 'ANNOUNCER', name: 'Announcer', icon: Megaphone, group: 'management' },
    GATE_MANAGER: { id: 'GATE_MANAGER', name: 'Gate Manager / Paddock Master', icon: Gate, group: 'management' },

    // Judging, Stewards & Officials
    JUDGE: { id: 'JUDGE', name: 'Judge', icon: Award, hasCards: true, group: 'judging' },
    SHOW_STEWARD: { id: 'SHOW_STEWARD', name: 'Show Steward', icon: Shield, hasCards: true, group: 'judging' },
    SCRIBE_RING_STEWARD: { id: 'SCRIBE_RING_STEWARD', name: 'Scribe / Ring Steward', icon: Edit, group: 'judging' },
    SCORE_RUNNER: { id: 'SCORE_RUNNER', name: 'Score Runner', icon: Users, group: 'judging' },
    SCOREKEEPER: { id: 'SCOREKEEPER', name: 'Scorekeeper', icon: Percent, group: 'judging' },
    TABULATOR: { id: 'TABULATOR', name: 'Tabulator', icon: List, group: 'judging' },
    SCORER: { id: 'SCORER', name: 'Scorer/Tabulator', icon: Percent, group: 'judging' },
    TIMER: { id: 'TIMER', name: 'Timer', icon: Clock, group: 'judging' },
    START_FINISH_TIMER: { id: 'START_FINISH_TIMER', name: 'Start/Finish Timers', icon: Flag, group: 'judging' },
    WARMUP_STEWARD: { id: 'WARMUP_STEWARD', name: 'Warm-up/Paddock Steward', icon: User, group: 'judging' },
    BIT_CHECKER: { id: 'BIT_CHECKER', name: 'Bit Checker/Equipment Inspector', icon: CheckSquare, group: 'judging' },
    SAFETY_CHECKER: { id: 'SAFETY_CHECKER', name: 'Safety Check/Wheel Measurer', icon: ShieldCheck, group: 'judging' },

    // Course & Equipment
    COURSE_DESIGNER: { id: 'COURSE_DESIGNER', name: 'Course Designer', icon: Map, hasCards: true, group: 'course' },
    JUMP_COURSE_DESIGNER: { id: 'JUMP_COURSE_DESIGNER', name: 'Jump Course Designer', icon: Map, hasCards: true, group: 'course' },
    JUMP_COURSE_CREW: { id: 'JUMP_COURSE_CREW', name: 'Jump Course Crew', icon: Construction, group: 'course' },
    TRAIL_COURSE_DESIGNER: { id: 'TRAIL_COURSE_DESIGNER', name: 'Trail Course Designer', icon: Map, group: 'course' },
    TRAIL_COURSE_CREW: { id: 'TRAIL_COURSE_CREW', name: 'Trail Course Crew', icon: Tractor, group: 'course' },
    EQUIPMENT_PROVIDER: { id: 'EQUIPMENT_PROVIDER', name: 'Equipment Provider', icon: Settings, group: 'course' },
    CONES_STEWARD: { id: 'CONES_STEWARD', name: 'Cones Steward/Setter', icon: Ruler, group: 'course' },
    ARENA_CREW: { id: 'ARENA_CREW', name: 'Arena Crew', icon: Tractor, group: 'course' },

    // Media Team
    PHOTOGRAPHER: { id: 'PHOTOGRAPHER', name: 'Photographer', icon: Camera, group: 'media' },
    VIDEOGRAPHER: { id: 'VIDEOGRAPHER', name: 'Videographer', icon: Video, group: 'media' },
    SOCIAL_MEDIA_SPECIALIST: { id: 'SOCIAL_MEDIA_SPECIALIST', name: 'Social Media Specialist', icon: Share2, group: 'media' },
    LIVESTREAM_PRODUCER: { id: 'LIVESTREAM_PRODUCER', name: 'Live Stream Producer', icon: Radio, group: 'media' },

    // Awards Team
    AWARDS_COORDINATOR: { id: 'AWARDS_COORDINATOR', name: 'Awards Coordinator', icon: Trophy, group: 'awards' },
    AWARDS_RUNNER: { id: 'AWARDS_RUNNER', name: 'Awards Runner/Presenter', icon: Award, group: 'awards' },

    // Legacy/Other (can be phased out or kept for specific cases)
    CATTLE_CREW: { id: 'CATTLE_CREW', name: 'Cattle Crew', icon: Users, group: 'course' },
    VOLUNTEER_COORDINATOR: { id: 'VOLUNTEER_COORDINATOR', name: 'Volunteer Coordinator', icon: Users, group: 'management' },
    HORSE_HANDLER: { id: 'HORSE_HANDLER', name: 'Horse Handler/Wrangler', icon: Horse, group: 'course' },
    CUSTOM: { id: 'CUSTOM', name: 'Custom Role', icon: PlusCircle, group: 'custom' }
};

export const roleGroups = {
    management: { name: 'Show Management & Administration', order: 1 },
    judging: { name: 'Judging, Stewards & Officials', order: 2 },
    course: { name: 'Course & Equipment', order: 3 },
    media: { name: 'Media Team', order: 4 },
    awards: { name: 'Awards Team', order: 5 },
    custom: { name: 'Custom Roles', order: 6 },
};

export const delegationTasks = {
    "Patterns & Scoresheets": [
        { id: 'PATTERN_REVIEW', name: 'Final Pattern Review', icon: FileText, roles: ['JUDGE', 'JUMP_COURSE_DESIGNER', 'SHOW_STEWARD', 'SHOW_MANAGER'] },
        { id: 'SCORESHEET_REVIEW', name: 'Scoresheet Proofing', icon: ClipboardCheck, roles: ['SHOW_SECRETARY', 'JUDGE', 'SCRIBE_RING_STEWARD', 'SHOW_MANAGER'] },
        { id: 'PATTERN_LOGISTICS', name: 'Confirm Pattern Logistics', icon: Wrench, roles: ['TRAIL_COURSE_DESIGNER', 'JUMP_COURSE_DESIGNER', 'SCRIBE_RING_STEWARD'] },
    ],
    "Scheduling & Logistics": [
        { id: 'SCHEDULE_REVIEW', name: 'Final Schedule Review', icon: Calendar, roles: ['SHOW_MANAGER', 'SHOW_SECRETARY', 'ANNOUNCER', 'SCRIBE_RING_STEWARD'] },
        { id: 'EQUIPMENT_SETUP', name: 'Coordinate Equipment Setup', icon: Construction, roles: ['ARENA_CREW', 'JUMP_COURSE_CREW', 'SCRIBE_RING_STEWARD', 'EQUIPMENT_PROVIDER'] },
        { id: 'STAFF_COORDINATION', name: 'Confirm Staff Assignments', icon: Users, roles: ['SHOW_MANAGER', 'VOLUNTEER_COORDINATOR'] },
    ],
    "Administration & Communication": [
        { id: 'ENTRY_MANAGEMENT', name: 'Verify Entry Information', icon: User, roles: ['SHOW_SECRETARY', 'OFFICE_ASSISTANT'] },
        { id: 'COMMUNICATIONS', name: 'Send Pre-Show Communications', icon: Send, roles: ['SHOW_SECRETARY', 'SHOW_MANAGER'] },
        { id: 'RESULTS_TABULATION', name: 'Prepare Results Tabulation', icon: Award, roles: ['SHOW_SECRETARY', 'SCORER'] },
        { id: 'FINAL_APPROVAL', name: 'Final Book Approval', icon: Shield, roles: ['SHOW_MANAGER', 'SHOW_STEWARD'] },
    ]
};

const standardManagementRoles = ['SHOW_MANAGER', 'SHOW_SECRETARY', 'OFFICE_ASSISTANT', 'ANNOUNCER', 'GATE_MANAGER', 'SCOREKEEPER', 'TABULATOR'];
const standardMediaRoles = ['PHOTOGRAPHER', 'VIDEOGRAPHER', 'SOCIAL_MEDIA_SPECIALIST', 'LIVESTREAM_PRODUCER'];
const standardAwardsRoles = ['AWARDS_COORDINATOR', 'AWARDS_RUNNER'];

export const associationStaffing = {
    'VRH': {
        name: 'Versatility Ranch Horse',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['TRAIL_COURSE_DESIGNER', 'TRAIL_COURSE_CREW', 'CATTLE_CREW', 'SCRIBE_RING_STEWARD', 'SCORER'],
    },
    'Multi-Breed': {
        name: 'Multi-Breed Show',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['SCORER', 'SCRIBE_RING_STEWARD', 'WARMUP_STEWARD'],
    },
    '4-H': {
        name: '4-H Show',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['VOLUNTEER_COORDINATOR', 'SCRIBE_RING_STEWARD'],
    },
    'ABRA': {
        name: 'American Buckskin Registry Association',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['SCRIBE_RING_STEWARD', 'SHOW_STEWARD'],
    },
    'AHA': {
        name: 'Arabian Horse Association',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['TRAIL_COURSE_DESIGNER', 'TRAIL_COURSE_CREW', 'SCORER', 'SHOW_STEWARD', 'SCRIBE_RING_STEWARD'],
    },
    'Open': {
        name: 'All Breed / Open Show',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['SCRIBE_RING_STEWARD', 'SCORER', 'VOLUNTEER_COORDINATOR'],
    },
    'APHA': {
        name: 'American Paint Horse Association',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['SCORER', 'SCRIBE_RING_STEWARD', 'TRAIL_COURSE_DESIGNER', 'TRAIL_COURSE_CREW', 'ARENA_CREW'],
    },
    'ApHC': {
        name: 'Appaloosa Horse Club',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['SCORER', 'SCRIBE_RING_STEWARD', 'TRAIL_COURSE_DESIGNER', 'TRAIL_COURSE_CREW', 'CATTLE_CREW'],
    },
    'AQHA': {
        name: 'American Quarter Horse Association',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['SCORER', 'SCRIBE_RING_STEWARD', 'TRAIL_COURSE_DESIGNER', 'TRAIL_COURSE_CREW', 'CATTLE_CREW', 'SHOW_STEWARD'],
    },
    'ISHA': {
        name: 'Intercollegiate Horse Shows Association',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['HORSE_HANDLER', 'WARMUP_STEWARD', 'SCRIBE_RING_STEWARD'],
    },
    'NCEA': {
        name: 'National Collegiate Equestrian Association',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['SCORER', 'HORSE_HANDLER', 'ARENA_CREW', 'SCRIBE_RING_STEWARD'],
    },
    'NSBA': {
        name: 'National Snaffle Bit Association',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['SCORER', 'SCRIBE_RING_STEWARD', 'TRAIL_COURSE_DESIGNER', 'TRAIL_COURSE_CREW', 'CATTLE_CREW'],
    },
    'PHBA': {
        name: 'Palomino Horse Breeders of America',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['SCRIBE_RING_STEWARD', 'SCORER'],
    },
    'PtHA': {
        name: 'Pinto Horse Association of America',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['SCORER', 'SCRIBE_RING_STEWARD', 'TRAIL_COURSE_DESIGNER', 'TRAIL_COURSE_CREW'],
    },
    'USEF': {
        name: 'US Equestrian',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['SHOW_STEWARD', 'SCORER', 'SCRIBE_RING_STEWARD'],
    },
    'USHJA': {
        name: 'US Hunter Jumper Association',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['WARMUP_STEWARD', 'TIMER', 'SHOW_STEWARD', 'SCRIBE_RING_STEWARD'],
    },
    'custom': {
        name: 'Custom Association',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: [],
    },
    'default': {
        name: 'General Staff',
        core: [...standardManagementRoles, 'JUDGE', 'JUMP_COURSE_DESIGNER', 'JUMP_COURSE_CREW', ...standardMediaRoles, ...standardAwardsRoles],
        specialized: ['SCRIBE_RING_STEWARD', 'ARENA_CREW'],
    }
};