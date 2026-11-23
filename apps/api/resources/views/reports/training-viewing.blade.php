<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
  <meta charset="utf-8">
  <title>{{ __('reports.training_viewing_title', ['brand' => $brand]) }}</title>
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
  <h1>{{ __('reports.training_viewing_heading', ['brand' => $brand]) }}</h1>
  <p class="muted">{{ __('reports.ticketing_meta', ['tenant' => $tenant, 'datetime' => $generatedAt]) }}</p>

  <table>
    <thead>
      <tr>
        <th>{{ __('reports.col_learner') }}</th>
        <th>{{ __('reports.col_email') }}</th>
        <th>{{ __('reports.col_course') }}</th>
        <th>{{ __('reports.col_lesson') }}</th>
        <th>{{ __('reports.col_lesson_status') }}</th>
        <th>{{ __('reports.col_progress_pct') }}</th>
        <th>{{ __('reports.col_watched_seconds') }}</th>
        <th>{{ __('reports.col_enrollment') }}</th>
        <th>{{ __('reports.col_quiz') }}</th>
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
          <td colspan="9">{{ __('reports.no_enrollment_rows') }}</td>
        </tr>
      @endforelse
    </tbody>
  </table>

  @if($truncated)
    <p class="footer">{{ __('reports.truncated_footer', ['max' => $maxRows]) }}</p>
  @endif
</body>
</html>
