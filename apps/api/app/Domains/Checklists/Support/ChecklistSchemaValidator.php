<?php

namespace App\Domains\Checklists\Support;

use Illuminate\Validation\ValidationException;

final class ChecklistSchemaValidator
{
    /**
     * @param  array{items?: mixed}  $schema
     * @return array{items: list<array<string, mixed>>}
     */
    public function validate(array $schema): array
    {
        $items = $schema['items'] ?? null;
        if (! is_array($items)) {
            throw ValidationException::withMessages([
                'schema_json.items' => ['Schema must include an items array.'],
            ]);
        }

        $normalized = [];
        $keys = [];

        foreach ($items as $index => $raw) {
            if (! is_array($raw)) {
                throw ValidationException::withMessages([
                    "schema_json.items.{$index}" => ['Each item must be an object.'],
                ]);
            }

            $key = trim((string) ($raw['key'] ?? ''));
            $type = (string) ($raw['type'] ?? '');
            $label = trim((string) ($raw['label'] ?? ''));

            if ($key === '' || ! preg_match('/^[a-zA-Z][a-zA-Z0-9_]{0,119}$/', $key)) {
                throw ValidationException::withMessages([
                    "schema_json.items.{$index}.key" => ['Item key must be a stable identifier (letters, numbers, underscore).'],
                ]);
            }

            if (isset($keys[$key])) {
                throw ValidationException::withMessages([
                    "schema_json.items.{$index}.key" => ["Duplicate item key [{$key}]."],
                ]);
            }
            $keys[$key] = true;

            if (! in_array($type, ChecklistItemTypes::all(), true)) {
                throw ValidationException::withMessages([
                    "schema_json.items.{$index}.type" => ['Unsupported item type.'],
                ]);
            }

            if ($label === '') {
                throw ValidationException::withMessages([
                    "schema_json.items.{$index}.label" => ['Label is required.'],
                ]);
            }

            $options = [];
            if (in_array($type, [ChecklistItemTypes::SINGLE_SELECT, ChecklistItemTypes::MULTI_SELECT], true)) {
                $rawOptions = $raw['options'] ?? [];
                if (! is_array($rawOptions) || $rawOptions === []) {
                    throw ValidationException::withMessages([
                        "schema_json.items.{$index}.options" => ['Select fields require options.'],
                    ]);
                }
                foreach ($rawOptions as $opt) {
                    $options[] = is_array($opt)
                        ? ['value' => (string) ($opt['value'] ?? $opt['label'] ?? ''), 'label' => (string) ($opt['label'] ?? $opt['value'] ?? '')]
                        : ['value' => (string) $opt, 'label' => (string) $opt];
                }
            }

            $visibleWhen = null;
            if (isset($raw['visible_when']) && is_array($raw['visible_when'])) {
                $vw = $raw['visible_when'];
                $op = (string) ($vw['op'] ?? 'eq');
                if (! in_array($op, ['eq', 'neq', 'in', 'not_empty'], true)) {
                    throw ValidationException::withMessages([
                        "schema_json.items.{$index}.visible_when.op" => ['Invalid visibility operator.'],
                    ]);
                }
                $visibleWhen = [
                    'item_key' => (string) ($vw['item_key'] ?? ''),
                    'op' => $op,
                    'value' => $vw['value'] ?? null,
                ];
            }

            $requires = [];
            if (isset($raw['requires']) && is_array($raw['requires'])) {
                foreach ($raw['requires'] as $req) {
                    $requires[] = (string) $req;
                }
            }

            $media = null;
            if (isset($raw['media']) && is_array($raw['media'])) {
                $media = [
                    'kind' => (string) ($raw['media']['kind'] ?? 'link'),
                    'url' => isset($raw['media']['url']) ? (string) $raw['media']['url'] : null,
                    'label' => isset($raw['media']['label']) ? (string) $raw['media']['label'] : null,
                ];
            }

            $required = (bool) ($raw['required'] ?? false);
            if (! in_array($type, ChecklistItemTypes::answerable(), true)) {
                $required = false;
            }

            $normalized[] = [
                'key' => $key,
                'type' => $type,
                'label' => $label,
                'help' => isset($raw['help']) ? (string) $raw['help'] : null,
                'required' => $required,
                'order' => (int) ($raw['order'] ?? ($index + 1)),
                'options' => $options,
                'media' => $media,
                'visible_when' => $visibleWhen,
                'requires' => $requires,
            ];
        }

        usort($normalized, fn (array $a, array $b): int => $a['order'] <=> $b['order']);

        foreach ($normalized as $index => $item) {
            if ($item['visible_when'] !== null) {
                $ref = $item['visible_when']['item_key'];
                if ($ref === '' || ! isset($keys[$ref])) {
                    throw ValidationException::withMessages([
                        "schema_json.items.{$index}.visible_when.item_key" => ['visible_when references an unknown item key.'],
                    ]);
                }
                if ($ref === $item['key']) {
                    throw ValidationException::withMessages([
                        "schema_json.items.{$index}.visible_when.item_key" => ['Item cannot depend on itself.'],
                    ]);
                }
            }

            foreach ($item['requires'] as $reqKey) {
                if (! isset($keys[$reqKey])) {
                    throw ValidationException::withMessages([
                        "schema_json.items.{$index}.requires" => ["requires references unknown key [{$reqKey}]."],
                    ]);
                }
                if ($reqKey === $item['key']) {
                    throw ValidationException::withMessages([
                        "schema_json.items.{$index}.requires" => ['Item cannot require itself.'],
                    ]);
                }
            }
        }

        return ['items' => array_values($normalized)];
    }
}
