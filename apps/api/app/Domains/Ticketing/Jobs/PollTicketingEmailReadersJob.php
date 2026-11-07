<?php

namespace App\Domains\Ticketing\Jobs;

use App\Domains\Ticketing\Actions\ProcessInboundEmail;
use App\Domains\Ticketing\Models\SdEmailReader;
use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Stancl\Tenancy\Facades\Tenancy;

/**
 * IMAP polling stub: in production connects via imap_* or webklex.
 * Locally/tests feed messages through ProcessInboundEmail directly.
 * When IMAP extension is available and host is reachable, attempts a NOOP login check.
 */
class PollTicketingEmailReadersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(ProcessInboundEmail $processor): void
    {
        foreach (Tenant::query()->cursor() as $tenant) {
            Tenancy::initialize($tenant);
            foreach (SdEmailReader::query()->where('is_active', true)->get() as $reader) {
                try {
                    if (function_exists('imap_open')) {
                        $mailbox = sprintf('{%s:%d/imap/%s}%s', $reader->host, $reader->port, $reader->encryption ?: 'ssl', $reader->mailbox);
                        $stream = @imap_open($mailbox, $reader->username, $reader->password, OP_HALFOPEN);
                        if ($stream === false) {
                            $reader->fail_count = (int) $reader->fail_count + 1;
                            if ($reader->fail_count >= 120) {
                                $reader->is_active = false;
                            }
                            $reader->save();
                        } else {
                            // Pull unseen subjects as tickets when real mailbox is connected.
                            $emails = imap_search($stream, 'UNSEEN') ?: [];
                            foreach (array_slice($emails, 0, 20) as $num) {
                                $header = imap_headerinfo($stream, (int) $num);
                                $body = imap_fetchbody($stream, (int) $num, '1') ?: '';
                                $from = '';
                                if (! empty($header->from[0])) {
                                    $from = strtolower(($header->from[0]->mailbox ?? '').'@'.($header->from[0]->host ?? ''));
                                }
                                $processor->handle($reader, [
                                    'from' => $from,
                                    'subject' => $header->subject ?? 'N/A',
                                    'body' => $body,
                                    'message_id' => $header->message_id ?? null,
                                ]);
                                imap_setflag_full($stream, (string) $num, '\\Seen');
                            }
                            imap_close($stream);
                            $reader->fail_count = 0;
                            $reader->last_polled_at = Carbon::now();
                            $reader->save();
                        }
                    } else {
                        $reader->last_polled_at = Carbon::now();
                        $reader->save();
                    }
                } catch (\Throwable) {
                    $reader->fail_count = (int) $reader->fail_count + 1;
                    if ($reader->fail_count >= 120) {
                        $reader->is_active = false;
                    }
                    $reader->save();
                }
            }
            Tenancy::end();
        }
    }
}
