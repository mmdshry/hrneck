<?php

namespace App\Domains\Assistant\Tools\Ticketing;

use App\Domains\Assistant\Tools\AssistantTool;
use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\Ticketing\Models\SdTicket;
use App\Domains\Ticketing\Models\SdTicketNote;
use App\Models\User;
use Illuminate\Support\Str;

final class TicketAddNoteTool implements AssistantTool
{
    public function __construct(private readonly LogOrgActivity $audit) {}

    public function name(): string
    {
        return 'ticket_add_note';
    }

    public function description(): string
    {
        return 'Add a note to an existing ticket. Notes are internal unless is_public is true. Requires the user to confirm in HRNECK.';
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
            'ticket_id' => ['required', 'integer', 'min:1'],
            'body' => ['required', 'string', 'max:5000'],
            'is_public' => ['nullable', 'boolean'],
        ];
    }

    public function run(array $input, User $actor): array
    {
        $ticket = SdTicket::query()->visibleTo($actor)->findOrFail((int) $input['ticket_id']);

        $note = SdTicketNote::query()->create([
            'ticket_id' => $ticket->id,
            'body' => (string) $input['body'],
            'is_public' => (bool) ($input['is_public'] ?? false),
            'author_user_id' => $actor->id,
        ]);

        if ($ticket->first_responded_at === null) {
            $ticket->first_responded_at = now();
            $ticket->save();
        }

        $this->audit->handle(
            'ticketing',
            'ticket_note_added',
            'Note added by assistant',
            $ticket,
            ['ticket_id' => $ticket->id, 'is_public' => $note->is_public],
            $actor->id,
        );

        PublishLive::org([LiveTopics::TICKETS], throttled: true);

        return [
            'note_id' => $note->id,
            'ticket_id' => $ticket->id,
        ];
    }

    public function summarize(array $input): string
    {
        return sprintf(
            'Add a %s note to ticket #%d: "%s"',
            filter_var($input['is_public'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 'public' : 'internal',
            (int) $input['ticket_id'],
            Str::limit((string) $input['body'], 160),
        );
    }
}
