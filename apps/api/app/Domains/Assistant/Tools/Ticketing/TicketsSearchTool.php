<?php

namespace App\Domains\Assistant\Tools\Ticketing;

use App\Domains\Assistant\Tools\AssistantTool;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Ticketing\Models\SdTicket;
use App\Models\User;
use App\Support\ListQuery;

final class TicketsSearchTool implements AssistantTool
{
    public function name(): string
    {
        return 'tickets_search';
    }

    public function description(): string
    {
        return 'Search active service desk tickets by keyword or ticket number. Returns summaries and status, not full descriptions.';
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
            'q' => ['nullable', 'string', 'max:200'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:20'],
        ];
    }

    public function run(array $input, User $actor): array
    {
        $query = SdTicket::query()
            ->visibleTo($actor)
            ->with(['desk:id,name', 'status:id,name', 'priority:id,name'])
            ->active();

        if (filled($input['q'] ?? null)) {
            $pattern = ListQuery::likePattern(trim((string) $input['q']));
            $query->where(function ($builder) use ($pattern): void {
                $builder->where('summary', 'like', $pattern)->orWhere('number', 'like', $pattern);
            });
        }

        $tickets = $query->latest()->limit((int) ($input['limit'] ?? 10))->get();

        return [
            'tickets' => $tickets->map(static fn (SdTicket $ticket): array => [
                'id' => $ticket->id,
                'number' => $ticket->number,
                'summary' => $ticket->summary,
                'desk' => $ticket->desk?->name,
                'status' => $ticket->status?->name,
                'priority' => $ticket->priority?->name,
                'updated_at' => $ticket->updated_at?->toIso8601String(),
            ])->values()->all(),
            'content_note' => AssistantTool::UNTRUSTED_TEXT_NOTE,
        ];
    }

    public function summarize(array $input): string
    {
        return '';
    }
}
