<?php

use App\Models\User;
use App\Support\ListQuery;
use Illuminate\Http\Request;

test('ListQuery applySearch and like filters narrow the query', function () {
    $request = Request::create('/api', 'GET', [
        'q' => 'alice',
        'email' => 'alice@',
    ]);

    $query = User::query();
    ListQuery::applySearch($query, $request, ['name', 'email']);
    ListQuery::applyLikeFilters($query, $request, ['email' => 'email']);

    $sql = strtolower($query->toSql());
    expect($sql)->toContain('like')
        ->and($query->getBindings())->toContain('%alice%')
        ->and($query->getBindings())->toContain('%alice@%');
});

test('ListQuery applySort uses whitelist', function () {
    $request = Request::create('/api', 'GET', [
        'sort' => 'email',
        'order' => 'desc',
    ]);

    $query = User::query();
    ListQuery::applySort($query, $request, [
        'email' => 'email',
        'name' => 'name',
    ], 'id', 'desc');

    expect(strtolower($query->toSql()))->toContain('order by')
        ->and(strtolower($query->toSql()))->toContain('email');
});

test('ListQuery ignores empty filters', function () {
    $request = Request::create('/api', 'GET', [
        'q' => '   ',
        'name' => '',
    ]);

    $query = User::query();
    ListQuery::applySearch($query, $request, ['name']);
    ListQuery::applyLikeFilters($query, $request, ['name' => 'name']);

    expect($query->getBindings())->toBe([]);
});
