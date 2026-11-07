<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{ $brand }} Training Viewing Report</title>
  <style>
    body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #0f172a; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    p.muted { color: #475569; margin: 2px 0 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e2e8f0; padding: 4px 6px; text-align: left; }
    th { background: #f1f5f9; font-weight: bold; }
    .footer { margin-top: 12px; color: #64748b; font-size: 9px; }
  </style>
</head>
<body>
  <h1>{{ $brand }} — Training Viewing Report</h1>
  <p class="muted">Tenant {{ $tenant }} · Generated {{ $generatedAt }}</p>

  <table>
    <thead>
      <tr>
        <th>Learner</th>
        <th>Email</th>
        <th>Course</th>
        <th>Lesson</th>
        <th>Lesson status</th>
        <th>Progress %</th>
        <th>Watched (s)</th>
        <th>Enrollment</th>
        <th>Quiz</th>
      </tr>
    </thead>
    <tbody>
      @forelse($rows as $row)
        <tr>
          <td>{{ $row['learner'] }}</td>
          <td>{{ $row['email'] }}</td>
          <td>{{ $row['course'] }}</td>
          <td>{{ $row['lesson'] }}</td>
          <td>{{ $row['status'] }}</td>
          <td>{{ $row['progress_pct'] }}</td>
          <td>{{ $row['watched_seconds'] }}</td>
          <td>{{ $row['enrollment_status'] }}</td>
          <td>{{ $row['quiz_score'] }}</td>
        </tr>
      @empty
        <tr>
          <td colspan="9">No enrollment rows for the current filters.</td>
        </tr>
      @endforelse
    </tbody>
  </table>

  @if($truncated)
    <p class="footer">Showing the first {{ $maxRows }} rows. Download CSV for the full export.</p>
  @endif
</body>
</html>
