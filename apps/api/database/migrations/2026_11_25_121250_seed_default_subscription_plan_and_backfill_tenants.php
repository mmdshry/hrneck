<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const FEATURE_KEYS = [
        'custom_domains',
        'advanced_reporting',
        'automation_rules',
        'white_label',
        'learner_portal',
        'training',
        'ticketing',
        'checklists',
    ];

    public function up(): void
    {
        $now = now();

        $defaultPlanId = DB::table('subscription_plans')->where('is_default', true)->value('id');
        if ($defaultPlanId === null) {
            $defaultPlanId = DB::table('subscription_plans')->insertGetId([
                'name' => 'Standard',
                'slug' => 'standard',
                'sort_order' => 10,
                'max_employees' => null,
                'max_users' => null,
                'features' => json_encode(array_fill_keys(self::FEATURE_KEYS, true), JSON_THROW_ON_ERROR),
                'monthly_price' => null,
                'currency' => 'USD',
                'is_default' => true,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $subscribedTenantIds = DB::table('tenant_subscriptions')->pluck('tenant_id')->flip();

        DB::table('tenants')
            ->pluck('id')
            ->reject(fn (string $tenantId): bool => $subscribedTenantIds->has($tenantId))
            ->chunk(500)
            ->each(function ($chunk) use ($defaultPlanId, $now): void {
                DB::table('tenant_subscriptions')->insert($chunk->map(fn (string $tenantId): array => [
                    'tenant_id' => $tenantId,
                    'subscription_plan_id' => $defaultPlanId,
                    'status' => 'active',
                    'starts_at' => $now,
                    'trial_ends_at' => null,
                    'ends_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->values()->all());
            });
    }

    public function down(): void
    {
        //
    }
};
