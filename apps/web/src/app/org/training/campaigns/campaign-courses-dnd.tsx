"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dndId } from "./campaign-courses";

export type CourseRef = { id: number; title: string };

export type CourseDndLabels = {
  dragLibraryCourse: string;
  dragMemberCourse: string;
  add: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  dropHere: string;
  noCourses: string;
};

const HANDLE_CLASS =
  "touch-none cursor-grab rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:cursor-grabbing";

const ROW_CLASS =
  "flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-2 py-2";

/** A course in the library. Drag the handle onto a campaign, or use Add. */
export function LibraryCourseCard({
  course,
  canAdd,
  labels,
  onAdd,
}: {
  course: CourseRef;
  canAdd: boolean;
  labels: CourseDndLabels;
  onAdd: (courseId: number) => void;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, isDragging } =
    useDraggable({
      id: dndId("library", course.id),
      data: { courseId: course.id },
    });

  return (
    <li ref={setNodeRef} className={cn(ROW_CLASS, isDragging && "opacity-50")}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={labels.dragLibraryCourse}
        className={HANDLE_CLASS}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {course.title}
      </span>
      <Button
        type="button"
        variant="outline"
        size="compact"
        disabled={!canAdd}
        onClick={() => onAdd(course.id)}
      >
        {labels.add}
      </Button>
    </li>
  );
}

/** A course inside the selected campaign. Sortable when the list is editable. */
function MemberCourseRow({
  course,
  position,
  editable,
  isLast,
  labels,
  onMove,
  onRemove,
}: {
  course: CourseRef;
  position: number;
  editable: boolean;
  isLast: boolean;
  labels: CourseDndLabels;
  onMove: (courseId: number, delta: -1 | 1) => void;
  onRemove: (courseId: number) => void;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: dndId("member", course.id),
    disabled: !editable,
  });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(ROW_CLASS, isDragging && "relative z-10 shadow-md")}
    >
      {editable ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={labels.dragMemberCourse}
          className={HANDLE_CLASS}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      ) : null}
      <span
        aria-hidden
        className="w-5 text-center text-xs tabular-nums text-[var(--muted-foreground)]"
      >
        {position + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {course.title}
      </span>
      {editable ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="compact"
            aria-label={labels.moveUp}
            title={labels.moveUp}
            disabled={position === 0}
            onClick={() => onMove(course.id, -1)}
          >
            <ArrowUp aria-hidden className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="compact"
            aria-label={labels.moveDown}
            title={labels.moveDown}
            disabled={isLast}
            onClick={() => onMove(course.id, 1)}
          >
            <ArrowDown aria-hidden className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="compact"
            onClick={() => onRemove(course.id)}
          >
            {labels.remove}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/** Ordered, sortable list of the selected campaign's courses. */
export function CampaignCourseList({
  courses,
  editable,
  labels,
  onMove,
  onRemove,
}: {
  courses: CourseRef[];
  editable: boolean;
  labels: CourseDndLabels;
  onMove: (courseId: number, delta: -1 | 1) => void;
  onRemove: (courseId: number) => void;
}) {
  const ids = courses.map((course) => dndId("member", course.id));

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <ol className="space-y-2">
        {courses.map((course, index) => (
          <MemberCourseRow
            key={course.id}
            course={course}
            position={index}
            editable={editable}
            isLast={index === courses.length - 1}
            labels={labels}
            onMove={onMove}
            onRemove={onRemove}
          />
        ))}
      </ol>
    </SortableContext>
  );
}

/** Drop zone around the selected campaign's detail panel. */
export function CampaignPanelDropzone({
  campaignId,
  editable,
  className,
  children,
}: {
  campaignId: number;
  editable: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dndId("panel", campaignId),
    disabled: !editable,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-[var(--radius)] transition-shadow",
        isOver &&
          "ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-[var(--background)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Courses cell in the campaigns table. Dropping a course here adds it. */
export function CampaignCoursesCell({
  campaignId,
  editable,
  courses,
  labels,
}: {
  campaignId: number;
  editable: boolean;
  courses: CourseRef[];
  labels: CourseDndLabels;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dndId("cell", campaignId),
    disabled: !editable,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-10 rounded-[var(--radius)] px-2 py-1 text-sm transition-colors",
        editable && "border border-dashed border-[var(--border)]",
        isOver && "border-[var(--ring)] bg-[var(--muted)]",
      )}
    >
      {courses.length > 0 ? (
        <ol className="list-decimal space-y-0.5 pl-4">
          {courses.map((course) => (
            <li key={course.id}>{course.title}</li>
          ))}
        </ol>
      ) : (
        <span className="text-[var(--muted-foreground)]">
          {editable ? labels.dropHere : labels.noCourses}
        </span>
      )}
    </div>
  );
}

/** Floating preview shown under the pointer while a course is dragged. */
export function CourseDragPreview({ label }: { label: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium shadow-lg">
      {label}
    </div>
  );
}
