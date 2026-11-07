<?php

namespace App\Domains\Ticketing\Actions;

use App\Domains\Ticketing\Models\SdTicket;
use App\Domains\Ticketing\Models\SdTicketLink;
use App\Domains\Ticketing\Models\SdTicketNote;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ManageTicketBulk
{
    public function __construct(
        private readonly CreateTicket $createTicket,
        private readonly UpdateTicket $updateTicket,
    ) {}

    /** @param list<int> $ids */
    public function archive(array $ids): int
    {
        return SdTicket::query()->whereIn('id', $ids)->whereNull('archived_at')
            ->update(['archived_at' => Carbon::now()]);
    }

    /** @param list<int> $ids */
    public function unarchive(array $ids): int
    {
        return SdTicket::query()->whereIn('id', $ids)->whereNotNull('archived_at')
            ->update(['archived_at' => null]);
    }

    /** @param list<int> $ids */
    public function unlock(array $ids): int
    {
        return SdTicket::query()->whereIn('id', $ids)
            ->update(['locked_by' => null, 'locked_at' => null]);
    }

    /** @param list<int> $ids */
    public function markRead(array $ids, bool $unread): int
    {
        return SdTicket::query()->whereIn('id', $ids)->update(['is_unread' => $unread]);
    }

    /** @param list<int> $ids */
    public function stopNotification(array $ids): int
    {
        return SdTicket::query()->whereIn('id', $ids)
            ->whereNotNull('pending_notification_at')
            ->update(['pending_notification_at' => null]);
    }

    /** @param list<int> $ids */
    public function delete(array $ids): int
    {
        return SdTicket::query()->whereIn('id', $ids)->delete();
    }

    /**
     * @param  list<int>  $ids
     * @param  array<string, mixed>  $fields
     */
    public function groupUpdate(array $ids, array $fields, ?int $actorUserId = null): int
    {
        $count = 0;
        foreach (SdTicket::query()->whereIn('id', $ids)->get() as $ticket) {
            $this->updateTicket->handle($ticket, $fields, $actorUserId, forceUnlock: true);
            $count++;
        }

        return $count;
    }

    /** @param list<int> $ids */
    public function link(array $ids): void
    {
        if (count($ids) < 2) {
            throw ValidationException::withMessages(['ids' => ['Select at least two tickets to link.']]);
        }

        foreach ($ids as $a) {
            foreach ($ids as $b) {
                if ($a === $b) {
                    continue;
                }
                SdTicketLink::query()->firstOrCreate([
                    'ticket_id' => $a,
                    'related_type' => 'ticket',
                    'related_id' => $b,
                    'link_type' => 'related',
                ]);
            }
        }
    }

    public function merge(array $ids, int $primaryId, ?int $actorUserId = null): SdTicket
    {
        return DB::transaction(function () use ($ids, $primaryId, $actorUserId): SdTicket {
            /** @var SdTicket $primary */
            $primary = SdTicket::query()->findOrFail($primaryId);
            foreach ($ids as $id) {
                if ((int) $id === $primaryId) {
                    continue;
                }
                /** @var SdTicket $other */
                $other = SdTicket::query()->findOrFail($id);
                SdTicketNote::query()->create([
                    'ticket_id' => $primary->id,
                    'body' => "Merged from {$other->number}: {$other->summary}\n\n".((string) $other->description),
                    'is_public' => false,
                    'author_user_id' => $actorUserId,
                ]);
                foreach ($other->notes as $note) {
                    SdTicketNote::query()->create([
                        'ticket_id' => $primary->id,
                        'body' => $note->body,
                        'is_public' => $note->is_public,
                        'author_user_id' => $note->author_user_id,
                    ]);
                }
                $other->merged_into_id = $primary->id;
                $other->archived_at = Carbon::now();
                $other->save();
                SdTicketLink::query()->firstOrCreate([
                    'ticket_id' => $primary->id,
                    'related_type' => 'ticket',
                    'related_id' => $other->id,
                    'link_type' => 'merged',
                ]);
            }

            return $primary->fresh(['notes', 'links']) ?? $primary;
        });
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    public function copy(SdTicket $source, int $targetDeskId, array $overrides = [], bool $link = true, ?int $actorUserId = null): SdTicket
    {
        $payload = array_merge([
            'desk_id' => $targetDeskId,
            'summary' => $source->summary,
            'description' => $source->description,
            'priority_id' => null,
            'requester_user_id' => $source->requester_user_id,
            'requester_target_id' => $source->requester_target_id,
            'custom_fields' => $source->custom_fields,
        ], $overrides);

        $copy = $this->createTicket->handle($payload, $actorUserId);

        if (! empty($overrides['include_notes'])) {
            foreach ($source->notes as $note) {
                SdTicketNote::query()->create([
                    'ticket_id' => $copy->id,
                    'body' => $note->body,
                    'is_public' => $note->is_public,
                    'author_user_id' => $note->author_user_id,
                ]);
            }
        }

        if ($link) {
            SdTicketLink::query()->firstOrCreate([
                'ticket_id' => $source->id,
                'related_type' => 'ticket',
                'related_id' => $copy->id,
                'link_type' => 'related',
            ]);
            SdTicketLink::query()->firstOrCreate([
                'ticket_id' => $copy->id,
                'related_type' => 'ticket',
                'related_id' => $source->id,
                'link_type' => 'related',
            ]);
        }

        return $copy->fresh(['notes', 'links']) ?? $copy;
    }
}
