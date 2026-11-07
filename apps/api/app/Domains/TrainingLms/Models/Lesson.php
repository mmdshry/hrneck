<?php

namespace App\Domains\TrainingLms\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $course_id
 * @property string $title
 * @property string $content_type
 * @property string|null $body
 * @property string|null $media_url
 * @property string|null $media_disk_path
 * @property string|null $media_mime
 * @property int|null $media_size
 * @property int|null $duration_seconds
 * @property int $sort_order
 */
class Lesson extends Model
{
    protected $fillable = [
        'course_id',
        'title',
        'content_type',
        'body',
        'media_url',
        'media_disk_path',
        'media_mime',
        'media_size',
        'duration_seconds',
        'sort_order',
    ];

    /** @return BelongsTo<Course, $this> */
    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /** @return HasMany<LessonProgress, $this> */
    public function progressRows(): HasMany
    {
        return $this->hasMany(LessonProgress::class);
    }

    public function hasUploadedMedia(): bool
    {
        return filled($this->media_disk_path);
    }

    public function isExternalVideo(): bool
    {
        return $this->content_type === 'video' && filled($this->media_url) && ! $this->hasUploadedMedia();
    }
}
