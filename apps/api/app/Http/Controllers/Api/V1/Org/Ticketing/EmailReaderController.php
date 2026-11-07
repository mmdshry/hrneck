<?php

namespace App\Http\Controllers\Api\V1\Org\Ticketing;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Ticketing\Actions\ProcessInboundEmail;
use App\Domains\Ticketing\Models\SdEmailReader;
use App\Domains\Ticketing\Support\TicketingPayload;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmailReaderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $paginator = SdEmailReader::query()->with('desk')->orderBy('name')->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (SdEmailReader $r) => [
                'id' => $r->id,
                'name' => $r->name,
                'desk_id' => $r->desk_id,
                'host' => $r->host,
                'port' => $r->port,
                'encryption' => $r->encryption,
                'username' => $r->username,
                'mailbox' => $r->mailbox,
                'is_active' => $r->is_active,
                'defaults' => $r->defaults,
                'blacklist' => $r->blacklist,
                'last_polled_at' => optional($r->last_polled_at)?->toIso8601String(),
                'fail_count' => $r->fail_count,
            ])->values(),
            'meta' => ApiPagination::meta($paginator),
        ]);
    }

    public function store(Request $request, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'desk_id' => ['required', 'integer'],
            'host' => ['required', 'string', 'max:255'],
            'port' => ['nullable', 'integer'],
            'encryption' => ['nullable', 'string', 'max:16'],
            'username' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
            'mailbox' => ['nullable', 'string', 'max:120'],
            'is_active' => ['sometimes', 'boolean'],
            'defaults' => ['nullable', 'array'],
            'blacklist' => ['nullable', 'array'],
        ]);

        $reader = SdEmailReader::query()->create($data);

        $audit->handle('ticketing', 'email_reader_created', 'Email reader created', $reader, [
            'name' => $reader->name,
            'desk_id' => $reader->desk_id,
        ]);

        return response()->json(['data' => ['id' => $reader->id, 'name' => $reader->name]], 201);
    }

    public function update(Request $request, int $reader, LogOrgActivity $audit): JsonResponse
    {
        $model = SdEmailReader::query()->findOrFail($reader);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'desk_id' => ['sometimes', 'integer'],
            'host' => ['sometimes', 'string', 'max:255'],
            'port' => ['sometimes', 'integer'],
            'encryption' => ['sometimes', 'string', 'max:16'],
            'username' => ['sometimes', 'string', 'max:255'],
            'password' => ['sometimes', 'string'],
            'mailbox' => ['sometimes', 'string', 'max:120'],
            'is_active' => ['sometimes', 'boolean'],
            'defaults' => ['sometimes', 'nullable', 'array'],
            'blacklist' => ['sometimes', 'nullable', 'array'],
        ]);
        $model->fill($data)->save();

        $audit->handle('ticketing', 'email_reader_updated', 'Email reader updated', $model, [
            'name' => $model->name,
            'is_active' => $model->is_active,
        ]);

        return response()->json(['data' => ['id' => $model->id, 'name' => $model->name, 'is_active' => $model->is_active]]);
    }

    public function destroy(int $reader, LogOrgActivity $audit): JsonResponse
    {
        $model = SdEmailReader::query()->findOrFail($reader);
        $snapshot = ['id' => $model->id, 'name' => $model->name];
        $model->delete();

        $audit->handle('ticketing', 'email_reader_deleted', 'Email reader deleted', null, [
            'reader' => $snapshot,
        ]);

        return response()->json(['message' => 'Deleted']);
    }

    public function ingest(Request $request, int $reader, ProcessInboundEmail $processor): JsonResponse
    {
        $model = SdEmailReader::query()->findOrFail($reader);
        $data = $request->validate([
            'from' => ['required', 'email'],
            'subject' => ['nullable', 'string'],
            'body' => ['nullable', 'string'],
            'message_id' => ['nullable', 'string'],
        ]);

        $ticket = $processor->handle($model, $data);

        return response()->json(['data' => TicketingPayload::ticket($ticket, detailed: true)], 201);
    }
}
