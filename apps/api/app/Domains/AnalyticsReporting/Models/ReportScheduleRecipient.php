<?php

namespace App\Domains\AnalyticsReporting\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $report_schedule_id
 * @property int $user_id
 */
class ReportScheduleRecipient extends Model
{
    protected $fillable = ['report_schedule_id', 'user_id'];
}
