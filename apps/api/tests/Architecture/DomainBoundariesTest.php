<?php

arch('analytics report mailables live in Domains')
    ->expect('App\Domains\AnalyticsReporting\Mails')
    ->toExtend('Illuminate\Mail\Mailable');

arch('custom domain guidance is a dedicated action')
    ->expect('App\Domains\CustomDomains\Actions\BuildDnsGuidance')
    ->toBeClasses();
