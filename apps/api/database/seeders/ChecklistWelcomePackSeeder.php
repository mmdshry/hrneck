<?php

namespace Database\Seeders;

use App\Domains\Checklists\Actions\CopySystemChecklistTemplate;
use App\Domains\Checklists\Models\ChecklistPack;
use App\Domains\Checklists\Models\ChecklistPackItem;
use App\Domains\Checklists\Models\ChecklistTemplate;
use Illuminate\Database\Seeder;

class ChecklistWelcomePackSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(ChecklistHrTemplatesSeeder::class);

        $onboarding = $this->ensureOrgCopy('hr-employee-onboarding', 'Employee Onboarding');
        $itAccess = $this->ensureOrgCopy('hr-it-access-provisioning', 'IT Access Provisioning');

        if ($onboarding === null) {
            return;
        }

        $pack = ChecklistPack::query()->updateOrCreate(
            ['slug' => 'welcome-pack'],
            [
                'name' => 'Welcome Pack',
                'description' => 'Auto-assigned onboarding bundle for new employees: onboarding paperwork and IT access.',
                'status' => ChecklistPack::STATUS_PUBLISHED,
                'auto_assign_on_create' => true,
            ],
        );

        $templateIds = array_values(array_filter([
            $onboarding->id,
            $itAccess?->id,
        ]));

        ChecklistPackItem::query()->where('pack_id', $pack->id)->delete();
        foreach ($templateIds as $index => $templateId) {
            ChecklistPackItem::query()->create([
                'pack_id' => $pack->id,
                'template_id' => $templateId,
                'sort_order' => $index + 1,
            ]);
        }
    }

    private function ensureOrgCopy(string $systemSlug, string $preferredName): ?ChecklistTemplate
    {
        $existing = ChecklistTemplate::query()
            ->where('is_system', false)
            ->where(function ($q) use ($preferredName) {
                $q->where('name', $preferredName)
                    ->orWhere('name', $preferredName.' (copy)');
            })
            ->orderBy('id')
            ->first();

        if ($existing !== null) {
            if ($existing->status !== 'published' || $existing->current_version < 1) {
                $existing->status = 'published';
                $existing->save();
            }

            return $existing;
        }

        $system = ChecklistTemplate::query()
            ->where('slug', $systemSlug)
            ->where('is_system', true)
            ->first();

        if ($system === null) {
            return null;
        }

        $copy = app(CopySystemChecklistTemplate::class)->handle($system, null, $preferredName);
        $copy->status = 'published';
        $copy->save();

        return $copy->fresh();
    }
}
