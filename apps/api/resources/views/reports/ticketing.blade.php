<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{ $brand }} Ticketing Report</title>
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
  <h1>{{ $brand }} — Ticketing Report</h1>
  <p class="muted">Tenant {{ $tenant }} · Generated {{ $generatedAt }}</p>

  <h2>Summary</h2>
  <table class="summary">
    <tr>
      <td><strong>Open:</strong> {{ $summary['total_open'] }}</td>
      <td><strong>Resolved:</strong> {{ $summary['total_resolved'] }}</td>
      <td><strong>Response breach:</strong> {{ $summary['sla_response_breached'] }}</td>
      <td><strong>Resolve breach:</strong> {{ $summary['sla_resolve_breached'] }}</td>
    </tr>
  </table>

  <h2>Tickets</h2>
  <table>
    <thead>
      <tr>
        <th>Number</th>
        <th>Desk</th>
        <th>Summary</th>
        <th>Stage</th>
        <th>Priority</th>
        <th>Status</th>
        <th>SLA response</th>
        <th>SLA resolve</th>
        <th>Created</th>
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
          <td colspan="9">No active tickets.</td>
        </tr>
      @endforelse
    </tbody>
  </table>
</body>
</html>
