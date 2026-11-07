<?php

namespace App\Domains\Ticketing\Actions;

use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\Ticketing\Models\SdKbArticle;
use App\Domains\Ticketing\Models\SdTicket;
use App\Domains\Ticketing\Models\SdTicketLink;
use App\Domains\Ticketing\Support\TicketNumberAllocator;

class ConvertTicketToKb
{
    public function __construct(private readonly TicketNumberAllocator $numbers) {}

    public function handle(SdTicket $ticket, ?int $actorUserId = null, bool $publish = false): SdKbArticle
    {
        $kbDesk = SdDesk::query()->where('type', 'kb')->where('is_active', true)->first()
            ?? SdDesk::query()->where('slug', 'knowledge-base')->firstOrFail();

        $article = SdKbArticle::query()->create([
            'desk_id' => $kbDesk->id,
            'number' => $this->numbers->next($kbDesk),
            'summary' => $ticket->summary,
            'description' => $ticket->description,
            'category_id' => $ticket->category_id,
            'is_published' => $publish,
            'source_ticket_id' => $ticket->id,
            'created_by' => $actorUserId,
            'updated_by' => $actorUserId,
        ]);

        SdTicketLink::query()->firstOrCreate([
            'ticket_id' => $ticket->id,
            'related_type' => 'kb',
            'related_id' => $article->id,
            'link_type' => 'related',
        ]);

        return $article;
    }
}
