<?php

use App\Domains\IdentityAccess\Support\AvatarStorage;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
    Storage::fake(AvatarStorage::disk());
});

test('admin target avatar upload syncs linked user path', function () {
    Queue::fake();
    $admin = orgAdmin();

    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'avatar.sync@itneck.test',
            'first_name' => 'Avatar',
            'last_name' => 'Sync',
            'timezone' => 'UTC',
        ])
        ->assertCreated();

    $targetId = (int) $created->json('data.id');
    $user = User::query()->where('email', 'avatar.sync@itneck.test')->firstOrFail();

    $upload = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/targets/'.$targetId.'/avatar', [
            'file' => UploadedFile::fake()->image('face.png', 48, 48),
        ])
        ->assertOk()
        ->assertJsonPath('data.avatar_url', '/api/v1/org/targets/'.$targetId.'/avatar')
        ->json('data');

    expect($upload['avatar_path'])->toEndWith('.webp');
    expect(Storage::disk(AvatarStorage::disk())->exists($upload['avatar_path']))->toBeTrue();

    expect($user->fresh()->avatar_path)->toBe($upload['avatar_path']);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $target = Target::query()->findOrFail($targetId);
    expect($target->avatar_path)->toBe($upload['avatar_path']);
    Tenancy::end();
});

test('self auth avatar upload syncs linked target', function () {
    Queue::fake();
    $admin = orgAdmin();

    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'self.avatar@itneck.test',
            'first_name' => 'Self',
            'last_name' => 'Avatar',
            'timezone' => 'UTC',
        ])
        ->assertCreated();

    $targetId = (int) $created->json('data.id');
    $user = User::query()->where('email', 'self.avatar@itneck.test')->firstOrFail();
    $user->forceFill([
        'must_set_password' => false,
        'password' => 'DemoPass!234',
    ])->save();

    $upload = $this->actingAs($user)
        ->post('/api/v1/auth/avatar', [
            'file' => UploadedFile::fake()->image('me.jpg', 40, 40),
        ])
        ->assertOk()
        ->assertJsonPath('data.avatar_url', '/api/v1/auth/avatar')
        ->json('data');

    expect($upload['avatar_path'])->toEndWith('.webp');
    expect($user->fresh()->avatar_path)->toBe($upload['avatar_path']);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $target = Target::query()->findOrFail($targetId);
    expect($target->avatar_path)->toBe($upload['avatar_path']);
    Tenancy::end();
});

test('deleting avatar clears both paths and removes file', function () {
    Queue::fake();
    $admin = orgAdmin();

    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'avatar.delete@itneck.test',
            'first_name' => 'Delete',
            'last_name' => 'Me',
            'timezone' => 'UTC',
        ])
        ->assertCreated();

    $targetId = (int) $created->json('data.id');
    $user = User::query()->where('email', 'avatar.delete@itneck.test')->firstOrFail();

    $path = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/targets/'.$targetId.'/avatar', [
            'file' => UploadedFile::fake()->image('gone.png', 32, 32),
        ])
        ->assertOk()
        ->json('data.avatar_path');

    expect(Storage::disk(AvatarStorage::disk())->exists($path))->toBeTrue();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->delete('/api/v1/org/targets/'.$targetId.'/avatar')
        ->assertOk()
        ->assertJsonPath('data.avatar_url', null);

    expect(Storage::disk(AvatarStorage::disk())->exists($path))->toBeFalse();
    expect($user->fresh()->avatar_path)->toBeNull();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(Target::query()->findOrFail($targetId)->avatar_path)->toBeNull();
    Tenancy::end();
});

test('avatar stream returns 404 when empty and webp when present', function () {
    Queue::fake();
    $admin = orgAdmin();

    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'avatar.stream@itneck.test',
            'first_name' => 'Stream',
            'last_name' => 'Test',
            'timezone' => 'UTC',
        ])
        ->assertCreated();

    $targetId = (int) $created->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->get('/api/v1/org/targets/'.$targetId.'/avatar')
        ->assertNotFound();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/targets/'.$targetId.'/avatar', [
            'file' => UploadedFile::fake()->image('stream.webp', 36, 36),
        ])
        ->assertOk();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->get('/api/v1/org/targets/'.$targetId.'/avatar')
        ->assertOk()
        ->assertHeader('Content-Type', 'image/webp');

    $this->actingAs($admin)
        ->get('/api/v1/org/targets/'.$targetId.'/avatar?tenant=itneck')
        ->assertOk()
        ->assertHeader('Content-Type', 'image/webp');
});

test('avatar upload rejects non-image and oversized files', function () {
    $admin = orgAdmin();

    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'avatar.bad@itneck.test',
            'first_name' => 'Bad',
            'last_name' => 'File',
            'timezone' => 'UTC',
        ])
        ->assertCreated();

    $targetId = (int) $created->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/targets/'.$targetId.'/avatar', [
            'file' => UploadedFile::fake()->create('notes.pdf', 20, 'application/pdf'),
        ])
        ->assertStatus(422);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/targets/'.$targetId.'/avatar', [
            'file' => UploadedFile::fake()->image('huge.png', 100, 100)->size(3000),
        ])
        ->assertStatus(422);
});

test('auth me includes avatar_url when set', function () {
    $admin = orgAdmin();

    $this->actingAs($admin)
        ->post('/api/v1/auth/avatar', [
            'file' => UploadedFile::fake()->image('admin.png', 24, 24),
        ])
        ->assertOk();

    $this->actingAs($admin)
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.avatar_url', '/api/v1/auth/avatar');
});
