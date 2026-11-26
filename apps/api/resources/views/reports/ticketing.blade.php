@php
    $headerTitle = __('reports.ticketing_heading', ['brand' => $brand]);
    $footerLines = [
        __('reports.ticketing_meta', ['tenant' => $tenant, 'datetime' => $generatedAt]),
        __('reports.confidential'),
    ];
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
  <meta charset="utf-8">
  <title>{{ __('reports.ticketing_title', ['brand' => $brand]) }}</title>
  @include('reports.partials.styles')
</head>
<body>
  @include('reports.partials.chrome', ['headerTitle' => $headerTitle, 'footerLines' => $footerLines])

  <h1>{{ $headerTitle }}</h1>
  <p class="muted">{{ __('reports.ticketing_meta', ['tenant' => $tenant, 'datetime' => $generatedAt]) }}</p>

  <table class="section-head" cellspacing="0" cellpadding="0">
    <tr>
      <td class="section-icon">@include('reports.partials.icon', ['name' => 'summary', 'size' => 16])</td>
      <td class="section-title"><h2>{{ __('reports.summary') }}</h2></td>
    </tr>
  </table>
  <table class="strip" cellspacing="8" cellpadding="0">
    <tr>
      <td><strong>{{ $summary['total_open'] }}</strong><br><span class="muted">{{ __('reports.open') }}</span></td>
      <td><strong>{{ $summary['total_resolved'] }}</strong><br><span class="muted">{{ __('reports.resolved') }}</span></td>
      <td><strong>{{ $summary['sla_response_breached'] }}</strong><br><span class="muted">{{ __('reports.response_breach') }}</span></td>
      <td><strong>{{ $summary['sla_resolve_breached'] }}</strong><br><span class="muted">{{ __('reports.resolve_breach') }}</span></td>
    </tr>
  </table>

  <table class="section-head" cellspacing="0" cellpadding="0" style="margin-top: 16px;">
    <tr>
      <td class="section-icon">@include('reports.partials.icon', ['name' => 'training', 'size' => 16])</td>
      <td class="section-title"><h2>{{ __('reports.tickets') }}</h2></td>
    </tr>
  </table>
  <table class="data">
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
          <td colspan="9" class="empty">{{ __('reports.no_active_tickets') }}</td>
        </tr>
      @endforelse
    </tbody>
  </table>
  @if($truncated)
    <p class="note">{{ __('reports.row_cap_reached', ['max' => $maxRows]) }}</p>
  @endif
</body>
</html>
