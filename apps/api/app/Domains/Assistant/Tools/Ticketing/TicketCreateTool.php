<?php

namespace App\Domains\Assistant\Tools\Ticketing;

use App\Domains\Assistant\Tools\AssistantTool;
use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Ticketing\Actions\CreateTicket;
use App\Domains\Ticketing\Models\SdDesk;
use App\Models\User;
use Illuminate\Support\Str;

final class TicketCreateTool implements AssistantTool
{
    public function __construct(
        private readonly CreateTicket $createTicket,
        private readonly LogOrgActivity $audit,
    ) {}

    public function name(): string
    {
        return 'ticket_create';
    }

    public function description(): string
    {
        return 'Create a service desk ticket. Requires the user to confirm in HRNECK before it is created.';
    }

    public function permission(): string
    {
        return OrgPermissionCatalog::TICKETING_TICKETS;
    }

    public function writes(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'desk_id' => ['required', 'integer', 'min:1'],
            'summary' => ['required', 'string', 'max:500'],
            'description' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function run(array $input, User $actor): array
    {
        $ticket = $this->createTicket->handle([
            'desk_id' => (int) $input['desk_id'],
            'summary' => (string) $input['summary'],
            'description' => $input['description'] ?? null,
        ], $actor->id);

        $this->audit->handle(
            'ticketing',
            'ticket_created',
            'Ticket created by assistant',
            $ticket,
            ['number' => $ticket->number, 'desk_id' => $ticket->desk_id],
            $actor->id,
        );

        return [
            'id' => $ticket->id,
            'number' => $ticket->number,
            'summary' => $ticket->summary,
        ];
    }

    public function summarize(array $input): string
    {
        $deskName = SdDesk::query()->whereKey((int) $input['desk_id'])->value('name')
            ?? '#'.(int) $input['desk_id'];

        return sprintf(
            'Create a ticket in "%s" titled "%s".',
            $deskName,
            Str::limit((string) $input['summary'], 120),
        );
    }
}
