<?php

namespace App\Domains\Assistant\Tools\Ticketing;

use App\Domains\Assistant\Tools\AssistantTool;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Ticketing\Models\SdTicket;
use App\Models\User;
use Illuminate\Support\Str;

final class TicketShowTool implements AssistantTool
{
    public function name(): string
    {
        return 'ticket_show';
    }

    public function description(): string
    {
        return 'Show one ticket with its description and public notes. Internal notes are never returned.';
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
        return [
            'ticket_id' => ['required', 'integer', 'min:1'],
        ];
    }

    public function run(array $input, User $actor): array
    {
        $ticket = SdTicket::query()
            ->visibleTo($actor)
            ->with(['desk:id,name', 'status:id,name', 'priority:id,name', 'notes'])
            ->findOrFail((int) $input['ticket_id']);

        $publicNotes = $ticket->notes->where('is_public', true)->take(10)->values();

        return [
            'ticket' => [
                'id' => $ticket->id,
                'number' => $ticket->number,
                'summary' => $ticket->summary,
                'description' => Str::limit((string) $ticket->description, 2000),
                'desk' => $ticket->desk?->name,
                'status' => $ticket->status?->name,
                'priority' => $ticket->priority?->name,
                'assignee_user_id' => $ticket->assignee_user_id,
                'first_responded_at' => $ticket->first_responded_at?->toIso8601String(),
                'resolved_at' => $ticket->resolved_at?->toIso8601String(),
            ],
            'public_notes' => $publicNotes->map(static fn ($note): array => [
                'body' => Str::limit((string) $note->body, 1000),
                'created_at' => $note->created_at?->toIso8601String(),
            ])->all(),
            'internal_notes_omitted' => $ticket->notes->where('is_public', false)->count(),
            'content_note' => AssistantTool::UNTRUSTED_TEXT_NOTE,
        ];
    }

    public function summarize(array $input): string
    {
        return '';
    }
}
