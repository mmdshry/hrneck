@php
    $headerTitle = __('reports.training_viewing_heading', ['brand' => $brand]);
    $footerLines = [
        __('reports.ticketing_meta', ['tenant' => $tenant, 'datetime' => $generatedAt]),
        __('reports.confidential'),
    ];
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
  <meta charset="utf-8">
  <title>{{ __('reports.training_viewing_title', ['brand' => $brand]) }}</title>
  @include('reports.partials.styles')
</head>
<body>
  @include('reports.partials.chrome', ['headerTitle' => $headerTitle, 'footerLines' => $footerLines])

  <h1>{{ $headerTitle }}</h1>
  <p class="muted">{{ __('reports.ticketing_meta', ['tenant' => $tenant, 'datetime' => $generatedAt]) }}</p>

  <table class="data" style="margin-top: 12px;">
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
          <td colspan="9" class="empty">{{ __('reports.no_enrollment_rows') }}</td>
        </tr>
      @endforelse
    </tbody>
  </table>

  @if($truncated)
    <p class="note">{{ __('reports.truncated_footer', ['max' => $maxRows]) }}</p>
  @endif
</body>
</html>
