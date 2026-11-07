<?php

namespace App\Domains\Checklists\Actions;

use App\Domains\Checklists\Models\ChecklistTemplate;
use App\Domains\Checklists\Models\ChecklistTemplateVersion;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CopySystemChecklistTemplate
{
    public function __construct(private LogChecklistActivity $audit) {}

    public function handle(ChecklistTemplate $system, ?int $actorId = null, ?string $name = null): ChecklistTemplate
    {
        if (! $system->is_system) {
            throw ValidationException::withMessages([
                'template' => ['Only system templates can be copied with this action.'],
            ]);
        }

        $version = $system->latestVersion();
        if ($version === null) {
            throw ValidationException::withMessages([
                'template' => ['System template has no version to copy.'],
            ]);
        }

        $copyName = $name ?: $system->name.' (copy)';
        $slugBase = Str::slug($copyName) ?: 'checklist-copy';
        $slug = $slugBase;
        $i = 1;
        while (ChecklistTemplate::query()->where('slug', $slug)->exists()) {
            $slug = $slugBase.'-'.$i;
            $i++;
        }

        return DB::transaction(function () use ($system, $version, $copyName, $slug, $actorId) {
            $template = ChecklistTemplate::query()->create([
                'name' => $copyName,
                'slug' => $slug,
                'category' => $system->category,
                'description' => $system->description,
                'status' => 'draft',
                'is_system' => false,
                'current_version' => 1,
            ]);

            ChecklistTemplateVersion::query()->create([
                'template_id' => $template->id,
                'version' => 1,
                'schema_json' => $version->schema_json,
                'created_by' => $actorId,
            ]);

            $this->audit->handle(
                'template_copied',
                'System checklist template copied',
                $template,
                [
                    'source_template_id' => $system->id,
                    'source_slug' => $system->slug,
                ],
                $actorId,
            );

            return $template->fresh(['versions']);
        });
    }
}
