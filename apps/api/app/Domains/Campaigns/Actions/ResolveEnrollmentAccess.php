<?php

namespace App\Domains\Campaigns\Actions;

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Support\EnrollmentAccess;
use App\Domains\TrainingLms\Models\Enrollment;
use Carbon\CarbonInterface;

class ResolveEnrollmentAccess
{
    public function handle(Enrollment $enrollment, ?CarbonInterface $at = null): EnrollmentAccess
    {
        $at ??= now();
        $enrollment->loadMissing('assignments.campaign');

        // Enrollments not created by a campaign (for example manual ones) are not gated by a window.
        if ($enrollment->assignments->isEmpty()) {
            return EnrollmentAccess::Available;
        }

        $campaigns = $enrollment->assignments
            ->map(fn ($assignment) => $assignment->campaign)
            ->filter(fn ($campaign): bool => $campaign instanceof Campaign)
            ->unique('id');

        if ($campaigns->contains(fn (Campaign $campaign): bool => $campaign->isAccessibleAt($at))) {
            return EnrollmentAccess::Available;
        }

        if ($campaigns->contains(fn (Campaign $campaign): bool => $campaign->isUpcomingAt($at))) {
            return EnrollmentAccess::Upcoming;
        }

        return EnrollmentAccess::Expired;
    }
}
