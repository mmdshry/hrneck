"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import type { WizardStep } from "@/components/ui/wizard-dialog";
import { useOrgTimezone } from "@/hooks/use-org-timezone";
import { toastWarning } from "@/lib/toast";
import {
  AudiencePicker,
  type AudienceGroup,
  type AudienceTarget,
} from "./audience-picker";
import {
  emptyAssignDraft,
  isAssignDraftDirty,
  toggleAllIds,
  toggleId,
  type AssignDraft,
} from "./training-assign-draft";
import {
  datetimeLocalToIso,
  formatTs,
  windowIsInverted,
  type Course,
} from "./training-shared";
import { TrainingWindowFields } from "./training-window-fields";

export type AssignCourse = Pick<Course, "id" | "title"> &
  Partial<Pick<Course, "duration_minutes" | "lessons">>;

type AssignCoursesStepProps = {
  courses: AssignCourse[];
  selectedCourseIds: number[];
  onChangeCourseIds: (ids: number[]) => void;
};

function AssignCoursesStep({
  courses,
  selectedCourseIds,
  onChangeCourseIds,
}: AssignCoursesStepProps) {
  const t = useTranslations("org.training");
  const tCommon = useTranslations("common");

  if (courses.length === 0) {
    return (
      <EmptyState
        title={t("noCoursesYet")}
        description={t("noCoursesHint")}
        action={<LinkButton href="/org/courses">{t("goToCourses")}</LinkButton>}
      />
    );
  }

  const allSelected = selectedCourseIds.length === courses.length;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            onChangeCourseIds(
              toggleAllIds(
                selectedCourseIds,
                courses.map((course) => course.id),
              ),
            )
          }
        >
          {allSelected ? tCommon("clearAll") : tCommon("selectAll")}
        </Button>
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] p-3">
        {courses.map((course) => (
          <label
            key={course.id}
            className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--muted)]"
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selectedCourseIds.includes(course.id)}
              onChange={() => onChangeCourseIds(toggleId(selectedCourseIds, course.id))}
            />
            <span className="min-w-0">
              <span className="font-medium">{course.title}</span>
              {typeof course.duration_minutes === "number" ? (
                <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                  {t("courseMetaShort", {
                    minutes: course.duration_minutes,
                    count: course.lessons?.length ?? 0,
                  })}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      {selectedCourseIds.length > 0 ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          {t("coursesSelected", { count: selectedCourseIds.length })}
        </p>
      ) : null}
    </div>
  );
}

type AssignReviewSummaryProps = {
  courses: AssignCourse[];
  draft: AssignDraft;
};

function AssignReviewSummary({ courses, draft }: AssignReviewSummaryProps) {
  const t = useTranslations("org.training");
  const orgTimeZone = useOrgTimezone();
  const courseTitles = courses
    .filter((course) => draft.courseIds.includes(course.id))
    .map((course) => course.title);
  const rows = [
    { label: t("stepCourses"), value: courseTitles.join(", ") },
    {
      label: t("stepAudience"),
      value: t("audienceSummary", {
        targets: draft.targetIds.length,
        groups: draft.groupIds.length,
      }),
    },
    {
      label: t("startsAt"),
      value: draft.startsAt
        ? formatTs(datetimeLocalToIso(draft.startsAt), orgTimeZone)
        : t("startsNow"),
    },
    {
      label: t("expiresAt"),
      value: draft.expiresAt
        ? formatTs(datetimeLocalToIso(draft.expiresAt), orgTimeZone)
        : t("expiresNever"),
    },
  ];

  return (
    <dl className="grid gap-3 rounded-[var(--radius)] border border-[var(--border)] p-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-[var(--muted-foreground)]">{row.label}</dt>
          <dd className="min-w-0 break-words font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type UseAssignWizardOptions = {
  courses: AssignCourse[];
  targets: AudienceTarget[];
  groups: AudienceGroup[];
  /** Inputs shown above the summary on the review step, e.g. a campaign name. */
  reviewFields?: ReactNode;
};

export type AssignWizard = {
  draft: AssignDraft;
  steps: WizardStep[];
  isDirty: boolean;
  reset: () => void;
};

/**
 * Courses, audience, schedule and review steps shared by the campaign launch and
 * the assign-content wizards. The draft lives in the calling component.
 */
export function useAssignWizard({
  courses,
  targets,
  groups,
  reviewFields,
}: UseAssignWizardOptions): AssignWizard {
  const t = useTranslations("org.training");
  const [draft, setDraft] = useState<AssignDraft>(emptyAssignDraft);

  function patch(next: Partial<AssignDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  const steps: WizardStep[] = [
    {
      id: "courses",
      title: t("stepCourses"),
      validate: () => {
        if (draft.courseIds.length === 0) {
          toastWarning(t("selectCourse"));
          return false;
        }
        return true;
      },
      render: () => (
        <AssignCoursesStep
          courses={courses}
          selectedCourseIds={draft.courseIds}
          onChangeCourseIds={(courseIds) => patch({ courseIds })}
        />
      ),
    },
    {
      id: "audience",
      title: t("stepAudience"),
      validate: () => {
        if (draft.targetIds.length === 0 && draft.groupIds.length === 0) {
          toastWarning(t("selectTargetOrGroup"));
          return false;
        }
        return true;
      },
      render: () => (
        <AudiencePicker
          targets={targets}
          groups={groups}
          selectedTargetIds={draft.targetIds}
          selectedGroupIds={draft.groupIds}
          onChangeTargets={(targetIds) => patch({ targetIds })}
          onChangeGroups={(groupIds) => patch({ groupIds })}
        />
      ),
    },
    {
      id: "schedule",
      title: t("stepSchedule"),
      validate: () => {
        if (windowIsInverted(draft.startsAt, draft.expiresAt)) {
          toastWarning(t("windowInvalid"));
          return false;
        }
        return true;
      },
      render: () => (
        <TrainingWindowFields
          idPrefix="assign"
          startsAt={draft.startsAt}
          expiresAt={draft.expiresAt}
          onChangeStartsAt={(startsAt) => patch({ startsAt })}
          onChangeExpiresAt={(expiresAt) => patch({ expiresAt })}
        />
      ),
    },
    {
      id: "review",
      title: t("stepReview"),
      description: t("reviewHint"),
      render: () => (
        <div className="space-y-4">
          {reviewFields}
          <AssignReviewSummary courses={courses} draft={draft} />
        </div>
      ),
    },
  ];

  return {
    draft,
    steps,
    isDirty: isAssignDraftDirty(draft),
    reset: () => setDraft(emptyAssignDraft()),
  };
}
