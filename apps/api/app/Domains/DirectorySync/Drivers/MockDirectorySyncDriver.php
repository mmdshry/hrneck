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

        return $fixture;
    }
}
