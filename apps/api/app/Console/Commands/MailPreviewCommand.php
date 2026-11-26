<?php

namespace App\Console\Commands;

use App\Domains\AnalyticsReporting\Mails\CampaignReportMail;
use App\Domains\Notifications\Mails\BrandedNotificationMail;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class MailPreviewCommand extends Command
{
    protected $signature = 'mail:preview {--path= : Directory for the HTML previews (default: storage/app/mail-previews)}';

    protected $description = 'Render every branded email template to HTML so the layout can be checked in a browser';

    public function handle(): int
    {
        $directory = (string) ($this->option('path') ?: storage_path('app/mail-previews'));
        File::ensureDirectoryExists($directory);

        $appUrl = rtrim((string) config('brand.frontend_url'), '/');

        $previews = [
            'notification' => BrandedNotificationMail::fromPlainBody(
                'HRNECK: New announcement',
                "Hello team,\n\nWe published a new policy for remote work.\n\nOpen: {$appUrl}/portal",
            ),
            'training-reminder' => new BrandedNotificationMail(
                subjectLine: 'HRNECK training: 2 courses',
                title: 'Training reminder',
                lines: ['Hi Sara,', 'Please complete the following training:'],
                actions: [
                    ['label' => 'Phishing awareness', 'url' => "{$appUrl}/portal?course=1"],
                    ['label' => 'Password hygiene', 'url' => "{$appUrl}/portal?course=2"],
                ],
            ),
            'password-reset' => BrandedNotificationMail::passwordReset("{$appUrl}/login/reset?token=preview", 60),
            'campaign-report-csv' => new CampaignReportMail("metric,value\nemployees,42\ncompleted,17"),
            'campaign-report-pdf' => new CampaignReportMail('', '%PDF-1.4 preview', 'report.pdf'),
        ];

        foreach ($previews as $name => $mail) {
            $path = $directory.DIRECTORY_SEPARATOR.$name.'.html';
            File::put($path, $mail->render());
            $this->line('Wrote '.$path);
        }

        return self::SUCCESS;
    }
}
