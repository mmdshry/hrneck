<?php

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\IdentityAccess\Support\SsoProvider;
use App\Domains\Subscriptions\Support\PlanFeature;
use App\Http\Controllers\Api\V1\Assistant\ToolController as AssistantToolController;
use App\Http\Controllers\Api\V1\AuthAvatarController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\DemoRequestController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\Msp\TenantController;
use App\Http\Controllers\Api\V1\Org\AnnouncementController;
use App\Http\Controllers\Api\V1\Org\AssistantController;
use App\Http\Controllers\Api\V1\Org\AuditLogController;
use App\Http\Controllers\Api\V1\Org\BrandingController;
use App\Http\Controllers\Api\V1\Org\CampaignController;
use App\Http\Controllers\Api\V1\Org\CampaignCourseController;
use App\Http\Controllers\Api\V1\Org\ChecklistController;
use App\Http\Controllers\Api\V1\Org\CustomDomainController;
use App\Http\Controllers\Api\V1\Org\DepartmentController;
use App\Http\Controllers\Api\V1\Org\GroupController;
use App\Http\Controllers\Api\V1\Org\IntegrationController;
use App\Http\Controllers\Api\V1\Org\NotificationController;
use App\Http\Controllers\Api\V1\Org\OrgRoleController;
use App\Http\Controllers\Api\V1\Org\OrgUserController;
use App\Http\Controllers\Api\V1\Org\ReportController;
use App\Http\Controllers\Api\V1\Org\ReportExportController;
use App\Http\Controllers\Api\V1\Org\ReportScheduleController;
use App\Http\Controllers\Api\V1\Org\SendingProfileController;
use App\Http\Controllers\Api\V1\Org\SettingsController;
use App\Http\Controllers\Api\V1\Org\TargetAvatarController;
use App\Http\Controllers\Api\V1\Org\TargetController;
use App\Http\Controllers\Api\V1\Org\TargetImportController;
use App\Http\Controllers\Api\V1\Org\Ticketing\DeskController as TicketingDeskController;
use App\Http\Controllers\Api\V1\Org\Ticketing\EmailReaderController;
use App\Http\Controllers\Api\V1\Org\Ticketing\KbController;
use App\Http\Controllers\Api\V1\Org\Ticketing\SearchController as TicketingSearchController;
use App\Http\Controllers\Api\V1\Org\Ticketing\TemplateController;
use App\Http\Controllers\Api\V1\Org\Ticketing\TicketController;
use App\Http\Controllers\Api\V1\Org\Ticketing\TicketingReportController;
use App\Http\Controllers\Api\V1\Org\TrainingController;
use App\Http\Controllers\Api\V1\Org\UserAvatarController;
use App\Http\Controllers\Api\V1\Org\WebhookStubController;
use App\Http\Controllers\Api\V1\PasskeyController;
use App\Http\Controllers\Api\V1\Portal\PortalTicketingController;
use App\Http\Controllers\Api\V1\SsoController;
use App\Http\Middleware\AuthenticateAssistantTool;
use App\Http\Middleware\EnsureOrgMembership;
use App\Http\Middleware\EnsurePlatformStaff;
use App\Http\Middleware\EnsureSubscriptionWritable;
use App\Http\Middleware\InitializeTenancyByHeader;
use App\Http\Middleware\SetPermissionsTeamFromTenant;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', HealthController::class)->name('api.v1.health');

    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:auth-login');
    Route::post('/auth/login/org', [AuthController::class, 'loginOrg'])->middleware('throttle:auth-login');
    // Sign-in finder on the main domain: confirms an organization exists and returns its sign-in address.
    Route::get('/auth/organizations/{slug}', [AuthController::class, 'findOrganization'])->middleware('throttle:org-lookup');

    $ssoProviders = implode('|', array_column(SsoProvider::cases(), 'value'));
    Route::get('/auth/oauth/providers', [SsoController::class, 'providers']);
    Route::get('/auth/oauth/{provider}/redirect', [SsoController::class, 'redirect'])
        ->where('provider', $ssoProviders)
        ->middleware('throttle:sso');
    Route::get('/auth/oauth/{provider}/callback', [SsoController::class, 'callback'])
        ->where('provider', $ssoProviders)
        ->middleware('throttle:sso');
    Route::post('/auth/oauth/exchange', [SsoController::class, 'exchange'])->middleware('throttle:sso');
    Route::post('/auth/mfa/verify', [AuthController::class, 'verifyMfa'])->middleware('throttle:mfa');
    Route::post('/auth/mfa/passkey/options', [AuthController::class, 'passkeyMfaOptions'])->middleware('throttle:mfa');
    Route::post('/auth/mfa/passkey/verify', [AuthController::class, 'verifyPasskeyMfa'])->middleware('throttle:mfa');
    Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    // Guest-friendly: returns 200 with data:null so browsers/LHCI do not log 401 noise.
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/mfa/setup', [AuthController::class, 'setupMfa'])->middleware(['auth:sanctum', 'throttle:mfa']);
    Route::post('/auth/mfa/confirm', [AuthController::class, 'confirmMfa'])->middleware(['auth:sanctum', 'throttle:mfa']);
    Route::post('/auth/mfa/disable', [AuthController::class, 'disableMfa'])->middleware(['auth:sanctum', 'throttle:mfa']);
    Route::get('/auth/passkeys', [PasskeyController::class, 'index'])->middleware('auth:sanctum');
    Route::post('/auth/passkeys/register/options', [PasskeyController::class, 'registerOptions'])->middleware(['auth:sanctum', 'throttle:mfa']);
    Route::post('/auth/passkeys/register/verify', [PasskeyController::class, 'registerVerify'])->middleware(['auth:sanctum', 'throttle:mfa']);
    Route::post('/auth/passkeys/assertion/options', [PasskeyController::class, 'assertionOptions'])->middleware(['auth:sanctum', 'throttle:mfa']);
    Route::delete('/auth/passkeys/{passkey}', [PasskeyController::class, 'destroy'])->middleware(['auth:sanctum', 'throttle:mfa']);
    Route::post('/auth/password/forgot', [AuthController::class, 'forgotPassword'])->middleware('throttle:auth-login');
    Route::post('/auth/password/reset', [AuthController::class, 'resetPassword'])->middleware('throttle:auth-login');
    // Public "Request a demo" form on the landing page. Turnstile + honeypot + per-IP limit guard it.
    Route::post('/demo-requests', DemoRequestController::class)->middleware('throttle:demo-request');
    Route::post('/auth/password', [AuthController::class, 'changePassword'])->middleware('auth:sanctum');
    Route::put('/auth/locale', [AuthController::class, 'updateLocale'])->middleware('auth:sanctum');
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/auth/avatar', [AuthAvatarController::class, 'show']);
        Route::post('/auth/avatar', [AuthAvatarController::class, 'store']);
        Route::delete('/auth/avatar', [AuthAvatarController::class, 'destroy']);
        Route::post('/auth/orgs/leave', [AuthController::class, 'leaveOrg']);
        Route::post('/auth/orgs/{tenant}/enter', [AuthController::class, 'enterOrg']);
        Route::post('/auth/orgs/{tenant}/switch', [AuthController::class, 'switchOrg'])->middleware('throttle:auth-login');
    });

    Route::middleware(['auth:sanctum', EnsurePlatformStaff::class])->prefix('msp')->group(function (): void {
        Route::get('/tenants', [TenantController::class, 'index']);
        Route::post('/tenants', [TenantController::class, 'store']);
        Route::post('/tenants/leave', [TenantController::class, 'leave']);
        Route::post('/tenants/{tenant}/enter', [TenantController::class, 'enter']);
        Route::put('/tenants/{tenant}', [TenantController::class, 'update']);
    });

    // Copilot Studio custom connector. Not Sanctum: AuthenticateAssistantTool checks the connector key and the conversation token.
    Route::middleware([AuthenticateAssistantTool::class, 'throttle:assistant-tools'])
        ->prefix('assistant/tools')
        ->group(function (): void {
            Route::post('/{tool}', AssistantToolController::class)->where('tool', '[a-z_]+');
        });

    Route::middleware([
        'auth:sanctum',
        InitializeTenancyByHeader::class,
        EnsureOrgMembership::class,
        SetPermissionsTeamFromTenant::class,
        EnsureSubscriptionWritable::class,
        'throttle:tenant-api',
    ])
        ->prefix('org')
        ->group(function (): void {
            // Learner-accessible training (membership only, requires the learner portal plan feature).
            Route::middleware('plan.feature:'.PlanFeature::LearnerPortal->value)->group(function (): void {
                Route::get('/training/assignments', [TrainingController::class, 'myAssignments']);
                Route::post('/training/progress', [TrainingController::class, 'completeLesson']);
                Route::post('/training/attestation', [TrainingController::class, 'attest']);
                Route::post('/training/progress/lesson', [TrainingController::class, 'updateLessonProgress']);
                Route::post('/training/quiz', [TrainingController::class, 'submitQuiz']);
                Route::get('/training/media/{lesson}', [TrainingController::class, 'streamMedia']);
            });

            // Inbox + branding for any org member.
            Route::get('/notifications', [NotificationController::class, 'index']);
            Route::post('/notifications/read', [NotificationController::class, 'markRead']);
            Route::get('/announcements', [AnnouncementController::class, 'index']);
            Route::get('/branding', [BrandingController::class, 'show']);
            Route::get('/branding/logo', [BrandingController::class, 'streamLogo']);

            // HRneck chat assistant. Any member may chat; each tool checks the permission it needs.
            Route::prefix('assistant')->group(function (): void {
                Route::get('/status', [AssistantController::class, 'status']);
                Route::post('/conversations', [AssistantController::class, 'startConversation']);
                Route::post('/conversations/{conversation}/messages', [AssistantController::class, 'sendMessage'])
                    ->middleware('throttle:assistant-messages');
                Route::post('/pending-actions/{pendingAction}/confirm', [AssistantController::class, 'confirmPendingAction'])
                    ->whereNumber('pendingAction');
                Route::post('/pending-actions/{pendingAction}/cancel', [AssistantController::class, 'cancelPendingAction'])
                    ->whereNumber('pendingAction');
            });

            Route::middleware('permission:'.OrgPermissionCatalog::USERS_VIEW.'|'.OrgPermissionCatalog::USERS_MANAGE)->group(function (): void {
                Route::get('/users', [OrgUserController::class, 'index']);
                Route::get('/users/{user}/avatar', [UserAvatarController::class, 'show']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::USERS_MANAGE)->group(function (): void {
                Route::post('/users', [OrgUserController::class, 'store']);
                Route::patch('/users/{user}', [OrgUserController::class, 'update']);
                Route::put('/users/{user}/roles', [OrgUserController::class, 'syncRoles']);
                Route::delete('/users/{user}', [OrgUserController::class, 'destroy']);
                Route::post('/users/{user}/avatar', [UserAvatarController::class, 'store']);
                Route::delete('/users/{user}/avatar', [UserAvatarController::class, 'destroy']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::ROLES_MANAGE)->group(function (): void {
                Route::get('/permissions', [OrgRoleController::class, 'permissions']);
                Route::get('/roles', [OrgRoleController::class, 'index']);
                Route::post('/roles', [OrgRoleController::class, 'store']);
                Route::put('/roles/{role}', [OrgRoleController::class, 'update']);
                Route::delete('/roles/{role}', [OrgRoleController::class, 'destroy']);
            });

            // Groups managers need the target picker, and user viewers see the merged employee list (with roles),
            // so GROUPS_* and USERS_* also unlock the list and avatars.
            Route::get('/targets', [TargetController::class, 'index'])
                ->middleware('permission:'.OrgPermissionCatalog::TARGETS_VIEW.'|'.OrgPermissionCatalog::TARGETS_MANAGE.'|'.OrgPermissionCatalog::GROUPS_VIEW.'|'.OrgPermissionCatalog::GROUPS_MANAGE.'|'.OrgPermissionCatalog::USERS_VIEW.'|'.OrgPermissionCatalog::USERS_MANAGE);
            Route::get('/targets/{target}/avatar', [TargetAvatarController::class, 'show'])
                ->middleware('permission:'.OrgPermissionCatalog::TARGETS_VIEW.'|'.OrgPermissionCatalog::TARGETS_MANAGE.'|'.OrgPermissionCatalog::GROUPS_VIEW.'|'.OrgPermissionCatalog::GROUPS_MANAGE.'|'.OrgPermissionCatalog::USERS_VIEW.'|'.OrgPermissionCatalog::USERS_MANAGE);
            Route::get('/targets/{target}', [TargetController::class, 'show'])
                ->middleware('permission:'.OrgPermissionCatalog::TARGETS_VIEW.'|'.OrgPermissionCatalog::TARGETS_MANAGE);

            Route::middleware('permission:'.OrgPermissionCatalog::TARGETS_MANAGE)->group(function (): void {
                Route::post('/targets/import', [TargetImportController::class, 'importLegacy']);
                Route::post('/targets/import/sessions', [TargetImportController::class, 'storeSession']);
                Route::post('/targets/import/sessions/{session}/preview', [TargetImportController::class, 'preview']);
                Route::post('/targets/import/sessions/{session}/commit', [TargetImportController::class, 'commit']);
                Route::get('/targets/import/mappings', [TargetImportController::class, 'indexMappings']);
                Route::post('/targets/import/mappings', [TargetImportController::class, 'storeMapping']);
                Route::patch('/targets/import/mappings/{mapping}', [TargetImportController::class, 'updateMapping']);
                Route::delete('/targets/import/mappings/{mapping}', [TargetImportController::class, 'destroyMapping']);
                Route::post('/targets', [TargetController::class, 'store']);
                Route::patch('/targets/{target}', [TargetController::class, 'update']);
                Route::delete('/targets/{target}', [TargetController::class, 'destroy']);
                Route::post('/targets/{target}/recalculate-risk', [TargetController::class, 'recalculateRisk']);
                Route::post('/targets/{target}/password', [TargetController::class, 'setPassword']);
                Route::post('/targets/{target}/avatar', [TargetAvatarController::class, 'store']);
                Route::delete('/targets/{target}/avatar', [TargetAvatarController::class, 'destroy']);
            });

            Route::get('/departments', [DepartmentController::class, 'index'])
                ->middleware('permission:'.OrgPermissionCatalog::DEPARTMENTS_VIEW.'|'.OrgPermissionCatalog::DEPARTMENTS_MANAGE.'|'.OrgPermissionCatalog::TARGETS_MANAGE.'|'.OrgPermissionCatalog::USERS_MANAGE.'|'.OrgPermissionCatalog::REPORTS_VIEW);

            Route::middleware('permission:'.OrgPermissionCatalog::DEPARTMENTS_MANAGE)->group(function (): void {
                Route::post('/departments', [DepartmentController::class, 'store']);
                Route::patch('/departments/{department}', [DepartmentController::class, 'update']);
                Route::delete('/departments/{department}', [DepartmentController::class, 'destroy']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::GROUPS_VIEW.'|'.OrgPermissionCatalog::GROUPS_MANAGE)->group(function (): void {
                Route::get('/groups', [GroupController::class, 'index']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::GROUPS_MANAGE)->group(function (): void {
                Route::post('/groups', [GroupController::class, 'store']);
                Route::patch('/groups/{group}', [GroupController::class, 'update']);
                Route::delete('/groups/{group}', [GroupController::class, 'destroy']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::CAMPAIGNS_VIEW.'|'.OrgPermissionCatalog::CAMPAIGNS_MANAGE)->group(function (): void {
                Route::get('/campaigns', [CampaignController::class, 'index']);
                Route::get('/campaigns/dashboard', [CampaignController::class, 'dashboard']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::CAMPAIGNS_MANAGE)->group(function (): void {
                Route::post('/campaigns', [CampaignController::class, 'store']);
                Route::patch('/campaigns/{campaign}', [CampaignController::class, 'update']);
                Route::delete('/campaigns/{campaign}', [CampaignController::class, 'destroy']);
                Route::post('/campaigns/{campaign}/courses', [CampaignCourseController::class, 'store']);
                Route::put('/campaigns/{campaign}/courses/order', [CampaignCourseController::class, 'reorder']);
                Route::delete('/campaigns/{campaign}/courses/{course}', [CampaignCourseController::class, 'destroy']);
            });

            // Campaign builders pick courses from this list, so CAMPAIGNS_MANAGE may read it.
            Route::middleware(['permission:'.OrgPermissionCatalog::TRAINING_VIEW.'|'.OrgPermissionCatalog::TRAINING_MANAGE.'|'.OrgPermissionCatalog::CAMPAIGNS_MANAGE, 'plan.feature:'.PlanFeature::Training->value])->group(function (): void {
                Route::get('/training/courses', [TrainingController::class, 'courses']);
            });

            Route::middleware(['permission:'.OrgPermissionCatalog::TRAINING_VIEW.'|'.OrgPermissionCatalog::TRAINING_MANAGE, 'plan.feature:'.PlanFeature::Training->value])->group(function (): void {
                Route::get('/training/enrollments', [TrainingController::class, 'enrollments']);
                Route::get('/training/enrollments/export', [TrainingController::class, 'exportEnrollments']);
                Route::get('/training/enrollments/export/pdf', [TrainingController::class, 'exportEnrollmentsPdf']);
            });

            Route::middleware(['permission:'.OrgPermissionCatalog::TRAINING_MANAGE, 'plan.feature:'.PlanFeature::Training->value])->group(function (): void {
                Route::post('/training/courses', [TrainingController::class, 'storeCourse']);
                Route::patch('/training/courses/{course}', [TrainingController::class, 'updateCourse']);
                Route::delete('/training/courses/{course}', [TrainingController::class, 'destroyCourse']);
                Route::post('/training/courses/{course}/lessons', [TrainingController::class, 'storeLesson']);
                Route::patch('/training/courses/{course}/lessons/{lesson}', [TrainingController::class, 'updateLesson']);
                Route::delete('/training/courses/{course}/lessons/{lesson}', [TrainingController::class, 'destroyLesson']);
                Route::put('/training/courses/{course}/quiz', [TrainingController::class, 'upsertQuiz']);
                Route::post('/training/courses/{course}/quizzes', [TrainingController::class, 'storeQuiz']);
                Route::put('/training/courses/{course}/quizzes/{quiz}', [TrainingController::class, 'updateQuiz']);
                Route::delete('/training/courses/{course}/quizzes/{quiz}', [TrainingController::class, 'destroyQuiz']);
                Route::post('/training/media/upload', [TrainingController::class, 'uploadMedia']);
                Route::post('/training/assign', [TrainingController::class, 'assign']);
            });

            Route::middleware(['permission:'.OrgPermissionCatalog::CHECKLISTS_VIEW.'|'.OrgPermissionCatalog::CHECKLISTS_MANAGE, 'plan.feature:'.PlanFeature::Checklists->value])->group(function (): void {
                Route::get('/checklists/templates', [ChecklistController::class, 'templates']);
                Route::get('/checklists/templates/{template}', [ChecklistController::class, 'showTemplate']);
                Route::get('/checklists/packs', [ChecklistController::class, 'packs']);
                Route::get('/checklists/packs/{pack}', [ChecklistController::class, 'showPack']);
                Route::get('/checklists/instances/{instance}/audit', [ChecklistController::class, 'instanceAudit']);
                Route::get('/checklists/audit', [ChecklistController::class, 'audit']);
            });

            // Fillers answer instances; they see instances but cannot manage templates, packs or assignments.
            Route::middleware(['permission:'.OrgPermissionCatalog::CHECKLISTS_VIEW.'|'.OrgPermissionCatalog::CHECKLISTS_FILL.'|'.OrgPermissionCatalog::CHECKLISTS_MANAGE, 'plan.feature:'.PlanFeature::Checklists->value])->group(function (): void {
                Route::get('/checklists/instances', [ChecklistController::class, 'instances']);
                Route::get('/checklists/instances/{instance}', [ChecklistController::class, 'showInstance']);
                Route::get('/checklists/instances/{instance}/media/{itemKey}', [ChecklistController::class, 'streamMedia']);
            });

            Route::middleware(['permission:'.OrgPermissionCatalog::CHECKLISTS_FILL.'|'.OrgPermissionCatalog::CHECKLISTS_MANAGE, 'plan.feature:'.PlanFeature::Checklists->value])->group(function (): void {
                Route::patch('/checklists/instances/{instance}', [ChecklistController::class, 'updateInstance']);
                Route::post('/checklists/media/upload', [ChecklistController::class, 'uploadMedia']);
            });

            Route::middleware(['permission:'.OrgPermissionCatalog::CHECKLISTS_MANAGE, 'plan.feature:'.PlanFeature::Checklists->value])->group(function (): void {
                Route::post('/checklists/templates', [ChecklistController::class, 'storeTemplate']);
                Route::patch('/checklists/templates/{template}', [ChecklistController::class, 'updateTemplate']);
                Route::post('/checklists/templates/{template}/from-system', [ChecklistController::class, 'copyFromSystem']);
                Route::post('/checklists/packs', [ChecklistController::class, 'storePack']);
                Route::patch('/checklists/packs/{pack}', [ChecklistController::class, 'updatePack']);
                Route::post('/checklists/packs/{pack}/assign', [ChecklistController::class, 'assignPack']);
                Route::post('/checklists/instances', [ChecklistController::class, 'storeInstances']);
            });

            Route::middleware(['permission:'.OrgPermissionCatalog::TICKETING_TICKETS, 'plan.feature:'.PlanFeature::Ticketing->value])->prefix('ticketing')->group(function (): void {
                Route::get('/tickets', [TicketController::class, 'index']);
                Route::post('/tickets', [TicketController::class, 'store']);
                Route::get('/tickets/{ticket}', [TicketController::class, 'show']);
                Route::patch('/tickets/{ticket}', [TicketController::class, 'update']);
                Route::post('/tickets/bulk', [TicketController::class, 'bulk']);
                Route::post('/tickets/{ticket}/copy', [TicketController::class, 'copy']);
                Route::post('/tickets/{ticket}/notes', [TicketController::class, 'addNote']);
                Route::post('/tickets/{ticket}/tasks', [TicketController::class, 'addTask']);
                Route::patch('/tickets/{ticket}/tasks/{task}', [TicketController::class, 'updateTask']);
                Route::post('/tickets/{ticket}/attachments', [TicketController::class, 'uploadAttachment']);
                Route::get('/tickets/{ticket}/attachments/{attachment}', [TicketController::class, 'downloadAttachment']);
                Route::get('/desks', [TicketingDeskController::class, 'index']);
                Route::get('/desks/{desk}', [TicketingDeskController::class, 'show']);
                Route::get('/search', TicketingSearchController::class);
                Route::get('/preferences', [TicketController::class, 'preferences']);
                Route::put('/preferences', [TicketController::class, 'updatePreferences']);
            });

            Route::middleware(['permission:'.OrgPermissionCatalog::KB_VIEW.'|'.OrgPermissionCatalog::KB_MANAGE, 'plan.feature:'.PlanFeature::KnowledgeBase->value])->prefix('ticketing')->group(function (): void {
                Route::get('/kb', [KbController::class, 'index']);
                Route::get('/kb/{article}', [KbController::class, 'show']);
            });

            Route::middleware(['permission:'.OrgPermissionCatalog::KB_MANAGE, 'plan.feature:'.PlanFeature::KnowledgeBase->value])->prefix('ticketing')->group(function (): void {
                Route::post('/kb', [KbController::class, 'store']);
                Route::patch('/kb/{article}', [KbController::class, 'update']);
                Route::delete('/kb/{article}', [KbController::class, 'destroy']);
                Route::post('/tickets/{ticket}/convert-kb', [TicketController::class, 'convertToKb']);
            });

            Route::middleware(['permission:'.OrgPermissionCatalog::TICKETING_ADMIN, 'plan.feature:'.PlanFeature::Ticketing->value])->prefix('ticketing')->group(function (): void {
                Route::post('/desks', [TicketingDeskController::class, 'store']);
                Route::patch('/desks/{desk}', [TicketingDeskController::class, 'update']);
                Route::post('/desks/{desk}/stages', [TicketingDeskController::class, 'storeStage']);
                Route::patch('/desks/{desk}/stages/{stage}', [TicketingDeskController::class, 'updateStage']);
                Route::post('/desks/{desk}/support/{table}', [TicketingDeskController::class, 'storeSupport']);
                Route::post('/desks/{desk}/procedures', [TicketingDeskController::class, 'storeProcedure']);
                Route::patch('/desks/{desk}/procedures/{procedure}', [TicketingDeskController::class, 'updateProcedure']);
                Route::post('/desks/{desk}/sla', [TicketingDeskController::class, 'storeSla']);
                Route::patch('/desks/{desk}/sla/{policy}', [TicketingDeskController::class, 'updateSla']);
                Route::get('/email-readers', [EmailReaderController::class, 'index']);
                Route::post('/email-readers', [EmailReaderController::class, 'store']);
                Route::patch('/email-readers/{reader}', [EmailReaderController::class, 'update']);
                Route::delete('/email-readers/{reader}', [EmailReaderController::class, 'destroy']);
                Route::post('/email-readers/{reader}/ingest', [EmailReaderController::class, 'ingest']);
                Route::post('/export', [TicketController::class, 'export']);
                Route::post('/import', [TicketController::class, 'import']);
                Route::get('/templates', [TemplateController::class, 'index']);
                Route::post('/templates/messages', [TemplateController::class, 'storeMessage']);
                Route::delete('/templates/messages/{template}', [TemplateController::class, 'destroyMessage']);
                Route::post('/templates/notes', [TemplateController::class, 'storeNote']);
                Route::delete('/templates/notes/{template}', [TemplateController::class, 'destroyNote']);
            });

            Route::middleware(['permission:'.OrgPermissionCatalog::TICKETING_REPORTS, 'plan.feature:'.PlanFeature::Ticketing->value])->prefix('ticketing')->group(function (): void {
                Route::get('/reports/summary', [TicketingReportController::class, 'summary']);
                Route::get('/reports/csv', [TicketingReportController::class, 'csv']);
                Route::get('/reports/pdf', [TicketingReportController::class, 'pdf']);
            });

            Route::middleware(['permission:'.OrgPermissionCatalog::TICKETING_PORTAL, 'plan.feature:'.PlanFeature::Ticketing->value])->prefix('portal/ticketing')->group(function (): void {
                Route::get('/desks', [PortalTicketingController::class, 'desks']);
                Route::get('/tickets', [PortalTicketingController::class, 'index']);
                Route::post('/tickets', [PortalTicketingController::class, 'store']);
                Route::get('/tickets/{ticket}', [PortalTicketingController::class, 'show']);
                Route::post('/tickets/{ticket}/notes', [PortalTicketingController::class, 'addNote']);
                Route::get('/kb', [PortalTicketingController::class, 'kb']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::REPORTS_VIEW)->group(function (): void {
                Route::get('/reports/summary', [ReportController::class, 'summary']);
                Route::middleware('plan.feature:'.PlanFeature::AdvancedReporting->value)->group(function (): void {
                    Route::get('/reports/detailed', [ReportController::class, 'detailed']);
                    Route::get('/reports/detailed/{section}/csv', [ReportController::class, 'detailedSectionCsv']);
                    Route::get('/reports/detailed/{section}', [ReportController::class, 'detailedSection']);
                });
                Route::post('/reports/email', [ReportController::class, 'email'])
                    ->middleware('permission:'.OrgPermissionCatalog::REPORTS_EXPORT);
                Route::get('/reports/recipients', [ReportScheduleController::class, 'recipients']);
                Route::get('/reports/schedules', [ReportScheduleController::class, 'index']);
                Route::post('/reports/schedules', [ReportScheduleController::class, 'store']);
                Route::patch('/reports/schedules/{schedule}', [ReportScheduleController::class, 'update']);
                Route::delete('/reports/schedules/{schedule}', [ReportScheduleController::class, 'destroy']);
            });

            Route::middleware(['permission:'.OrgPermissionCatalog::REPORTS_EXPORT, 'plan.feature:'.PlanFeature::AdvancedReporting->value])->group(function (): void {
                Route::get('/reports/export', [ReportExportController::class, 'index']);
                Route::get('/reports/export/calendar', [ReportExportController::class, 'calendar']);
                Route::get('/reports/export/options', [ReportExportController::class, 'options']);
                Route::post('/reports/export', [ReportExportController::class, 'generate']);
                Route::get('/reports/export/{archive}/download', [ReportExportController::class, 'download']);
                Route::delete('/reports/export/{archive}', [ReportExportController::class, 'destroy']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::ANNOUNCEMENTS_MANAGE)->group(function (): void {
                Route::post('/announcements', [AnnouncementController::class, 'store']);
                Route::patch('/announcements/{announcement}', [AnnouncementController::class, 'update']);
                Route::delete('/announcements/{announcement}', [AnnouncementController::class, 'destroy']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::AUDIT_VIEW)->group(function (): void {
                Route::get('/audit', [AuditLogController::class, 'index']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::SETTINGS_VIEW.'|'.OrgPermissionCatalog::SETTINGS_MANAGE)->group(function (): void {
                Route::get('/settings', [SettingsController::class, 'show']);
                Route::get('/domains', [CustomDomainController::class, 'show']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::SETTINGS_MANAGE)->group(function (): void {
                Route::put('/settings', [SettingsController::class, 'update']);
                Route::post('/settings/logo', [BrandingController::class, 'uploadLogo'])
                    ->middleware('plan.feature:'.PlanFeature::WhiteLabel->value);
                Route::put('/domains', [CustomDomainController::class, 'update']);
                Route::get('/sending-profiles', [SendingProfileController::class, 'index']);
                Route::post('/sending-profiles', [SendingProfileController::class, 'store']);
                Route::patch('/sending-profiles/{sending_profile}', [SendingProfileController::class, 'update']);
                Route::delete('/sending-profiles/{sending_profile}', [SendingProfileController::class, 'destroy']);
                Route::get('/integrations', IntegrationController::class);
                Route::post('/webhooks/test', WebhookStubController::class);
            });
        });
});
