<?php

use App\Domains\TargetsGroups\Support\TargetCsvRowNormalizer;
use App\Support\AppLocale;
use App\Support\MajorCities;

test('major cities include iran tehran format', function () {
    expect(MajorCities::isValid('Iran/Tehran'))->toBeTrue();
    expect(MajorCities::isValid('Tehran'))->toBeFalse();
    expect(MajorCities::normalize('Iran/Tehran'))->toBe('Iran/Tehran');
    expect(MajorCities::normalize('Remote'))->toBeNull();
});

test('csv normalizer maps invalid language to default and ignores risk', function () {
    $result = app(TargetCsvRowNormalizer::class)->normalize([
        'preferred_language' => 'fa',
        'location' => 'Iran/Tehran',
        'risk_score' => '40',
        'risk_tier' => 'high',
    ]);

    expect($result['values']['preferred_language'])->toBe(AppLocale::DEFAULT);
    expect($result['values']['location'])->toBe('Iran/Tehran');
    expect($result['values'])->not->toHaveKey('risk');
    expect($result['warnings'])->toContain('Invalid preferred_language; defaulted to '.AppLocale::DEFAULT.'.');
    expect($result['warnings'])->toContain('risk_score and risk_tier are computed automatically; CSV values ignored.');
});

test('csv normalizer drops invalid locations', function () {
    $result = app(TargetCsvRowNormalizer::class)->normalize([
        'location' => 'Remote Office',
    ]);

    expect($result['values']['location'])->toBeNull();
    expect($result['warnings'])->toContain('Invalid location; value ignored. Use Country/City (e.g. United Kingdom/London).');
});
