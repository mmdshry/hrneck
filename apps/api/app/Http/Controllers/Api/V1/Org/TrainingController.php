<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Campaigns\Actions\LaunchTrainingCampaign;
use App\Domains\Campaigns\Actions\ResolveCampaignAudience;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Actions\SyncEnrollmentProgress;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Domains\TrainingLms\Models\Lesson;
use App\Domains\TrainingLms\Models\LessonProgress;
use App\Domains\TrainingLms\Models\Quiz;
use App\Domains\TrainingLms\Models\QuizAttempt;
use App\Domains\TrainingLms\Models\QuizQuestion;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TrainingController extends Controller
{
    public function courses(Request $request): JsonResponse
    {
        $rows = Course::query()
            ->with(['lessons', 'quiz.questions'])
            ->latest()
            ->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function storeCourse(Request $request, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string'],
            'duration_minutes' => ['sometimes', 'integer', 'min:1', 'max:600'],
            'is_sample' => ['sometimes', 'boolean'],
        ]);

        $course = Course::query()->create([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'duration_minutes' => $data['duration_minutes'] ?? 8,
            'is_sample' => $request->boolean('is_sample', false),
        ]);

        $audit->handle('training', 'course_created', 'Course created', $course, [
            'title' => $course->title,
        ]);

        PublishLive::org([LiveTopics::TRAINING_CAMPAIGNS]);

        return response()->json(['data' => $course->load(['lessons', 'quiz.questions'])], 201);
    }

    public function updateCourse(Request $request, int $course, LogOrgActivity $audit): JsonResponse
    {
        $model = Course::query()->findOrFail($course);
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:160'],
            'description' => ['nullable', 'string'],
            'duration_minutes' => ['sometimes', 'integer', 'min:1', 'max:600'],
            'is_sample' => ['sometimes', 'boolean'],
        ]);

        if ($request->has('is_sample')) {
            $data['is_sample'] = $request->boolean('is_sample');
        }

        $before = $model->only(['title', 'description', 'duration_minutes', 'is_sample']);
        $model->fill($data)->save();

        $audit->handle('training', 'course_updated', 'Course updated', $model, [
            'before' => $before,
            'after' => $model->only(['title', 'description', 'duration_minutes', 'is_sample']),
        ]);

        return response()->json(['data' => $model->fresh(['lessons', 'quiz.questions'])]);
    }

    public function destroyCourse(int $course, LogOrgActivity $audit): JsonResponse
    {
        $model = Course::query()->findOrFail($course);
        $snapshot = ['id' => $model->id, 'title' => $model->title];
        $model->delete();

        $audit->handle('training', 'course_deleted', 'Course deleted', null, [
            'course' => $snapshot,
        ]);

        PublishLive::org([LiveTopics::TRAINING_CAMPAIGNS]);

        return response()->json(['deleted' => true]);
    }

    public function storeLesson(Request $request, int $course, LogOrgActivity $audit): JsonResponse
    {
        Course::query()->findOrFail($course);
        $data = $this->validatedLesson($request, true);
        $data['course_id'] = $course;
        $data['sort_order'] = $data['sort_order'] ?? ((int) Lesson::query()->where('course_id', $course)->max('sort_order') + 1);
        $data['body'] = $data['body'] ?? '';

        $lesson = Lesson::query()->create($data);

        $audit->handle('training', 'lesson_created', 'Lesson created', $lesson, [
            'course_id' => $course,
            'title' => $lesson->title ?? null,
        ]);

        return response()->json(['data' => $lesson], 201);
    }

    public function updateLesson(Request $request, int $course, int $lesson, LogOrgActivity $audit): JsonResponse
    {
        $model = Lesson::query()->where('course_id', $course)->findOrFail($lesson);
        $data = $this->validatedLesson($request, false);
        if (array_key_exists('body', $data) && $data['body'] === null) {
            $data['body'] = '';
        }
        $model->fill($data)->save();

        $audit->handle('training', 'lesson_updated', 'Lesson updated', $model, [
            'course_id' => $course,
        ]);

        return response()->json(['data' => $model->fresh()]);
    }

    public function destroyLesson(int $course, int $lesson, LogOrgActivity $audit): JsonResponse
    {
        $model = Lesson::query()->where('course_id', $course)->findOrFail($lesson);
        if ($model->media_disk_path) {
            Storage::disk($this->trainingDisk())->delete($model->media_disk_path);
        }
        $snapshot = ['id' => $model->id, 'course_id' => $course];
        $model->delete();

        $audit->handle('training', 'lesson_deleted', 'Lesson deleted', null, [
            'lesson' => $snapshot,
        ]);

        return response()->json(['deleted' => true]);
    }

    public function uploadMedia(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:102400', 'mimetypes:video/mp4,video/webm,video/quicktime,application/pdf'],
            'content_type' => ['required', 'in:video,pdf'],
        ]);

        $file = $data['file'];
        $tenant = (string) (tenant('id') ?: 'central');
        $ext = $file->getClientOriginalExtension() ?: ($data['content_type'] === 'pdf' ? 'pdf' : 'mp4');
        $path = sprintf('tenants/%s/training/%s.%s', $tenant, Str::uuid()->toString(), $ext);
        Storage::disk($this->trainingDisk())->put($path, file_get_contents($file->getRealPath()) ?: '');

        return response()->json([
            'data' => [
                'media_disk_path' => $path,
                'media_mime' => $file->getMimeType(),
                'media_size' => $file->getSize(),
                'content_type' => $data['content_type'],
            ],
        ], 201);
    }

    public function streamMedia(Request $request, int $lesson): StreamedResponse
    {
        $model = Lesson::query()->findOrFail($lesson);
        $targetId = $this->ownedTargetId($request);
        if ($targetId === null) {
            $this->abortWithoutLearnerProfile();
        }
        abort_unless(
            Enrollment::query()
                ->where('target_id', $targetId)
                ->where('course_id', $model->course_id)
                ->exists(),
            403,
        );
        abort_unless($model->media_disk_path && Storage::disk($this->trainingDisk())->exists($model->media_disk_path), 404);

        return Storage::disk($this->trainingDisk())->response(
            $model->media_disk_path,
            basename($model->media_disk_path),
            [
                'Content-Type' => $model->media_mime ?: 'application/octet-stream',
                'Content-Disposition' => 'inline; filename="'.basename($model->media_disk_path).'"',
            ],
        );
    }

    public function enrollments(Request $request): JsonResponse
    {
        $paginator = $this->enrollmentQuery($request)
            ->paginate(ApiPagination::perPage($request));

        $data = collect($paginator->items())
            ->map(fn (Enrollment $enrollment) => $this->serializeEnrollment($enrollment))
            ->values();

        return response()->json([
            'data' => $data,
            'meta' => ApiPagination::meta($paginator),
        ]);
    }

    public function exportEnrollments(Request $request): StreamedResponse
    {
        $rows = $this->enrollmentRows($request);

        return response()->streamDownload(function () use ($rows): void {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'enrollment_id',
                'learner_email',
                'learner_name',
                'course',
                'lesson',
                'lesson_type',
                'lesson_status',
                'lesson_progress_pct',
                'watched_seconds',
                'lesson_opened_at',
                'lesson_completed_at',
                'enrollment_status',
                'enrollment_progress',
                'enrollment_opened_at',
                'enrollment_completed_at',
                'quiz_score',
                'quiz_passed',
            ]);

            foreach ($rows as $enrollment) {
                $lessons = $enrollment['course']['lessons'] ?? [];
                $progressByLesson = collect($enrollment['lesson_progress'] ?? [])
                    ->keyBy('lesson_id');

                if ($lessons === []) {
                    fputcsv($out, [
                        $enrollment['id'] ?? '',
                        $enrollment['target']['email'] ?? '',
                        trim(($enrollment['target']['first_name'] ?? '').' '.($enrollment['target']['last_name'] ?? '')),
                        $enrollment['course']['title'] ?? '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        $enrollment['status'] ?? '',
                        $enrollment['progress'] ?? '',
                        $enrollment['opened_at'] ?? '',
                        $enrollment['completed_at'] ?? '',
                        $enrollment['quiz_score'] ?? '',
                        isset($enrollment['quiz_passed']) ? ($enrollment['quiz_passed'] ? '1' : '0') : '',
                    ]);

                    continue;
                }

                foreach ($lessons as $lesson) {
                    $progress = $progressByLesson->get($lesson['id'] ?? 0) ?? [];
                    fputcsv($out, [
                        $enrollment['id'] ?? '',
                        $enrollment['target']['email'] ?? '',
                        trim(($enrollment['target']['first_name'] ?? '').' '.($enrollment['target']['last_name'] ?? '')),
                        $enrollment['course']['title'] ?? '',
                        $lesson['title'] ?? '',
                        $lesson['content_type'] ?? '',
                        $progress['status'] ?? 'not_started',
                        $progress['progress_pct'] ?? 0,
                        $progress['watched_seconds'] ?? 0,
                        $progress['opened_at'] ?? '',
                        $progress['completed_at'] ?? '',
                        $enrollment['status'] ?? '',
                        $enrollment['progress'] ?? '',
                        $enrollment['opened_at'] ?? '',
                        $enrollment['completed_at'] ?? '',
                        $enrollment['quiz_score'] ?? '',
                        isset($enrollment['quiz_passed']) ? ($enrollment['quiz_passed'] ? '1' : '0') : '',
                    ]);
                }
            }

            fclose($out);
        }, 'training-viewing-report.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function exportEnrollmentsPdf(Request $request): StreamedResponse
    {
        $enrollments = $this->enrollmentRows($request);
        $maxRows = 2000;
        $flat = [];
        $truncated = false;

        foreach ($enrollments as $enrollment) {
            $lessons = $enrollment['course']['lessons'] ?? [];
            $progressByLesson = collect($enrollment['lesson_progress'] ?? [])
                ->keyBy('lesson_id');
            $learner = trim(($enrollment['target']['first_name'] ?? '').' '.($enrollment['target']['last_name'] ?? ''));
            $email = $enrollment['target']['email'] ?? '';
            $course = $enrollment['course']['title'] ?? '';

            if ($lessons === []) {
                $flat[] = [
                    'learner' => $learner !== '' ? $learner : $email,
                    'email' => $email,
                    'course' => $course,
                    'lesson' => '',
                    'status' => '',
                    'progress_pct' => '',
                    'watched_seconds' => '',
                    'enrollment_status' => $enrollment['status'] ?? '',
                    'quiz_score' => $enrollment['quiz_score'] ?? '',
                ];
                if (count($flat) >= $maxRows) {
                    $truncated = true;
                    break;
                }

                continue;
            }

            foreach ($lessons as $lesson) {
                $progress = $progressByLesson->get($lesson['id'] ?? 0) ?? [];
                $flat[] = [
                    'learner' => $learner !== '' ? $learner : $email,
                    'email' => $email,
                    'course' => $course,
                    'lesson' => $lesson['title'] ?? '',
                    'status' => $progress['status'] ?? 'not_started',
                    'progress_pct' => $progress['progress_pct'] ?? 0,
                    'watched_seconds' => $progress['watched_seconds'] ?? 0,
                    'enrollment_status' => $enrollment['status'] ?? '',
                    'quiz_score' => $enrollment['quiz_score'] ?? '',
                ];
                if (count($flat) >= $maxRows) {
                    $truncated = true;
                    break 2;
                }
            }
        }

        $html = view('reports.training-viewing', [
            'rows' => $flat,
            'truncated' => $truncated,
            'maxRows' => $maxRows,
            'tenant' => tenant('id'),
            'brand' => config('brand.name'),
            'generatedAt' => now()->toIso8601String(),
        ])->render();

        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'landscape');

        return response()->streamDownload(function () use ($pdf): void {
            echo $pdf->output();
        }, 'training-viewing-report.pdf', [
            'Content-Type' => 'application/pdf',
        ]);
    }

    public function assign(
        Request $request,
        LaunchTrainingCampaign $train,
        ResolveCampaignAudience $audience,
        LogOrgActivity $audit,
    ): JsonResponse {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'course_id' => ['required_without:content', 'nullable', 'integer'],
            'content' => ['required_without:course_id', 'nullable', 'array'],
            'content.title' => ['required_with:content', 'string', 'max:160'],
            'content.content_type' => ['required_with:content', 'in:text,video,pdf'],
            'content.body' => ['nullable', 'string'],
            'content.media_url' => ['nullable', 'string', 'max:2048'],
            'content.media_disk_path' => ['nullable', 'string', 'max:512'],
            'content.media_mime' => ['nullable', 'string', 'max:120'],
            'content.media_size' => ['nullable', 'integer', 'min:0'],
            'content.duration_seconds' => ['nullable', 'integer', 'min:0'],
            'content.duration_minutes' => ['nullable', 'integer', 'min:1', 'max:600'],
            'content.description' => ['nullable', 'string'],
            'target_ids' => ['required_without:group_ids', 'array'],
            'target_ids.*' => ['integer'],
            'group_ids' => ['required_without:target_ids', 'array'],
            'group_ids.*' => ['integer'],
            'launch' => ['sometimes', 'boolean'],
        ]);

        $targetIds = $audience->handle($data['target_ids'] ?? [], $data['group_ids'] ?? []);

        if (! empty($data['content'])) {
            $content = $data['content'];
            $course = Course::query()->create([
                'title' => $content['title'],
                'description' => $content['description'] ?? null,
                'duration_minutes' => $content['duration_minutes'] ?? (
                    ((int) ($content['duration_seconds'] ?? 0)) > 0
                        ? max(1, (int) ceil(((int) $content['duration_seconds']) / 60))
                        : 8
                ),
                'is_sample' => false,
            ]);
            Lesson::query()->create([
                'course_id' => $course->id,
                'title' => $content['title'],
                'content_type' => $content['content_type'],
                'body' => $content['body'] ?? '',
                'media_url' => $content['media_url'] ?? null,
                'media_disk_path' => $content['media_disk_path'] ?? null,
                'media_mime' => $content['media_mime'] ?? null,
                'media_size' => $content['media_size'] ?? null,
                'duration_seconds' => $content['duration_seconds'] ?? null,
                'sort_order' => 1,
            ]);
            $courseId = $course->id;
        } else {
            $course = Course::query()->findOrFail((int) $data['course_id']);
            $courseId = $course->id;
        }

        $campaign = Campaign::query()->create([
            'name' => $data['name'] ?? ('Assign: '.($course->title ?? 'training')),
            'type' => 'training',
            'status' => 'draft',
            'course_id' => $courseId,
            'randomize_send' => false,
        ]);

        if ($request->boolean('launch', true)) {
            $campaign = $train->handle($campaign, $targetIds);
        } else {
            PublishLive::metricsBundle();
        }

        $audit->handle('training', 'assigned', 'Training assigned', $campaign, [
            'course_id' => $courseId,
            'target_count' => count($targetIds),
        ]);

        return response()->json([
            'data' => [
                'campaign' => $campaign->load(['recipients', 'course.lessons']),
                'course' => $campaign->course?->load('lessons') ?? Course::query()->with('lessons')->find($courseId),
                'assigned_target_ids' => $targetIds,
            ],
        ], 201);
    }

    public function completeLesson(Request $request, SyncEnrollmentProgress $sync): JsonResponse
    {
        $data = $request->validate([
            'enrollment_id' => ['required', 'integer'],
            'progress' => ['required', 'integer', 'min:0', 'max:100'],
        ]);

        $enrollment = $this->ownedEnrollment($request, (int) $data['enrollment_id']);
        $sync->markOpened($enrollment);
        $enrollment->forceFill([
            'progress' => $data['progress'],
            'status' => $data['progress'] >= 100 ? 'completed' : 'in_progress',
            'completed_at' => $data['progress'] >= 100 ? now() : null,
        ])->save();

        if ($data['progress'] >= 100) {
            $sync->recompute($enrollment->fresh() ?? $enrollment);
        }

        PublishLive::metricsBundle(throttled: true);

        return response()->json(['data' => $enrollment->fresh()]);
    }

    public function updateLessonProgress(Request $request, SyncEnrollmentProgress $sync): JsonResponse
    {
        $data = $request->validate([
            'enrollment_id' => ['required', 'integer'],
            'lesson_id' => ['required', 'integer'],
            'progress_pct' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'watched_seconds' => ['sometimes', 'integer', 'min:0'],
            'completed' => ['sometimes', 'boolean'],
            'opened' => ['sometimes', 'boolean'],
        ]);

        $enrollment = $this->ownedEnrollment($request, (int) $data['enrollment_id'])->load('course.lessons');
        $lesson = Lesson::query()->where('course_id', $enrollment->course_id)->findOrFail($data['lesson_id']);

        $sync->markOpened($enrollment);

        $row = LessonProgress::query()->firstOrNew([
            'enrollment_id' => $enrollment->id,
            'lesson_id' => $lesson->id,
        ]);

        if (! $row->exists || $row->opened_at === null || $request->boolean('opened', true)) {
            $row->opened_at = $row->opened_at ?? now();
        }

        $watched = max((int) $row->watched_seconds, (int) ($data['watched_seconds'] ?? 0));
        $pct = (int) ($data['progress_pct'] ?? $row->progress_pct ?? 0);

        if ($lesson->content_type === 'video' && $lesson->duration_seconds && $watched > 0) {
            $pct = max($pct, (int) min(100, round(($watched / max(1, $lesson->duration_seconds)) * 100)));
        }

        $markComplete = $request->boolean('completed');
        if ($lesson->content_type === 'video' && $pct >= 80) {
            $markComplete = true;
        }

        if ($markComplete) {
            $pct = 100;
        }

        $row->fill([
            'watched_seconds' => $watched,
            'progress_pct' => $pct,
            'status' => $pct >= 100 ? 'completed' : ($pct > 0 || $row->opened_at ? 'in_progress' : 'not_started'),
            'completed_at' => $pct >= 100 ? ($row->completed_at ?? now()) : null,
        ])->save();

        $enrollment = $sync->recompute($enrollment->fresh(['course.lessons', 'course.quiz']) ?? $enrollment);

        PublishLive::metricsBundle(throttled: true);

        return response()->json([
            'data' => [
                'lesson_progress' => $row->fresh(),
                'enrollment' => $enrollment,
            ],
        ]);
    }

    public function submitQuiz(Request $request, SyncEnrollmentProgress $sync): JsonResponse
    {
        $data = $request->validate([
            'quiz_id' => ['required', 'integer'],
            'target_id' => ['sometimes', 'integer'],
            'enrollment_id' => ['sometimes', 'integer'],
            'answers' => ['required', 'array'],
        ]);

        $targetId = $this->ownedTargetId($request);
        if ($targetId === null) {
            $this->abortWithoutLearnerProfile();
        }

        $quiz = Quiz::query()->with('questions')->findOrFail($data['quiz_id']);
        $correct = 0;
        foreach ($quiz->questions as $index => $question) {
            if ((int) ($data['answers'][$index] ?? -1) === (int) $question->correct_index) {
                $correct++;
            }
        }
        $total = max(1, $quiz->questions->count());
        $score = (int) round(($correct / $total) * 100);
        $attempt = QuizAttempt::query()->create([
            'quiz_id' => $quiz->id,
            'target_id' => $targetId,
            'score' => $score,
            'passed' => $score >= $quiz->pass_score,
            'answers' => $data['answers'],
        ]);

        $enrollment = null;
        if (! empty($data['enrollment_id'])) {
            $enrollment = $this->ownedEnrollment($request, (int) $data['enrollment_id']);
        }
        if (! $enrollment) {
            $enrollment = Enrollment::query()
                ->where('course_id', $quiz->course_id)
                ->where('target_id', $targetId)
                ->first();
        }
        if ($enrollment) {
            $sync->markOpened($enrollment);
            $enrollment = $sync->recompute($enrollment->fresh(['course.lessons', 'course.quiz']) ?? $enrollment);
        }

        PublishLive::metricsBundle(throttled: true);

        return response()->json([
            'data' => array_merge($attempt->toArray(), [
                'enrollment' => $enrollment,
            ]),
        ]);
    }

    public function upsertQuiz(Request $request, int $course): JsonResponse
    {
        Course::query()->findOrFail($course);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'pass_score' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'questions' => ['required', 'array', 'min:1'],
            'questions.*.prompt' => ['required', 'string'],
            'questions.*.options' => ['required', 'array', 'min:2'],
            'questions.*.correct_index' => ['required', 'integer', 'min:0'],
        ]);

        $quiz = Quiz::query()->updateOrCreate(
            ['course_id' => $course],
            [
                'title' => $data['title'],
                'pass_score' => $data['pass_score'] ?? 70,
            ],
        );

        $quiz->questions()->delete();
        foreach ($data['questions'] as $question) {
            QuizQuestion::query()->create([
                'quiz_id' => $quiz->id,
                'prompt' => $question['prompt'],
                'options' => array_values($question['options']),
                'correct_index' => $question['correct_index'],
            ]);
        }

        return response()->json(['data' => $quiz->load('questions')]);
    }

    public function myAssignments(Request $request): JsonResponse
    {
        $targetId = $this->ownedTargetId($request);
        if ($targetId === null) {
            $this->abortWithoutLearnerProfile();
        }
        $courseId = $request->integer('course_id') ?: null;

        $query = Enrollment::query()
            ->with(['course.lessons', 'course.quiz.questions', 'lessonProgress', 'target'])
            ->where('target_id', $targetId)
            ->latest();

        if ($courseId) {
            $query->where('course_id', $courseId);
        }

        return response()->json(['data' => $query->get()]);
    }

    private function abortWithoutLearnerProfile(): never
    {
        abort(response()->json([
            'message' => 'No assigned training found for this account yet.',
        ], 403));
    }

    private function ownedTargetId(Request $request): ?int
    {
        $email = $request->user()?->email;
        if (! is_string($email) || $email === '') {
            return null;
        }

        $id = Target::query()->where('email', $email)->value('id');

        return $id !== null ? (int) $id : null;
    }

    private function ownedEnrollment(Request $request, int $enrollmentId): Enrollment
    {
        $targetId = $this->ownedTargetId($request);
        if ($targetId === null) {
            $this->abortWithoutLearnerProfile();
        }

        $enrollment = Enrollment::query()
            ->whereKey($enrollmentId)
            ->where('target_id', $targetId)
            ->first();

        abort_unless($enrollment !== null, 404);

        return $enrollment;
    }

    private function enrollmentQuery(Request $request)
    {
        $query = Enrollment::query()
            ->with(['course.lessons', 'course.quiz', 'target', 'lessonProgress'])
            ->latest();

        if ($request->filled('course_id')) {
            $query->where('course_id', (int) $request->input('course_id'));
        }
        if ($request->filled('target_id')) {
            $query->where('target_id', (int) $request->input('target_id'));
        }
        if ($request->filled('email')) {
            $email = (string) $request->input('email');
            $query->whereHas('target', fn ($q) => $q->where('email', $email));
        }
        if ($request->filled('group_id')) {
            $groupId = (int) $request->input('group_id');
            $query->whereHas('target.groups', fn ($q) => $q->where('groups.id', $groupId));
        }
        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        return $query;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeEnrollment(Enrollment $enrollment): array
    {
        $quizPassed = false;
        $latestScore = null;
        if ($enrollment->course?->quiz) {
            $attempt = QuizAttempt::query()
                ->where('quiz_id', $enrollment->course->quiz->id)
                ->where('target_id', $enrollment->target_id)
                ->latest()
                ->first();
            $latestScore = $attempt?->score;
            $quizPassed = QuizAttempt::query()
                ->where('quiz_id', $enrollment->course->quiz->id)
                ->where('target_id', $enrollment->target_id)
                ->where('passed', true)
                ->exists();
        }

        return array_merge($enrollment->toArray(), [
            'quiz_passed' => $quizPassed,
            'quiz_score' => $latestScore,
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function enrollmentRows(Request $request): array
    {
        return $this->enrollmentQuery($request)
            ->get()
            ->map(fn (Enrollment $enrollment) => $this->serializeEnrollment($enrollment))
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedLesson(Request $request, bool $creating): array
    {
        $data = $request->validate([
            'title' => [$creating ? 'required' : 'sometimes', 'string', 'max:160'],
            'content_type' => [$creating ? 'required' : 'sometimes', 'in:text,video,pdf'],
            'body' => ['nullable', 'string'],
            'media_url' => ['nullable', 'string', 'max:2048'],
            'media_disk_path' => ['nullable', 'string', 'max:512'],
            'media_mime' => ['nullable', 'string', 'max:120'],
            'media_size' => ['nullable', 'integer', 'min:0'],
            'duration_seconds' => ['nullable', 'integer', 'min:0'],
            'sort_order' => ['sometimes', 'integer', 'min:1'],
        ]);

        $type = $data['content_type'] ?? 'text';
        if ($type === 'text' && $creating && blank($data['body'] ?? null)) {
            $data['body'] = '';
        }

        return $data;
    }

    private function trainingDisk(): string
    {
        return (string) config('filesystems.training_disk', 'local');
    }
}
