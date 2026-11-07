<?php

namespace App\Domains\Checklists\Support;

final class ChecklistVisibility
{
    /**
     * @param  array<string, mixed>  $item
     * @param  array<string, mixed>  $answersByKey  item_key => decoded value
     */
    public function isVisible(array $item, array $answersByKey): bool
    {
        $rule = $item['visible_when'] ?? null;
        if (! is_array($rule) || ($rule['item_key'] ?? '') === '') {
            return true;
        }

        $refKey = (string) $rule['item_key'];
        $op = (string) ($rule['op'] ?? 'eq');
        $expected = $rule['value'] ?? null;
        $actual = $answersByKey[$refKey] ?? null;

        return match ($op) {
            'eq' => $this->equals($actual, $expected),
            'neq' => ! $this->equals($actual, $expected),
            'in' => is_array($expected) && in_array($actual, $expected, false),
            'not_empty' => $this->isFilled($actual),
            default => true,
        };
    }

    /**
     * @param  array{items?: list<array<string, mixed>>}  $schema
     * @param  array<string, mixed>  $answersByKey
     * @return list<array<string, mixed>>
     */
    public function visibleAnswerableItems(array $schema, array $answersByKey): array
    {
        $items = $schema['items'] ?? [];
        $out = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            if (! in_array((string) ($item['type'] ?? ''), ChecklistItemTypes::answerable(), true)) {
                continue;
            }
            if (! $this->isVisible($item, $answersByKey)) {
                continue;
            }
            $out[] = $item;
        }

        return $out;
    }

    /**
     * @param  array{items?: list<array<string, mixed>>}  $schema
     * @param  array<string, mixed>  $answersByKey
     */
    public function progressPercent(array $schema, array $answersByKey): int
    {
        $items = $this->visibleAnswerableItems($schema, $answersByKey);
        if ($items === []) {
            return 0;
        }

        $done = 0;
        foreach ($items as $item) {
            $key = (string) $item['key'];
            $value = $answersByKey[$key] ?? null;
            if ($this->isFilled($value)) {
                if ($this->dependenciesMet($item, $answersByKey, $schema)) {
                    $done++;
                }
            }
        }

        return (int) round(($done / count($items)) * 100);
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array<string, mixed>  $answersByKey
     * @param  array{items?: list<array<string, mixed>>}  $schema
     */
    public function dependenciesMet(array $item, array $answersByKey, array $schema): bool
    {
        $requires = $item['requires'] ?? [];
        if (! is_array($requires) || $requires === []) {
            return true;
        }

        $byKey = [];
        foreach ($schema['items'] ?? [] as $candidate) {
            if (is_array($candidate) && isset($candidate['key'])) {
                $byKey[(string) $candidate['key']] = $candidate;
            }
        }

        foreach ($requires as $reqKey) {
            $reqKey = (string) $reqKey;
            $dep = $byKey[$reqKey] ?? null;
            if ($dep === null) {
                return false;
            }
            if (! $this->isVisible($dep, $answersByKey)) {
                continue;
            }
            if (! $this->isFilled($answersByKey[$reqKey] ?? null)) {
                return false;
            }
        }

        return true;
    }

    public function isFilled(mixed $value): bool
    {
        if ($value === null) {
            return false;
        }
        if (is_bool($value)) {
            return $value === true;
        }
        if (is_string($value)) {
            return trim($value) !== '';
        }
        if (is_array($value)) {
            return $value !== [];
        }

        return true;
    }

    private function equals(mixed $actual, mixed $expected): bool
    {
        if (is_bool($expected)) {
            return filter_var($actual, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) === $expected
                || $actual === $expected;
        }

        return $actual == $expected;
    }
}
