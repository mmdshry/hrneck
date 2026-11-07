<?php

namespace App\Domains\Ticketing\Actions;

use App\Domains\Ticketing\Models\SdTicket;
use Illuminate\Support\Carbon;

class TicketingReports
{
    /**
     * @return array<string, mixed>
     */
    public function summary(?int $deskId = null, ?Carbon $from = null, ?Carbon $to = null): array
    {
        $query = SdTicket::query()->active();
        if ($deskId) {
            $query->where('desk_id', $deskId);
        }
        if ($from) {
            $query->where('created_at', '>=', $from);
        }
        if ($to) {
            $query->where('created_at', '<=', $to);
        }

        $base = clone $query;

        return [
            'total_open' => (clone $base)->whereNull('resolved_at')->count(),
            'total_resolved' => (clone $base)->whereNotNull('resolved_at')->count(),
            'sla_response_breached' => (clone $base)->where('sla_response_breached', true)->count(),
            'sla_resolve_breached' => (clone $base)->where('sla_resolve_breached', true)->count(),
            'by_stage' => (clone $base)->selectRaw('stage_id, count(*) as c')->groupBy('stage_id')->pluck('c', 'stage_id'),
            'by_priority' => (clone $base)->selectRaw('priority_id, count(*) as c')->groupBy('priority_id')->pluck('c', 'priority_id'),
            'by_desk' => (clone $base)->selectRaw('desk_id, count(*) as c')->groupBy('desk_id')->pluck('c', 'desk_id'),
        ];
    }

    public function csv(?int $deskId = null): string
    {
        $lines = ['number,desk,summary,stage,priority,status,sla_response_breached,sla_resolve_breached,created_at'];
        foreach ($this->pdfRows($deskId) as $row) {
            $lines[] = implode(',', [
                $this->csvEscape($row['number']),
                $this->csvEscape($row['desk']),
                $this->csvEscape($row['summary']),
                $this->csvEscape($row['stage']),
                $this->csvEscape($row['priority']),
                $this->csvEscape($row['status']),
                $row['sla_response_breached'],
                $row['sla_resolve_breached'],
                $this->csvEscape($row['created_at']),
            ]);
        }

        return implode("\n", $lines)."\n";
    }

    /**
     * @return list<array{
     *   number: string,
     *   desk: string,
     *   summary: string,
     *   stage: string,
     *   priority: string,
     *   status: string,
     *   sla_response_breached: string,
     *   sla_resolve_breached: string,
     *   created_at: string
     * }>
     */
    public function pdfRows(?int $deskId = null): array
    {
        $query = SdTicket::query()->with(['desk', 'stage', 'priority', 'status'])->active()->orderByDesc('id');
        if ($deskId) {
            $query->where('desk_id', $deskId);
        }

        $rows = [];
        foreach ($query->limit(5000)->get() as $t) {
            $rows[] = [
                'number' => (string) $t->number,
                'desk' => (string) ($t->desk?->name ?? ''),
                'summary' => (string) $t->summary,
                'stage' => (string) ($t->stage?->name ?? ''),
                'priority' => (string) ($t->priority?->name ?? ''),
                'status' => (string) ($t->status?->name ?? ''),
                'sla_response_breached' => $t->sla_response_breached ? '1' : '0',
                'sla_resolve_breached' => $t->sla_resolve_breached ? '1' : '0',
                'created_at' => (string) (optional($t->created_at)?->toIso8601String() ?? ''),
            ];
        }

        return $rows;
    }

    private function csvEscape(string $value): string
    {
        if (str_contains($value, ',') || str_contains($value, '"') || str_contains($value, "\n")) {
            return '"'.str_replace('"', '""', $value).'"';
        }

        return $value;
    }
}
