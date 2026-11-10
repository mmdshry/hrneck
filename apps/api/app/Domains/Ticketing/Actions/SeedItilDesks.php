<?php

namespace App\Domains\Ticketing\Actions;

use App\Domains\Ticketing\Models\SdCategory;
use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\Ticketing\Models\SdKbArticle;
use App\Domains\Ticketing\Models\SdPriority;
use App\Domains\Ticketing\Models\SdProcedure;
use App\Domains\Ticketing\Models\SdSeverity;
use App\Domains\Ticketing\Models\SdSlaPolicy;
use App\Domains\Ticketing\Models\SdStage;
use App\Domains\Ticketing\Models\SdStatus;
use Illuminate\Support\Str;

class SeedItilDesks
{
    /** @var list<array{name: string, slug: string, type: string, prefix: string}> */
    private const DESKS = [
        ['name' => 'Incident Desk', 'slug' => 'incident', 'type' => 'incident', 'prefix' => 'INC'],
        ['name' => 'Problem Desk', 'slug' => 'problem', 'type' => 'problem', 'prefix' => 'PRB'],
        ['name' => 'Service Request Desk', 'slug' => 'service-request', 'type' => 'service_request', 'prefix' => 'SR'],
        ['name' => 'Change Desk', 'slug' => 'change', 'type' => 'change', 'prefix' => 'CHG'],
        ['name' => 'Knowledge Base', 'slug' => 'knowledge-base', 'type' => 'kb', 'prefix' => 'KB'],
    ];

    public function handle(): void
    {
        foreach (self::DESKS as $meta) {
            $desk = SdDesk::query()->firstOrCreate(
                ['slug' => $meta['slug']],
                [
                    'name' => $meta['name'],
                    'type' => $meta['type'],
                    'number_prefix' => $meta['prefix'],
                    'next_number' => 1,
                    'is_active' => true,
                    'is_system' => true,
                    'settings' => [],
                ],
            );

            $this->seedSupportTables($desk);
            $this->seedStages($desk);
            $this->seedSla($desk);
            $this->seedDefaultProcedure($desk);
        }

        $kbDesk = SdDesk::query()->where('slug', 'knowledge-base')->first();
        if ($kbDesk && SdKbArticle::query()->count() === 0) {
            SdKbArticle::query()->create([
                'desk_id' => $kbDesk->id,
                'number' => 'KB-000001',
                'summary' => 'Reset your password',
                'description' => 'Use the login page Forgot password link, or contact your org admin.',
                'is_published' => true,
            ]);
            $kbDesk->update(['next_number' => 2]);
        }
    }

    private function seedSupportTables(SdDesk $desk): void
    {
        $statusOrder = 0;
        foreach (['New' => false, 'In Progress' => false, 'Resolved' => true, 'Closed' => true] as $name => $closed) {
            SdStatus::query()->firstOrCreate(
                ['desk_id' => $desk->id, 'slug' => Str::slug($name)],
                ['name' => $name, 'is_closed' => $closed, 'sort_order' => $statusOrder++],
            );
        }

        $prioOrder = 0;
        foreach ([
            ['Low', 'low', 10],
            ['Medium', 'medium', 20],
            ['High', 'high', 30],
            ['Critical', 'critical', 40],
        ] as [$name, $slug, $weight]) {
            SdPriority::query()->firstOrCreate(
                ['desk_id' => $desk->id, 'slug' => $slug],
                ['name' => $name, 'weight' => $weight, 'sort_order' => $prioOrder++],
            );
        }

        $sevOrder = 0;
        foreach (['Minor', 'Major', 'Critical'] as $name) {
            SdSeverity::query()->firstOrCreate(
                ['desk_id' => $desk->id, 'slug' => Str::slug($name)],
                ['name' => $name, 'sort_order' => $sevOrder++],
            );
        }

        $catOrder = 0;
        foreach (['General', 'Access', 'Hardware', 'Software', 'Network'] as $name) {
            SdCategory::query()->firstOrCreate(
                ['desk_id' => $desk->id, 'slug' => Str::slug($name)],
                ['name' => $name, 'sort_order' => $catOrder++],
            );
        }
    }

    private function seedStages(SdDesk $desk): void
    {
        if ($desk->stages()->exists()) {
            return;
        }

        $stages = match ($desk->type) {
            'change' => [
                ['Logged', 0, 240, false],
                ['Approval', 1, 480, false],
                ['Scheduled', 2, 1440, false],
                ['Implemented', 3, null, false],
                ['Closed', 4, null, true],
            ],
            'kb' => [
                ['Draft', 0, null, false],
                ['Published', 1, null, true],
            ],
            default => [
                ['Logged', 0, 60, false],
                ['Assigned', 1, 240, false],
                ['Working', 2, 480, false],
                ['Resolved', 3, null, true],
                ['Closed', 4, null, true],
            ],
        };

        foreach ($stages as [$name, $seq, $esc, $terminal]) {
            SdStage::query()->create([
                'desk_id' => $desk->id,
                'name' => $name,
                'sequence' => $seq,
                'default_escalation_minutes' => $esc,
                'is_terminal' => $terminal,
            ]);
        }
    }

    private function seedSla(SdDesk $desk): void
    {
        if ($desk->type === 'kb' || $desk->slaPolicies()->exists()) {
            return;
        }

        SdSlaPolicy::query()->create([
            'desk_id' => $desk->id,
            'name' => 'Default SLA',
            'is_default' => true,
            'goals' => [
                ['priority_slug' => 'low', 'response_minutes' => 480, 'resolve_minutes' => 2880],
                ['priority_slug' => 'medium', 'response_minutes' => 240, 'resolve_minutes' => 1440],
                ['priority_slug' => 'high', 'response_minutes' => 60, 'resolve_minutes' => 480],
                ['priority_slug' => 'critical', 'response_minutes' => 15, 'resolve_minutes' => 240],
            ],
        ]);
    }

    private function seedDefaultProcedure(SdDesk $desk): void
    {
        if ($desk->type === 'kb' || $desk->procedures()->where('hook', 'on_create')->exists()) {
            return;
        }

        SdProcedure::query()->create([
            'desk_id' => $desk->id,
            'stage_id' => null,
            'name' => 'On create: assign pool + notify',
            'hook' => 'on_create',
            'is_active' => true,
            'steps' => [
                ['action' => 'assign_pool', 'pool' => 'tier1'],
                ['action' => 'add_note', 'body' => 'Ticket created and queued for Tier 1.', 'is_public' => false],
            ],
        ]);

        $logged = $desk->stages()->where('name', 'Logged')->first();
        if ($logged) {
            SdProcedure::query()->create([
                'desk_id' => $desk->id,
                'stage_id' => $logged->id,
                'name' => 'Escalate logged tickets',
                'hook' => 'on_escalation',
                'is_active' => true,
                'steps' => [
                    ['action' => 'assign_pool', 'pool' => 'tier2'],
                    ['action' => 'add_note', 'body' => 'Escalated due to stage timeout.', 'is_public' => false],
                    ['action' => 'set_escalation_minutes', 'minutes' => 60],
                ],
            ]);
        }
    }
}
