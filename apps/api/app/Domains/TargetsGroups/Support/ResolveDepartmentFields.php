<?php

namespace App\Domains\TargetsGroups\Support;

use App\Domains\TargetsGroups\Models\Department;

final class ResolveDepartmentFields
{
    /**
     * @return array{department_id: int|null, department: string|null}
     */
    public function fromId(mixed $departmentId): array
    {
        if ($departmentId === null || $departmentId === '') {
            return ['department_id' => null, 'department' => null];
        }

        $department = Department::query()->find((int) $departmentId);
        if ($department === null) {
            return ['department_id' => null, 'department' => null];
        }

        return [
            'department_id' => $department->id,
            'department' => $department->name,
        ];
    }
}
