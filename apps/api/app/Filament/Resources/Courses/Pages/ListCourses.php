<?php

namespace App\Filament\Resources\Courses\Pages;

use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Quiz;
use App\Domains\TrainingLms\Models\QuizQuestion;
use App\Filament\Concerns\InteractsWithFilamentTenantTable;
use App\Filament\Resources\Courses\CourseResource;
use App\Support\FilamentTenant;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListCourses extends ListRecords
{
    use InteractsWithFilamentTenantTable;

    protected static string $resource = CourseResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()
                ->visible(fn (): bool => FilamentTenant::has())
                ->using(function (array $data): Course {
                    $quizzes = $data['course_quizzes'] ?? [];
                    unset($data['course_quizzes']);
                    $course = Course::query()->create($data);
                    self::syncQuizzes($course, $quizzes);

                    return $course;
                })
                ->successRedirectUrl(fn (Course $record): string => CourseResource::getUrl('edit', ['record' => $record])),
        ];
    }

    public function getHeading(): string
    {
        return FilamentTenant::has() ? 'Training courses' : 'Training courses — select an organization';
    }

    /**
     * @param  list<array<string, mixed>>  $quizzes
     */
    public static function syncQuizzes(Course $course, array $quizzes): void
    {
        foreach ($course->quizzes()->with('questions')->get() as $quiz) {
            $quiz->questions()->delete();
            $quiz->delete();
        }

        foreach ($quizzes as $index => $quizData) {
            $questions = $quizData['questions'] ?? [];
            $quiz = Quiz::query()->create([
                'course_id' => $course->id,
                'title' => $quizData['title'] ?? 'Quiz',
                'pass_score' => (int) ($quizData['pass_score'] ?? 70),
                'is_required' => (bool) ($quizData['is_required'] ?? true),
                'time_limit_seconds' => isset($quizData['time_limit_seconds']) && $quizData['time_limit_seconds'] !== ''
                    ? (int) $quizData['time_limit_seconds']
                    : null,
                'sort_order' => $index,
            ]);

            foreach ($questions as $question) {
                $type = ($question['type'] ?? 'mcq') === 'essay' ? QuizQuestion::TYPE_ESSAY : QuizQuestion::TYPE_MCQ;
                $options = null;
                $correctIndex = null;
                if ($type === QuizQuestion::TYPE_MCQ) {
                    $options = array_values(array_filter(array_map('trim', explode("\n", (string) ($question['options_text'] ?? '')))));
                    $correctIndex = (int) ($question['correct_index'] ?? 0);
                }
                QuizQuestion::query()->create([
                    'quiz_id' => $quiz->id,
                    'type' => $type,
                    'prompt' => $question['prompt'],
                    'options' => $options,
                    'correct_index' => $correctIndex,
                ]);
            }
        }
    }
}
