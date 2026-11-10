<?php

namespace App\Domains\DirectorySync\Drivers;

class MockDirectorySyncDriver implements DirectorySyncDriver
{
    public function fetch(): array
    {
        $fixture = json_decode(
            (string) file_get_contents(base_path('database/fixtures/directory_sync_mock.json')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );

        $tenantId = is_string(tenant('id')) ? (string) tenant('id') : 'central';

        // Only uniquify emails for central User provisioning; external_ids stay as in the fixture
        // (they are already unique within each tenant database).
        foreach ($fixture['users'] as &$user) {
            $email = (string) ($user['email'] ?? '');
            if ($email === '') {
                continue;
            }
            [$local, $domain] = array_pad(explode('@', $email, 2), 2, 'example.test');
            $user['email'] = $local.'+'.$tenantId.'@'.$domain;
        }
        unset($user);

        return $fixture;
    }
}
