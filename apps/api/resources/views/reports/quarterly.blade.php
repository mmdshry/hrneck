<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{ $m['brand'] }} Quarterly Business Report</title>
  <style>
    body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #0f172a; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 14px; margin-top: 22px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px; text-align: left; }
    th { background: #f1f5f9; }
    .muted { color: #475569; }
    .grid { width: 100%; }
    .grid td { border: none; vertical-align: top; width: 50%; }
  </style>
</head>
<body>
  <h1>{{ $m['brand'] }} — Quarterly Business Report</h1>
  <p class="muted">Period {{ $m['period_key'] }} · Tenant {{ $m['tenant'] }} · {{ $m['timezone'] }} · Generated {{ $m['generated_at'] }}</p>
  <p class="muted">Confidential — for the named organization only.</p>

  <h2>01 Summary</h2>
  <table class="grid">
    <tr>
      <td>
        @if($m['training'])
          <strong>Training &amp; Awareness</strong><br>
          Campaigns: {{ $m['training']['campaigns'] }} · Assigned: {{ $m['training']['assigned'] }}<br>
          No Action: {{ $m['training']['no_action_pct'] }}%<br>
          Incomplete: {{ $m['training']['incomplete_pct'] }}%<br>
          Failed: {{ $m['training']['failed_pct'] }}%<br>
          Passed: {{ $m['training']['passed_pct'] }}%
        @endif
      </td>
    </tr>
  </table>

  @if($m['training'])
    <h2>02 Training &amp; Awareness Details</h2>
    <p>Assigned trainings: {{ $m['training']['assigned'] }} · Completed rate: {{ $m['training']['completed_pct'] }}%</p>

    <h2>03 Training Courses by Risk Level</h2>
    <table>
      <thead>
        <tr><th>Course</th><th>Users</th><th>Incomplete</th><th>Failed</th><th>Completion</th></tr>
      </thead>
      <tbody>
        @foreach($m['training']['courses_by_risk'] as $row)
          <tr>
            <td>{{ $row['course'] }}</td>
            <td>{{ $row['users'] }}</td>
            <td>{{ $row['incomplete'] }}</td>
            <td>{{ $row['failed'] }}</td>
            <td>{{ $row['completion_rate'] }}%</td>
          </tr>
        @endforeach
      </tbody>
    </table>
  @endif
</body>
</html>
