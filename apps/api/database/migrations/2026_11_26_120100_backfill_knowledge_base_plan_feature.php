<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Adds the knowledge_base plan feature. Plans that included ticketing keep knowledge base access;
 * plans without ticketing stay without it, matching the old gate.
 *
 * Literal keys are used on purpose so later catalog changes cannot alter this migration.
 */
return new class extends Migration
{
    private const FEATURE = 'knowledge_base';

    private const PREVIOUS_GATE = 'ticketing';

    public function up(): void
    {
        DB::table('subscription_plans')
            ->chunkById(100, function ($plans): void {
                foreach ($plans as $plan) {
                    $features = json_decode((string) $plan->features, true, 512, JSON_THROW_ON_ERROR) ?? [];

                    if (array_key_exists(self::FEATURE, $features)) {
                        continue;
                    }

                    $features[self::FEATURE] = (bool) ($features[self::PREVIOUS_GATE] ?? false);

                    DB::table('subscription_plans')
                        ->where('id', $plan->id)
                        ->update(['features' => json_encode($features, JSON_THROW_ON_ERROR)]);
                }
            });
    }

    public function down(): void
    {
        // Intentionally empty: plan features may have been edited since.
    }
};
