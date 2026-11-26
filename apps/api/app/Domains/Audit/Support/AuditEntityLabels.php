<?php

namespace App\Domains\Audit\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Spatie\Activitylog\Models\Activity;

/**
 * Resolves readable actor and subject labels for activity rows using one query per model type.
 *
 * When a row no longer exists, the label falls back to the snapshot stored in the activity properties.
 */
class AuditEntityLabels
{
    /**
     * Snapshot keys written by deletion audits that log no subject model.
     */
    private const SNAPSHOT_KEYS = [
        'user',
        'target',
        'group',
        'course',
        'lesson',
        'campaign',
        'department',
        'role',
        'announcement',
        'schedule',
        'archive',
        'template',
        'article',
        'reader',
        'profile',
    ];

    /**
     * @param  Collection<int, Activity>  $activities
     * @return array<int, array{causer: array{id: int, name: string|null, email: string|null}|null, subject: array{type: string, id: int|null, label: string|null, email: string|null}|null}>
     */
    public function forActivities(Collection $activities): array
    {
        $users = $this->loadUsers($activities);
        $models = $this->loadSubjectModels($activities);

        return $activities
            ->mapWithKeys(fn (Activity $activity): array => [
                $activity->id => [
                    'causer' => $this->causerLabel($activity, $users),
                    'subject' => $this->subjectLabel($activity, $models),
                ],
            ])
            ->all();
    }

    /**
     * @param  Collection<int, Activity>  $activities
     * @return array<int, User>
     */
    private function loadUsers(Collection $activities): array
    {
        $ids = $activities
            ->pluck('causer_id')
            ->filter(fn (mixed $id): bool => $id !== null)
            ->map(fn (mixed $id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($ids === []) {
            return [];
        }

        return User::query()
            ->whereKey($ids)
            ->get(['id', 'name', 'email'])
            ->keyBy(fn (User $user): int => (int) $user->getKey())
            ->all();
    }

    /**
     * @param  Collection<int, Activity>  $activities
     * @return array<string, array<int, Model>>
     */
    private function loadSubjectModels(Collection $activities): array
    {
        $idsByType = $activities
            ->filter(fn (Activity $activity): bool => $activity->subject_type !== null && $activity->subject_id !== null)
            ->groupBy('subject_type')
            ->map(fn (Collection $group): array => $group
                ->pluck('subject_id')
                ->map(fn (mixed $id): int => (int) $id)
                ->unique()
                ->values()
                ->all());

        $loaded = [];

        foreach ($idsByType as $type => $ids) {
            if (! is_string($type) || ! is_subclass_of($type, Model::class)) {
                continue;
            }

            $loaded[$type] = $type::query()
                ->whereKey($ids)
                ->get()
                ->keyBy(fn (Model $model): int => (int) $model->getKey())
                ->all();
        }

        return $loaded;
    }

    /**
     * @param  array<int, User>  $users
     * @return array{id: int, name: string|null, email: string|null}|null
     */
    private function causerLabel(Activity $activity, array $users): ?array
    {
        if ($activity->causer_id === null) {
            return null;
        }

        $causerId = (int) $activity->causer_id;
        $user = $users[$causerId] ?? null;

        return [
            'id' => $causerId,
            'name' => $user !== null
                ? $this->stringValue($user->name)
                : $this->stringValue($activity->properties->get('causer_name')),
            'email' => $user !== null
                ? $this->stringValue($user->email)
                : $this->stringValue($activity->properties->get('causer_email')),
        ];
    }

    /**
     * @param  array<string, array<int, Model>>  $models
     * @return array{type: string, id: int|null, label: string|null, email: string|null}|null
     */
    private function subjectLabel(Activity $activity, array $models): ?array
    {
        if ($activity->subject_type === null) {
            foreach (self::SNAPSHOT_KEYS as $key) {
                $subject = $this->snapshotSubject($activity, $key, Str::headline($key), null);

                if ($subject !== null) {
                    return $subject;
                }
            }

            return null;
        }

        $type = class_basename($activity->subject_type);
        $subjectId = $activity->subject_id !== null ? (int) $activity->subject_id : null;
        $model = $subjectId !== null ? ($models[$activity->subject_type][$subjectId] ?? null) : null;

        if ($model !== null) {
            return [
                'type' => $type,
                'id' => $subjectId,
                'label' => $this->labelFrom($model->getAttributes()),
                'email' => $this->stringValue($model->getAttribute('email')),
            ];
        }

        return $this->snapshotSubject($activity, Str::snake($type), $type, $subjectId) ?? [
            'type' => $type,
            'id' => $subjectId,
            'label' => null,
            'email' => null,
        ];
    }

    /**
     * @return array{type: string, id: int|null, label: string|null, email: string|null}|null
     */
    private function snapshotSubject(Activity $activity, string $key, string $type, ?int $fallbackId): ?array
    {
        $snapshot = $activity->properties->get($key);

        if (! is_array($snapshot)) {
            return null;
        }

        return [
            'type' => $type,
            'id' => is_numeric($snapshot['id'] ?? null) ? (int) $snapshot['id'] : $fallbackId,
            'label' => $this->labelFrom($snapshot),
            'email' => $this->stringValue($snapshot['email'] ?? null),
        ];
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function labelFrom(array $attributes): ?string
    {
        return $this->stringValue($attributes['name'] ?? null)
            ?? $this->stringValue($attributes['title'] ?? null)
            ?? $this->stringValue(trim(($attributes['first_name'] ?? '').' '.($attributes['last_name'] ?? '')));
    }

    private function stringValue(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }
}
