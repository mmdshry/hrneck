<?php

namespace App\Domains\Ticketing\Support;

use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\Ticketing\Models\SdKbArticle;
use App\Domains\Ticketing\Models\SdTicket;

final class TicketingPayload
{
    /** @return array<string, mixed> */
    public static function desk(SdDesk $desk, bool $detailed = false): array
    {
        $payload = [
            'id' => $desk->id,
            'name' => $desk->name,
            'slug' => $desk->slug,
            'type' => $desk->type,
            'number_prefix' => $desk->number_prefix,
            'is_active' => $desk->is_active,
            'is_system' => $desk->is_system,
            'settings' => $desk->settings,
        ];

        if ($detailed) {
            $payload['stages'] = $desk->stages->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'sequence' => $s->sequence,
                'default_escalation_minutes' => $s->default_escalation_minutes,
                'is_terminal' => $s->is_terminal,
            ])->values();
            $payload['statuses'] = $desk->statuses->map(fn ($s) => [
                'id' => $s->id, 'name' => $s->name, 'slug' => $s->slug, 'is_closed' => $s->is_closed,
            ])->values();
            $payload['priorities'] = $desk->priorities->map(fn ($p) => [
                'id' => $p->id, 'name' => $p->name, 'slug' => $p->slug, 'weight' => $p->weight,
            ])->values();
            $payload['severities'] = $desk->severities->map(fn ($s) => [
                'id' => $s->id, 'name' => $s->name, 'slug' => $s->slug,
            ])->values();
            $payload['categories'] = $desk->categories->map(fn ($c) => [
                'id' => $c->id, 'name' => $c->name, 'slug' => $c->slug, 'parent_id' => $c->parent_id,
            ])->values();
            $payload['procedures'] = $desk->procedures->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->name,
                'hook' => $p->hook,
                'stage_id' => $p->stage_id,
                'is_active' => $p->is_active,
                'steps' => $p->steps,
            ])->values();
            $payload['sla_policies'] = $desk->slaPolicies->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->name,
                'is_default' => $p->is_default,
                'goals' => $p->goals,
            ])->values();
        }

        return $payload;
    }

    /** @return array<string, mixed> */
    public static function ticket(SdTicket $ticket, bool $detailed = false): array
    {
        $payload = [
            'id' => $ticket->id,
            'desk_id' => $ticket->desk_id,
            'desk' => $ticket->relationLoaded('desk') && $ticket->desk ? [
                'id' => $ticket->desk->id,
                'name' => $ticket->desk->name,
                'slug' => $ticket->desk->slug,
                'type' => $ticket->desk->type,
            ] : null,
            'number' => $ticket->number,
            'summary' => $ticket->summary,
            'description' => $ticket->description,
            'stage_id' => $ticket->stage_id,
            'stage' => $ticket->relationLoaded('stage') ? $ticket->stage?->only(['id', 'name', 'is_terminal']) : null,
            'status_id' => $ticket->status_id,
            'status' => $ticket->relationLoaded('status') ? $ticket->status?->only(['id', 'name', 'slug', 'is_closed']) : null,
            'priority_id' => $ticket->priority_id,
            'priority' => $ticket->relationLoaded('priority') ? $ticket->priority?->only(['id', 'name', 'slug']) : null,
            'severity_id' => $ticket->severity_id,
            'category_id' => $ticket->category_id,
            'requester_user_id' => $ticket->requester_user_id,
            'requester_target_id' => $ticket->requester_target_id,
            'assignee_user_id' => $ticket->assignee_user_id,
            'assignee_pool' => $ticket->assignee_pool,
            'escalation_level' => $ticket->escalation_level,
            'escalation_due_at' => optional($ticket->escalation_due_at)?->toIso8601String(),
            'sla_response_due_at' => optional($ticket->sla_response_due_at)?->toIso8601String(),
            'sla_resolve_due_at' => optional($ticket->sla_resolve_due_at)?->toIso8601String(),
            'sla_response_breached' => $ticket->sla_response_breached,
            'sla_resolve_breached' => $ticket->sla_resolve_breached,
            'locked_by' => $ticket->locked_by,
            'archived_at' => optional($ticket->archived_at)?->toIso8601String(),
            'is_unread' => $ticket->is_unread,
            'pending_notification_at' => optional($ticket->pending_notification_at)?->toIso8601String(),
            'created_at' => optional($ticket->created_at)?->toIso8601String(),
            'updated_at' => optional($ticket->updated_at)?->toIso8601String(),
        ];

        if ($detailed) {
            $payload['custom_fields'] = $ticket->custom_fields;
            $payload['notes'] = $ticket->relationLoaded('notes')
                ? $ticket->notes->map(fn ($n) => [
                    'id' => $n->id,
                    'body' => $n->body,
                    'is_public' => $n->is_public,
                    'author_user_id' => $n->author_user_id,
                    'created_at' => optional($n->created_at)?->toIso8601String(),
                ])->values()
                : [];
            $payload['tasks'] = $ticket->relationLoaded('tasks')
                ? $ticket->tasks->map(fn ($t) => [
                    'id' => $t->id,
                    'title' => $t->title,
                    'description' => $t->description,
                    'assignee_user_id' => $t->assignee_user_id,
                    'hours_worked' => $t->hours_worked,
                    'is_completed' => $t->is_completed,
                ])->values()
                : [];
            $payload['attachments'] = $ticket->relationLoaded('attachments')
                ? $ticket->attachments->map(fn ($a) => [
                    'id' => $a->id,
                    'original_name' => $a->original_name,
                    'mime' => $a->mime,
                    'size' => $a->size,
                ])->values()
                : [];
            $payload['links'] = $ticket->relationLoaded('links')
                ? $ticket->links->map(fn ($l) => [
                    'id' => $l->id,
                    'related_type' => $l->related_type,
                    'related_id' => $l->related_id,
                    'link_type' => $l->link_type,
                ])->values()
                : [];
        }

        return $payload;
    }

    /** @return array<string, mixed> */
    public static function kb(SdKbArticle $article): array
    {
        return [
            'id' => $article->id,
            'desk_id' => $article->desk_id,
            'number' => $article->number,
            'summary' => $article->summary,
            'description' => $article->description,
            'category_id' => $article->category_id,
            'is_published' => $article->is_published,
            'source_ticket_id' => $article->source_ticket_id,
            'created_at' => optional($article->created_at)?->toIso8601String(),
            'updated_at' => optional($article->updated_at)?->toIso8601String(),
        ];
    }
}
