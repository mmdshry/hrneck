<?php

use App\Domains\Subscriptions\Models\SubscriptionPlan;
use App\Domains\Subscriptions\Support\PlanFeature;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

function runKnowledgeBaseMigration(string $file): void
{
    $migration = require database_path('migrations/'.$file);
    $migration->up();
    app(PermissionRegistrar::class)->forgetCachedPermissions();
}

function permissionNamesForRole(int $roleId): array
{
    return DB::table('role_has_permissions')
        ->join('permissions', 'permissions.id', '=', 'role_has_permissions.permission_id')
        ->where('role_has_permissions.role_id', $roleId)
        ->pluck('permissions.name')
        ->all();
}

function permissionNamesForUser(User $user): array
{
    return DB::table('model_has_permissions')
        ->join('permissions', 'permissions.id', '=', 'model_has_permissions.permission_id')
        ->where('model_has_permissions.model_id', $user->getKey())
        ->where('model_has_permissions.model_type', $user->getMorphClass())
        ->pluck('permissions.name')
        ->all();
}

test('the knowledge base split moves legacy role and direct grants to view and manage', function () {
    setPermissionsTeamId(null);
    $legacy = Permission::query()->create([
        'name' => 'org.ticketing.kb',
        'guard_name' => 'web',
    ]);

    setPermissionsTeamId('itneck');
    $role = Role::query()->create([
        'name' => 'legacy_kb_role',
        'guard_name' => 'web',
        'tenant_id' => 'itneck',
    ]);
    $role->givePermissionTo($legacy);

    $member = orgAdmin();
    $member->givePermissionTo($legacy);
    setPermissionsTeamId(null);

    runKnowledgeBaseMigration('2026_11_26_120000_split_knowledge_base_permissions.php');

    $rolePermissions = permissionNamesForRole($role->getKey());
    expect($rolePermissions)->toContain('org.kb.view')
        ->and($rolePermissions)->toContain('org.kb.manage')
        ->and($rolePermissions)->not->toContain('org.ticketing.kb');

    $userPermissions = permissionNamesForUser($member);
    expect($userPermissions)->toContain('org.kb.view')
        ->and($userPermissions)->toContain('org.kb.manage')
        ->and($userPermissions)->not->toContain('org.ticketing.kb');

    expect(Permission::query()->where('name', 'org.ticketing.kb')->exists())->toBeFalse();
});

test('the plan feature backfill enables knowledge base only for plans that included ticketing', function () {
    $withTicketing = SubscriptionPlan::factory()->create();
    $withoutTicketing = SubscriptionPlan::factory()->create();

    DB::table('subscription_plans')->where('id', $withTicketing->getKey())->update([
        'features' => json_encode([PlanFeature::Ticketing->value => true, PlanFeature::Training->value => false]),
    ]);
    DB::table('subscription_plans')->where('id', $withoutTicketing->getKey())->update([
        'features' => json_encode([PlanFeature::Ticketing->value => false]),
    ]);

    runKnowledgeBaseMigration('2026_11_26_120100_backfill_knowledge_base_plan_feature.php');

    $enabled = json_decode((string) DB::table('subscription_plans')->where('id', $withTicketing->getKey())->value('features'), true);
    $disabled = json_decode((string) DB::table('subscription_plans')->where('id', $withoutTicketing->getKey())->value('features'), true);

    expect($enabled[PlanFeature::KnowledgeBase->value])->toBeTrue()
        ->and($disabled[PlanFeature::KnowledgeBase->value])->toBeFalse();
});
