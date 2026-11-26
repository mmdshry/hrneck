<?php

namespace App\Domains\Assistant\Tools\Ticketing;

use App\Domains\Assistant\Tools\AssistantTool;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Ticketing\Models\SdDesk;
use App\Models\User;

final class TicketDesksTool implements AssistantTool
{
    public function name(): string
    {
        return 'ticket_desks';
    }

    public function description(): string
    {
        return 'List the active service desks (ticket queues) with their ids. Call this before creating a ticket.';
    }

    public function permission(): string
    {
        return OrgPermissionCatalog::TICKETING_TICKETS;
    }

    public function writes(): bool
    {
        return false;
    }

    public function rules(): array
    {
        return [];
    }

    public function run(array $input, User $actor): array
    {
        $desks = SdDesk::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'slug']);

        return [
            'desks' => $desks->map(static fn (SdDesk $desk): array => [
                'id' => $desk->id,
                'name' => $desk->name,
                'slug' => $desk->slug,
            ])->values()->all(),
        ];
    }

    public function summarize(array $input): string
    {
        return '';
    }
}
