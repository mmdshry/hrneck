<?php

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\Msp\TenantController;
use App\Http\Controllers\Api\V1\Org\AnnouncementController;
use App\Http\Controllers\Api\V1\Org\BrandingController;
use App\Http\Controllers\Api\V1\Org\CampaignController;
use App\Http\Controllers\Api\V1\Org\ChecklistController;
use App\Http\Controllers\Api\V1\Org\CustomDomainController;
use App\Http\Controllers\Api\V1\Org\DirectorySyncController;
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
use App\Http\Controllers\Api\V1\Org\TargetController;
use App\Http\Controllers\Api\V1\Org\TrainingController;
use App\Http\Controllers\Api\V1\Org\Ticketing\DeskController as TicketingDeskController;
use App\Http\Controllers\Api\V1\Org\Ticketing\EmailReaderController;
use App\Http\Controllers\Api\V1\Org\Ticketing\KbController;
use App\Http\Controllers\Api\V1\Org\Ticketing\SearchController as TicketingSearchController;
use App\Http\Controllers\Api\V1\Org\Ticketing\TemplateController;
use App\Http\Controllers\Api\V1\Org\Ticketing\TicketController;
use App\Http\Controllers\Api\V1\Org\Ticketing\TicketingReportController;
use App\Http\Controllers\Api\V1\Org\WebhookStubController;
use App\Http\Controllers\Api\V1\Portal\PortalTicketingController;
use App\Http\Middleware\EnsureOrgMembership;
use App\Http\Middleware\EnsurePlatformStaff;
use App\Http\Middleware\InitializeTenancyByHeader;
use App\Http\Middleware\SetPermissionsTeamFromTenant;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', HealthController::class)->name('api.v1.health');

    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:tenant-api');
    Route::post('/auth/mfa/verify', [AuthController::class, 'verifyMfa'])->middleware('throttle:mfa');
    Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    // Guest-friendly: returns 200 with data:null so browsers/LHCI do not log 401 noise.
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/mfa/setup', [AuthController::class, 'setupMfa'])->middleware(['auth:sanctum', 'throttle:mfa']);
    Route::post('/auth/mfa/confirm', [AuthController::class, 'confirmMfa'])->middleware(['auth:sanctum', 'throttle:mfa']);

    Route::middleware(['auth:sanctum', EnsurePlatformStaff::class])->prefix('msp')->group(function (): void {
        Route::get('/tenants', [TenantController::class, 'index']);
        Route::post('/tenants', [TenantController::class, 'store']);
        Route::put('/tenants/{tenant}', [TenantController::class, 'update']);
    });

    Route::middleware([
        'auth:sanctum',
        InitializeTenancyByHeader::class,
        EnsureOrgMembership::class,
        SetPermissionsTeamFromTenant::class,
        'throttle:tenant-api',
    ])
        ->prefix('org')
        ->group(function (): void {
            // Learner-accessible training (membership only).
            Route::get('/training/assignments', [TrainingController::class, 'myAssignments']);
            Route::post('/training/progress', [TrainingController::class, 'completeLesson']);
            Route::post('/training/progress/lesson', [TrainingController::class, 'updateLessonProgress']);
            Route::post('/training/quiz', [TrainingController::class, 'submitQuiz']);
            Route::get('/training/media/{lesson}', [TrainingController::class, 'streamMedia']);

            // Inbox + branding for any org member.
            Route::get('/notifications', [NotificationController::class, 'index']);
            Route::post('/notifications/read', [NotificationController::class, 'markRead']);
            Route::get('/announcements', [AnnouncementController::class, 'index']);
            Route::get('/branding', [BrandingController::class, 'show']);
            Route::get('/branding/logo', [BrandingController::class, 'streamLogo']);

            Route::middleware('permission:'.OrgPermissionCatalog::USERS_MANAGE)->group(function (): void {
                Route::get('/users', [OrgUserController::class, 'index']);
                Route::post('/users', [OrgUserController::class, 'store']);
                Route::patch('/users/{user}', [OrgUserController::class, 'update']);
                Route::put('/users/{user}/roles', [OrgUserController::class, 'syncRoles']);
                Route::delete('/users/{user}', [OrgUserController::class, 'destroy']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::ROLES_MANAGE)->group(function (): void {
                Route::get('/permissions', [OrgRoleController::class, 'permissions']);
                Route::get('/roles', [OrgRoleController::class, 'index']);
                Route::post('/roles', [OrgRoleController::class, 'store']);
                Route::put('/roles/{role}', [OrgRoleController::class, 'update']);
                Route::delete('/roles/{role}', [OrgRoleController::class, 'destroy']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::TARGETS_MANAGE)->group(function (): void {
                Route::get('/targets', [TargetController::class, 'index']);
                Route::post('/targets', [TargetController::class, 'store']);
                Route::patch('/targets/{target}', [TargetController::class, 'update']);
                Route::delete('/targets/{target}', [TargetController::class, 'destroy']);
                Route::post('/targets/import', [TargetController::class, 'importCsv']);
                Route::post('/directory-sync', DirectorySyncController::class);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::GROUPS_MANAGE)->group(function (): void {
                Route::get('/groups', [GroupController::class, 'index']);
                Route::post('/groups', [GroupController::class, 'store']);
                Route::patch('/groups/{group}', [GroupController::class, 'update']);
                Route::delete('/groups/{group}', [GroupController::class, 'destroy']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::CAMPAIGNS_MANAGE)->group(function (): void {
                Route::get('/campaigns', [CampaignController::class, 'index']);
                Route::get('/campaigns/dashboard', [CampaignController::class, 'dashboard']);
                Route::post('/campaigns', [CampaignController::class, 'store']);
                Route::patch('/campaigns/{campaign}', [CampaignController::class, 'update']);
                Route::delete('/campaigns/{campaign}', [CampaignController::class, 'destroy']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::TRAINING_MANAGE)->group(function (): void {
                Route::get('/training/courses', [TrainingController::class, 'courses']);
                Route::post('/training/courses', [TrainingController::class, 'storeCourse']);
                Route::patch('/training/courses/{course}', [TrainingController::class, 'updateCourse']);
                Route::delete('/training/courses/{course}', [TrainingController::class, 'destroyCourse']);
                Route::post('/training/courses/{course}/lessons', [TrainingController::class, 'storeLesson']);
                Route::patch('/training/courses/{course}/lessons/{lesson}', [TrainingController::class, 'updateLesson']);
                Route::delete('/training/courses/{course}/lessons/{lesson}', [TrainingController::class, 'destroyLesson']);
                Route::put('/training/courses/{course}/quiz', [TrainingController::class, 'upsertQuiz']);
                Route::post('/training/media/upload', [TrainingController::class, 'uploadMedia']);
                Route::get('/training/enrollments', [TrainingController::class, 'enrollments']);
                Route::get('/training/enrollments/export', [TrainingController::class, 'exportEnrollments']);
                Route::get('/training/enrollments/export/pdf', [TrainingController::class, 'exportEnrollmentsPdf']);
                Route::post('/training/assign', [TrainingController::class, 'assign']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::CHECKLISTS_MANAGE)->group(function (): void {
                Route::get('/checklists/templates', [ChecklistController::class, 'templates']);
                Route::post('/checklists/templates', [ChecklistController::class, 'storeTemplate']);
                Route::get('/checklists/templates/{template}', [ChecklistController::class, 'showTemplate']);
                Route::patch('/checklists/templates/{template}', [ChecklistController::class, 'updateTemplate']);
                Route::post('/checklists/templates/{template}/from-system', [ChecklistController::class, 'copyFromSystem']);
                Route::get('/checklists/instances', [ChecklistController::class, 'instances']);
                Route::post('/checklists/instances', [ChecklistController::class, 'storeInstances']);
                Route::get('/checklists/instances/{instance}', [ChecklistController::class, 'showInstance']);
                Route::patch('/checklists/instances/{instance}', [ChecklistController::class, 'updateInstance']);
                Route::get('/checklists/instances/{instance}/audit', [ChecklistController::class, 'instanceAudit']);
                Route::get('/checklists/instances/{instance}/media/{itemKey}', [ChecklistController::class, 'streamMedia']);
                Route::post('/checklists/media/upload', [ChecklistController::class, 'uploadMedia']);
                Route::get('/checklists/audit', [ChecklistController::class, 'audit']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::TICKETING_TICKETS)->prefix('ticketing')->group(function (): void {
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

            Route::middleware('permission:'.OrgPermissionCatalog::TICKETING_KB)->prefix('ticketing')->group(function (): void {
                Route::get('/kb', [KbController::class, 'index']);
                Route::post('/kb', [KbController::class, 'store']);
                Route::get('/kb/{article}', [KbController::class, 'show']);
                Route::patch('/kb/{article}', [KbController::class, 'update']);
                Route::delete('/kb/{article}', [KbController::class, 'destroy']);
                Route::post('/tickets/{ticket}/convert-kb', [TicketController::class, 'convertToKb']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::TICKETING_ADMIN)->prefix('ticketing')->group(function (): void {
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

            Route::middleware('permission:'.OrgPermissionCatalog::TICKETING_REPORTS)->prefix('ticketing')->group(function (): void {
                Route::get('/reports/summary', [TicketingReportController::class, 'summary']);
                Route::get('/reports/csv', [TicketingReportController::class, 'csv']);
                Route::get('/reports/pdf', [TicketingReportController::class, 'pdf']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::TICKETING_PORTAL)->prefix('portal/ticketing')->group(function (): void {
                Route::get('/desks', [PortalTicketingController::class, 'desks']);
                Route::get('/tickets', [PortalTicketingController::class, 'index']);
                Route::post('/tickets', [PortalTicketingController::class, 'store']);
                Route::get('/tickets/{ticket}', [PortalTicketingController::class, 'show']);
                Route::post('/tickets/{ticket}/notes', [PortalTicketingController::class, 'addNote']);
                Route::get('/kb', [PortalTicketingController::class, 'kb']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::REPORTS_VIEW)->group(function (): void {
                Route::get('/reports/summary', [ReportController::class, 'summary']);
                Route::get('/reports/detailed', [ReportController::class, 'detailed']);
                Route::get('/reports/detailed/{section}/csv', [ReportController::class, 'detailedSectionCsv']);
                Route::get('/reports/detailed/{section}', [ReportController::class, 'detailedSection']);
                Route::post('/reports/email', [ReportController::class, 'email']);
                Route::get('/reports/schedules', [ReportScheduleController::class, 'index']);
                Route::post('/reports/schedules', [ReportScheduleController::class, 'store']);
                Route::patch('/reports/schedules/{schedule}', [ReportScheduleController::class, 'update']);
                Route::delete('/reports/schedules/{schedule}', [ReportScheduleController::class, 'destroy']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::REPORTS_EXPORT)->group(function (): void {
                Route::get('/reports/export', [ReportExportController::class, 'index']);
                Route::get('/reports/export/calendar', [ReportExportController::class, 'calendar']);
                Route::post('/reports/export', [ReportExportController::class, 'generate']);
                Route::get('/reports/export/{archive}/download', [ReportExportController::class, 'download']);
                Route::delete('/reports/export/{archive}', [ReportExportController::class, 'destroy']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::ANNOUNCEMENTS_MANAGE)->group(function (): void {
                Route::post('/announcements', [AnnouncementController::class, 'store']);
                Route::patch('/announcements/{announcement}', [AnnouncementController::class, 'update']);
                Route::delete('/announcements/{announcement}', [AnnouncementController::class, 'destroy']);
            });

            Route::middleware('permission:'.OrgPermissionCatalog::SETTINGS_MANAGE)->group(function (): void {
                Route::get('/settings', [SettingsController::class, 'show']);
                Route::put('/settings', [SettingsController::class, 'update']);
                Route::post('/settings/logo', [BrandingController::class, 'uploadLogo']);
                Route::get('/domains', [CustomDomainController::class, 'show']);
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
