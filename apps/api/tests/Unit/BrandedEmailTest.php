<?php

use App\Domains\AnalyticsReporting\Mails\CampaignReportMail;
use App\Domains\Notifications\Mails\BrandedNotificationMail;
use App\Domains\Tenancy\Support\TenantAddress;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mime\Part\DataPart;

test('a trailing link line becomes the call to action and is removed from the text', function () {
    $mail = BrandedNotificationMail::fromPlainBody(
        'HRneck: Policy update',
        "Hello team,\n\nNew remote-work policy is live.\n\nOpen: https://app.hrneck.test/portal\n",
    );

    expect($mail->lines)->toBe(['Hello team,', 'New remote-work policy is live.'])
        ->and($mail->actions)->toBe([['label' => 'Open', 'url' => 'https://app.hrneck.test/portal']]);
});

test('localized link labels are recognised as the call to action', function () {
    $mail = BrandedNotificationMail::fromPlainBody(
        'HRneck: Annonce',
        "Bonjour,\n\nNouvelle politique publiée.\n\nOuvrir : https://app.hrneck.test/portal",
    );

    expect($mail->actions)->toBe([['label' => 'Open', 'url' => 'https://app.hrneck.test/portal']])
        ->and($mail->lines)->toBe(['Bonjour,', 'Nouvelle politique publiée.']);
});

test('a url inside a sentence is not turned into a button', function () {
    $mail = BrandedNotificationMail::fromPlainBody(
        'HRneck: Notice',
        'Read https://app.hrneck.test/faq before you start.',
    );

    expect($mail->actions)->toBe([])
        ->and($mail->lines)->toBe(['Read https://app.hrneck.test/faq before you start.']);
});

test('password reset mail renders the branded layout with the reset link, footer and inline logo', function () {
    $html = BrandedNotificationMail::passwordReset('https://app.hrneck.test/login/reset?token=abc', 60)->render();

    expect($html)
        ->toContain('https://app.hrneck.test/login/reset?token=abc')
        ->toContain('Reset password')
        ->toContain('This link expires in 60 minutes.')
        ->toContain(config('brand.support_address'))
        ->toContain('data:image/png;base64,')
        ->not->toContain('cid:');
});

test('password reset notification builds the branded mail addressed to the user', function () {
    $notifiable = new class
    {
        public string $email = 'ana@example.test';

        public ?string $tenant_id = null;
    };

    $mail = (new ResetPassword('tok123'))->toMail($notifiable);

    expect($mail)->toBeInstanceOf(BrandedNotificationMail::class)
        ->and($mail->hasTo('ana@example.test'))->toBeTrue()
        ->and($mail->render())
        ->toContain('token=tok123')
        ->toContain('email=ana%40example.test')
        ->toContain('This link expires in')
        ->toContain('Reset password');
});

test('an organization reset mail links to that organization and names its sign-in address', function () {
    $notifiable = new class
    {
        public string $email = 'ana@example.test';

        public ?string $tenant_id = 'itneck';
    };

    $addresses = app(TenantAddress::class);

    expect((new ResetPassword('tok123'))->toMail($notifiable)->render())
        ->toContain($addresses->origin('itneck').'/login/reset?token=tok123')
        ->toContain('Sign in to your organization: <a href="'.$addresses->loginUrl('itneck').'"');
});

test('mail to an organization member ends with the sign-in address in the html and text parts', function () {
    $loginUrl = app(TenantAddress::class)->loginUrl('itneck');

    Mail::mailer('array')->to('ana@example.test')->send(
        BrandedNotificationMail::fromPlainBody('HRneck: Policy', "Hi Ana,\n\nNew policy is live.", $loginUrl),
    );

    /** @var ArrayTransport $transport */
    $transport = Mail::mailer('array')->getSymfonyTransport();
    $sent = $transport->messages()->last()->getOriginalMessage();

    expect($sent->getHtmlBody())->toContain('Sign in to your organization: <a href="'.$loginUrl.'"')
        ->and($sent->getTextBody())->toContain('Sign in to your organization: '.$loginUrl);
});

test('mail without an organization has no sign-in footer', function () {
    $mail = BrandedNotificationMail::fromPlainBody('HRneck: Notice', 'Plain notice for everyone.');

    expect($mail->render())->not->toContain('Sign in to your organization');
});

test('campaign report to an organization member carries the sign-in footer', function () {
    $loginUrl = app(TenantAddress::class)->loginUrl('itneck');

    Mail::mailer('array')->to('reports@example.test')->send(
        new CampaignReportMail("metric,value\nemployees,42", loginUrl: $loginUrl),
    );

    /** @var ArrayTransport $transport */
    $transport = Mail::mailer('array')->getSymfonyTransport();
    $sent = $transport->messages()->last()->getOriginalMessage();

    expect($sent->getHtmlBody())->toContain('Sign in to your organization: <a href="'.$loginUrl.'"')
        ->and($sent->getTextBody())->toContain('Sign in to your organization: '.$loginUrl);
});

test('employee invite mail asks for a password and states the seven day expiry', function () {
    $mail = BrandedNotificationMail::employeeInvite('https://app.hrneck.test/login/reset?token=abc', 7);

    expect($mail->subjectLine)->toBe("You're invited to ".config('brand.short'))
        ->and($mail->render())
        ->toContain('https://app.hrneck.test/login/reset?token=abc')
        ->toContain('Set your password')
        ->toContain('This link expires in 7 days.')
        ->not->toContain('Reset your password');
});

test('branded mail is sent with an html body, a plain text alternative and an inline logo', function () {
    Mail::mailer('array')->to('ana@example.test')->send(
        BrandedNotificationMail::fromPlainBody('HRneck: Test', "Hi Ana,\n\nOpen: https://app.hrneck.test/portal"),
    );

    /** @var ArrayTransport $transport */
    $transport = Mail::mailer('array')->getSymfonyTransport();
    $sent = $transport->messages()->last()->getOriginalMessage();

    /** @var DataPart|null $logo */
    $logo = collect($sent->getAttachments())->first(
        fn (DataPart $part): bool => $part->getDisposition() === 'inline',
    );

    expect($sent->getSubject())->toBe('HRneck: Test')
        ->and($sent->getHtmlBody())->toContain('href="https://app.hrneck.test/portal"')
        ->and($sent->getTextBody())->toContain('Open: https://app.hrneck.test/portal')
        ->and($sent->getTextBody())->not->toContain('<')
        ->and($logo)->not->toBeNull()
        ->and($sent->getHtmlBody())->toContain('cid:'.$logo?->getContentId());
});

test('campaign report sends the csv in the html and text parts', function () {
    Mail::mailer('array')->to('reports@example.test')->send(
        new CampaignReportMail("metric,value\nemployees,42"),
    );

    /** @var ArrayTransport $transport */
    $transport = Mail::mailer('array')->getSymfonyTransport();
    $sent = $transport->messages()->last()->getOriginalMessage();

    expect($sent->getHtmlBody())->toContain('<pre')
        ->and($sent->getHtmlBody())->toContain('employees,42')
        ->and($sent->getTextBody())->toContain('metric,value')
        ->and(collect($sent->getAttachments())->every(
            fn (DataPart $part): bool => $part->getDisposition() === 'inline',
        ))->toBeTrue();
});
