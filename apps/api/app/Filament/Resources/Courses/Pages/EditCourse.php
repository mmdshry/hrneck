<?php

namespace App\Filament\Resources\Courses\Pages;

use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\QuizQuestion;
use App\Filament\Resources\Courses\CourseResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;
use RuntimeException;

class EditCourse extends EditRecord
{
    protected static string $resource = CourseResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }

    protected function mutateFormDataBeforeFill(array $data): array
    {
        $course = $this->courseRecord();
        $quizzes = $course->quizzes()->with('questions')->get();
        $data['course_quizzes'] = $quizzes->map(fn ($quiz) => [
            'title' => $quiz->title,
            'pass_score' => $quiz->pass_score,
            'is_required' => $quiz->is_required,
            'time_limit_seconds' => $quiz->time_limit_seconds,
            'questions' => $quiz->questions->map(fn (QuizQuestion $q) => [
                'type' => $q->type ?? QuizQuestion::TYPE_MCQ,
                'prompt' => $q->prompt,
                'options_text' => implode("\n", $q->options ?? []),
                'correct_index' => $q->correct_index ?? 0,
            ])->all(),
        ])->all();

        return $data;
    }

    protected function afterSave(): void
    {
        $quizzes = $this->form->getState()['course_quizzes'] ?? [];
        ListCourses::syncQuizzes($this->courseRecord(), $quizzes);
    }

    private function courseRecord(): Course
    {
        $record = $this->getRecord();
        if (! $record instanceof Course) {
            throw new RuntimeException('EditCourse expects a Course record.');
        }

        return $record;
    }
}
