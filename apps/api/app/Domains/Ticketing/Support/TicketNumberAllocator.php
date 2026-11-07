<?php

namespace App\Domains\Ticketing\Support;

use App\Domains\Ticketing\Models\SdDesk;
use Illuminate\Support\Facades\DB;

class TicketNumberAllocator
{
    public function next(SdDesk $desk): string
    {
        return DB::transaction(function () use ($desk): string {
            /** @var SdDesk $locked */
            $locked = SdDesk::query()->whereKey($desk->id)->lockForUpdate()->firstOrFail();
            $n = (int) $locked->next_number;
            $locked->next_number = $n + 1;
            $locked->save();

            return sprintf('%s-%06d', $locked->number_prefix, $n);
        });
    }
}
