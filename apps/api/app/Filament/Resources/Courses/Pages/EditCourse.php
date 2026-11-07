<?php

namespace App\Filament\Resources\Courses\Pages;

use App\Domains\TrainingLms\Models\Quiz;
use App\Domains\TrainingLms\Models\QuizQuestion;
use App\Filament\Resources\Courses\CourseResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

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
        $quiz = $this->record->quiz()->with('questions')->first();
        if ($quiz) {
            $data['quiz_questions'] = $quiz->questions->map(fn (QuizQuestion $q) => [
                'prompt' => $q->prompt,
                'options_text' => implode("\n", $q->options ?? []),
                'correct_index' => $q->correct_index,
            ])->all();
        }

        return $data;
    }

    protected function afterSave(): void
    {
        $questions = $this->form->getState()['quiz_questions'] ?? [];
        $quiz = Quiz::query()->firstOrCreate(
            ['course_id' => $this->record->id],
            ['title' => 'Quiz', 'pass_score' => 70],
        );
        $quiz->questions()->delete();
        foreach ($questions as $q) {
            $options = array_values(array_filter(array_map('trim', explode("\n", (string) ($q['options_text'] ?? '')))));
            QuizQuestion::query()->create([
                'quiz_id' => $quiz->id,
                'prompt' => $q['prompt'],
                'options' => $options,
                'correct_index' => (int) ($q['correct_index'] ?? 0),
            ]);
        }
    }
}
