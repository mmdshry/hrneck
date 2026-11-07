<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class IntegrationController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $smtpConfigured = filled(config('mail.mailers.smtp.host'))
            && filled(config('mail.mailers.smtp.username'));

        return response()->json([
            'data' => [
                [
                    'id' => 'smtp',
                    'name' => 'SMTP mail',
                    'status' => $smtpConfigured ? 'connected' : 'disconnected',
                    'details' => [
                        'host' => config('mail.mailers.smtp.host'),
                        'port' => config('mail.mailers.smtp.port'),
                        'from' => config('mail.from.address'),
                        'support' => config('brand.support_address'),
                    ],
                ],
                [
                    'id' => 'entra_directory_sync',
                    'name' => 'Microsoft Entra Directory Sync',
                    'status' => 'coming_soon',
                    'details' => ['message' => 'Add when credentials are available'],
                ],
                [
                    'id' => 'graphus',
                    'name' => 'Graphus',
                    'status' => 'coming_soon',
                    'details' => ['message' => 'Add when credentials are available'],
                ],
            ],
        ]);
    }
}
