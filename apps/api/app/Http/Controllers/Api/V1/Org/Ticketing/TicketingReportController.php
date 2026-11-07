<?php

namespace App\Http\Controllers\Api\V1\Org\Ticketing;

use App\Domains\Ticketing\Actions\TicketingReports;
use App\Http\Controllers\Controller;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TicketingReportController extends Controller
{
    public function summary(Request $request, TicketingReports $reports): JsonResponse
    {
        $deskId = $request->filled('desk_id') ? (int) $request->input('desk_id') : null;
        $from = $request->filled('from') ? Carbon::parse((string) $request->input('from')) : null;
        $to = $request->filled('to') ? Carbon::parse((string) $request->input('to')) : null;

        return response()->json(['data' => $reports->summary($deskId, $from, $to)]);
    }

    public function csv(Request $request, TicketingReports $reports): StreamedResponse
    {
        $deskId = $request->filled('desk_id') ? (int) $request->input('desk_id') : null;
        $csv = $reports->csv($deskId);

        return response()->streamDownload(function () use ($csv): void {
            echo $csv;
        }, 'ticketing-report.csv', ['Content-Type' => 'text/csv']);
    }

    public function pdf(Request $request, TicketingReports $reports): StreamedResponse
    {
        $deskId = $request->filled('desk_id') ? (int) $request->input('desk_id') : null;
        $summary = $reports->summary($deskId);
        $rows = $reports->pdfRows($deskId);

        $html = view('reports.ticketing', [
            'summary' => $summary,
            'rows' => $rows,
            'tenant' => tenant('id'),
            'brand' => config('brand.name'),
            'generatedAt' => now()->toIso8601String(),
        ])->render();

        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'landscape');

        return response()->streamDownload(function () use ($pdf): void {
            echo $pdf->output();
        }, 'ticketing-report.pdf', ['Content-Type' => 'application/pdf']);
    }
}
