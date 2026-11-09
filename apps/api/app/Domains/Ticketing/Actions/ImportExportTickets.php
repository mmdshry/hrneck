<?php

namespace App\Domains\Ticketing\Actions;

use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\Ticketing\Models\SdTicket;
use App\Domains\Ticketing\Models\SdTicketNote;
use Illuminate\Support\Collection;

class ImportExportTickets
{
    /**
     * @param  list<int>  $ids
     * @return array{tickets: list<array<string, mixed>>}
     */
    public function export(array $ids): array
    {
        $tickets = SdTicket::query()
            ->with(['notes', 'tasks', 'links', 'desk'])
            ->whereIn('id', $ids)
            ->get();

        return [
            'tickets' => $tickets->map(fn (SdTicket $t) => [
                'number' => $t->number,
                'desk_slug' => $t->desk?->slug,
                'summary' => $t->summary,
                'description' => $t->description,
                'assignee_pool' => $t->assignee_pool,
                'custom_fields' => $t->custom_fields,
                'notes' => $t->notes->map(fn (SdTicketNote $n) => [
                    'body' => $n->body,
                    'is_public' => $n->is_public,
                ])->values()->all(),
                'tasks' => $t->tasks->map(fn ($task) => [
                    'title' => $task->title,
                    'description' => $task->description,
                    'hours_worked' => $task->hours_worked,
                    'is_completed' => $task->is_completed,
                ])->values()->all(),
            ])->values()->all(),
        ];
    }

    /**
     * @param  array{tickets?: list<array<string, mixed>>}  $payload
     * @return Collection<int, SdTicket>
     */
    public function import(array $payload, CreateTicket $create, ?int $actorUserId = null): Collection
    {
        $created = collect();
        foreach ($payload['tickets'] ?? [] as $row) {
            if (! is_array($row)) {
                continue;
            }
            $deskSlug = (string) ($row['desk_slug'] ?? 'incident');
            $deskId = SdDesk::query()->where('slug', $deskSlug)->value('id');
            if (! $deskId) {
                continue;
            }
            $ticket = $create->handle([
                'desk_id' => $deskId,
                'summary' => (string) ($row['summary'] ?? 'Imported ticket'),
                'description' => $row['description'] ?? null,
                'assignee_pool' => $row['assignee_pool'] ?? null,
                'custom_fields' => $row['custom_fields'] ?? null,
            ], $actorUserId);

            foreach ($row['notes'] ?? [] as $note) {
                if (! is_array($note)) {
                    continue;
                }
                SdTicketNote::query()->create([
                    'ticket_id' => $ticket->id,
                    'body' => (string) ($note['body'] ?? ''),
                    'is_public' => (bool) ($note['is_public'] ?? true),
                    'author_user_id' => $actorUserId,
                ]);
            }
            $created->push($ticket);
        }

        return $created;
    }
}
