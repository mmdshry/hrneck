<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
  <meta charset="utf-8">
  <title>{{ __('reports.ticketing_title', ['brand' => $brand]) }}</title>
  <style>
    body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #0f172a; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    h2 { font-size: 12px; margin-top: 14px; margin-bottom: 6px; }
    p.muted { color: #475569; margin: 2px 0 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { border: 1px solid #e2e8f0; padding: 4px 6px; text-align: left; }
    th { background: #f1f5f9; font-weight: bold; }
    .summary td { border: none; padding: 2px 8px 2px 0; }
  </style>
</head>
<body>
  <h1>{{ __('reports.ticketing_heading', ['brand' => $brand]) }}</h1>
  <p class="muted">{{ __('reports.ticketing_meta', ['tenant' => $tenant, 'datetime' => $generatedAt]) }}</p>

  <h2>{{ __('reports.summary') }}</h2>
  <table class="summary">
    <tr>
      <td><strong>{{ __('reports.open') }}:</strong> {{ $summary['total_open'] }}</td>
      <td><strong>{{ __('reports.resolved') }}:</strong> {{ $summary['total_resolved'] }}</td>
      <td><strong>{{ __('reports.response_breach') }}:</strong> {{ $summary['sla_response_breached'] }}</td>
      <td><strong>{{ __('reports.resolve_breach') }}:</strong> {{ $summary['sla_resolve_breached'] }}</td>
    </tr>
  </table>

  <h2>{{ __('reports.tickets') }}</h2>
  <table>
    <thead>
      <tr>
        <th>{{ __('reports.col_number') }}</th>
        <th>{{ __('reports.col_desk') }}</th>
        <th>{{ __('reports.col_summary') }}</th>
        <th>{{ __('reports.col_stage') }}</th>
        <th>{{ __('reports.col_priority') }}</th>
        <th>{{ __('reports.col_status') }}</th>
        <th>{{ __('reports.col_sla_response') }}</th>
        <th>{{ __('reports.col_sla_resolve') }}</th>
        <th>{{ __('reports.col_created') }}</th>
      </tr>
    </thead>
    <tbody>
      @forelse($rows as $row)
        <tr>
          <td>{{ $row['number'] }}</td>
          <td>{{ $row['desk'] }}</td>
          <td>{{ $row['summary'] }}</td>
          <td>{{ $row['stage'] }}</td>
          <td>{{ $row['priority'] }}</td>
          <td>{{ $row['status'] }}</td>
          <td>{{ $row['sla_response_breached'] }}</td>
          <td>{{ $row['sla_resolve_breached'] }}</td>
          <td>{{ $row['created_at'] }}</td>
        </tr>
      @empty
        <tr>
          <td colspan="9">{{ __('reports.no_active_tickets') }}</td>
        </tr>
      @endforelse
    </tbody>
  </table>
</body>
</html>
