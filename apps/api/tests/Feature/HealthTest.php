<?php

test('health endpoint returns brand metadata', function () {
    $response = $this->getJson('/api/v1/health');

    $response->assertOk()
        ->assertJsonPath('ok', true)
        ->assertJsonPath('brand', 'HRNECK');
});
