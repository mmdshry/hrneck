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
                    $questions = $data['quiz_questions'] ?? [];
                    unset($data['quiz_questions']);
                    $course = Course::query()->create($data);
                    if ($questions !== []) {
                        $quiz = Quiz::query()->create([
                            'course_id' => $course->id,
                            'title' => 'Quiz',
                            'pass_score' => 70,
                        ]);
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

                    return $course;
                })
                ->successRedirectUrl(fn (Course $record): string => CourseResource::getUrl('edit', ['record' => $record])),
        ];
    }

    public function getHeading(): string
    {
        return FilamentTenant::has() ? 'Training courses' : 'Training courses — select an organization';
    }
}
