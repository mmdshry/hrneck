@php
    $tones = [
        'no_action' => '#334155',
        'incomplete' => '#B45309',
        'failed' => '#DC2626',
        'passed' => '#047857',
    ];
    $changeLabel = $report['period_type'] === 'quarterly'
        ? __('reports.quarterly_changes')
        : __('reports.monthly_changes');
    $currentLabels = $report['training']['current_month_labels'];
    $previousLabels = $report['training']['previous_month_labels'];
    $periodCompare = implode(' / ', $currentLabels).' vs '.implode(' / ', $previousLabels);
    $assignedTotal = (int) $report['training']['assigned'];
    $statusShort = [
        'no_action' => __('reports.status_no_action'),
        'incomplete' => __('reports.status_incomplete'),
        'failed' => __('reports.status_failed'),
        'passed' => __('reports.status_passed'),
    ];
    $preparedFor = __('reports.prepared_for', ['brand' => $report['brand'], 'organization' => $report['organization']]);
    $generatedAt = __('reports.generated_at', ['datetime' => $report['generated_at']]);
    $wordmarkSrc = \App\Domains\AnalyticsReporting\Support\ReportPdf::wordmarkDataUri();
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
  <meta charset="utf-8">
  <title>{{ $report['title'] }}</title>
  @include('reports.partials.styles')
</head>
<body>
  @include('reports.partials.chrome', [
      'headerTitle' => $report['title'],
      'footerLines' => [$preparedFor, __('reports.confidential').' '.$generatedAt],
  ])

  <div class="cover">
    <table class="cover-card" cellspacing="0" cellpadding="0">
      <tr>
        <td class="cover-brand">
          @if($wordmarkSrc)
            <img src="{{ $wordmarkSrc }}" alt="HRneck" width="300" height="70">
          @endif
          <div class="spark"></div>
        </td>
        <td>
          <h1>{{ $report['title'] }}</h1>
          <p>{{ $report['period_label'] }}</p>
          <p class="muted">{{ $preparedFor }}</p>
          <p class="muted">{{ $generatedAt }}</p>
        </td>
      </tr>
    </table>
  </div>

  <div class="page">
    <table class="section-head" cellspacing="0" cellpadding="0">
      <tr>
        <td class="section-icon">@include('reports.partials.icon', ['name' => 'summary', 'size' => 16])</td>
        <td class="section-title"><h2>{{ __('reports.contents') }}</h2></td>
      </tr>
    </table>
    <table class="toc" cellspacing="0" cellpadding="0">
      <tbody>
        @foreach($report['contents'] as $item)
          <tr>
            <td class="toc-num">{{ $item['number'] }}</td>
            <td>{{ $item['title'] }}</td>
          </tr>
        @endforeach
      </tbody>
    </table>
  </div>

  <div class="page">
    <table class="section-head" cellspacing="0" cellpadding="0">
      <tr>
        <td class="section-icon">@include('reports.partials.icon', ['name' => 'summary', 'size' => 16])</td>
        <td class="section-title">
          <h2>{{ __('reports.summary_section') }}</h2>
          <div class="muted">{{ $report['period_label'] }}</div>
        </td>
      </tr>
    </table>
    <h3>{{ __('reports.training_awareness') }}</h3>
    <p>
      {{ __('reports.campaigns') }} <strong>{{ $report['training']['campaigns'] }}</strong>
      &nbsp;&nbsp; {{ __('reports.assigned_trainings') }} <strong>{{ $report['training']['assigned'] }}</strong>
    </p>
    <p class="muted">{{ __('reports.change_share_intro', ['label' => $changeLabel]) }}</p>
    <table class="cards" cellspacing="8" cellpadding="0">
      <tr>
        @foreach($report['training']['status_order'] as $key)
          @php
            $status = $report['training']['statuses'][$key];
            $color = $tones[$key];
            $count = (int) ($report['training']['details']['counts'][$key] ?? 0);
          @endphp
          <td style="border-top: 3px solid {{ $color }};">
            @include('reports.partials.icon', ['name' => $key, 'size' => 18, 'color' => $color])
            <div class="status-label">{{ $status['label'] }}</div>
            <div class="big">{{ $status['current'] }}%</div>
            <div class="count-line">{{ __('reports.of_assigned', ['count' => $count, 'total' => $assignedTotal]) }}</div>
            <div class="delta">{{ $status['delta_label'] }} {{ __('reports.vs_prior_period') }}</div>
            @include('reports.partials.bar', ['percent' => $status['current'], 'color' => $color])
            @if($report['period_type'] === 'quarterly')
              <table cellspacing="0" cellpadding="0" style="margin-top: 6px;">
                <tr>
                  @foreach($status['current_months'] as $index => $pct)
                    <td class="month-chip">{{ $currentLabels[$index] ?? '' }} {{ $pct }}%</td>
                  @endforeach
                </tr>
              </table>
            @endif
          </td>
        @endforeach
      </tr>
    </table>
    <p class="legend">
      {{ __('reports.bars_legend_quarterly', ['compare' => $periodCompare]) }}
    </p>
  </div>

  <div class="page">
    <table class="section-head" cellspacing="0" cellpadding="0">
      <tr>
        <td class="section-icon">@include('reports.partials.icon', ['name' => 'training', 'size' => 16])</td>
        <td class="section-title">
          <h2>{{ __('reports.training_details_section') }}</h2>
          <div class="muted">{{ $report['period_label'] }}</div>
        </td>
      </tr>
    </table>
    <table class="strip" cellspacing="8" cellpadding="0">
      <tr>
        <td><strong>{{ $report['training']['details']['emails_sent'] }}</strong><br><span class="muted">{{ __('reports.emails_sent') }}</span></td>
        <td><strong>{{ $report['training']['details']['courses'] }}</strong><br><span class="muted">{{ __('reports.courses') }}</span></td>
        @foreach($statusShort as $key => $short)
          <td>
            @include('reports.partials.icon', ['name' => $key, 'size' => 12, 'color' => $tones[$key]])
            <strong>{{ $report['training']['details']['counts'][$key] }} ({{ $report['training']['details']['percents'][$key] }}%)</strong>
            <br><span class="muted">{{ $short }}</span>
          </td>
        @endforeach
      </tr>
    </table>
    @if($report['training']['details']['rows'] === [])
      <div class="empty">{{ __('reports.no_results') }}</div>
    @else
      <p class="muted" style="margin-top: 8px;">{{ __('reports.outcome_columns_campaign') }}</p>
      <table class="data">
        <thead>
          <tr>
            <th>{{ __('reports.col_campaign_course') }}</th>
            <th>{{ __('reports.col_group') }}</th>
            <th>{{ __('reports.col_assigned') }}</th>
            <th>{{ __('reports.status_no_action') }}</th>
            <th>{{ __('reports.status_incomplete') }}</th>
            <th>{{ __('reports.status_failed') }}</th>
            <th>{{ __('reports.status_passed') }}</th>
          </tr>
        </thead>
        <tbody>
          @foreach($report['training']['details']['rows'] as $row)
            <tr>
              <td>{{ $row['campaign'] }}<br><span class="muted">{{ $row['course'] }}</span></td>
              <td>{{ $row['group'] }}</td>
              <td>{{ $row['assigned'] }}</td>
              <td>{{ $row['no_action'] }} ({{ $row['no_action_pct'] }}%)</td>
              <td>{{ $row['incomplete'] }} ({{ $row['incomplete_pct'] }}%)</td>
              <td>{{ $row['failed'] }} ({{ $row['failed_pct'] }}%)</td>
              <td>{{ $row['passed'] }} ({{ $row['passed_pct'] }}%)</td>
            </tr>
          @endforeach
        </tbody>
      </table>
    @endif
  </div>

  <div class="page">
    <table class="section-head" cellspacing="0" cellpadding="0">
      <tr>
        <td class="section-icon">@include('reports.partials.icon', ['name' => 'risk', 'size' => 16])</td>
        <td class="section-title">
          <h2>03. {{ $report['training']['risk']['title'] }}</h2>
          <div class="muted">{{ $report['period_label'] }}</div>
        </td>
      </tr>
    </table>
    @if($report['training']['risk']['truncated'])
      <p>{{ __('reports.risk_max_courses') }}</p>
    @endif
    @if($report['training']['risk']['mode'] === 'users')
      <p class="muted">{{ __('reports.risk_users_intro') }}</p>
      <p class="muted">{{ __('reports.risk_users_row_hint') }}</p>
      @if($report['training']['risk']['users'] === [])
        <div class="empty">{{ __('reports.no_results') }}</div>
      @else
        <table class="data">
          <thead>
            <tr>
              <th>{{ __('reports.col_status') }}</th>
              <th>{{ __('reports.col_name') }}</th>
              <th>{{ __('reports.col_training_course') }}</th>
              <th>{{ __('reports.col_group') }}</th>
              <th>{{ __('reports.col_email') }}</th>
              <th>{{ __('reports.col_date') }}</th>
            </tr>
          </thead>
          <tbody>
            @foreach($report['training']['risk']['users'] as $user)
              <tr>
                <td>
                  @include('reports.partials.icon', ['name' => $user['status'], 'size' => 12, 'color' => $tones[$user['status']] ?? '#334155'])
                  {{ $user['status_label'] }}
                </td>
                <td>{{ $user['name'] }}</td>
                <td>{{ $user['course'] }}</td>
                <td>{{ $user['group'] }}</td>
                <td>{{ $user['email'] }}</td>
                <td>{{ $user['date'] }}</td>
              </tr>
            @endforeach
          </tbody>
        </table>
      @endif
    @else
      <p class="muted">{{ __('reports.risk_courses_intro') }}</p>
      @if($report['training']['risk']['courses'] === [])
        <div class="empty">{{ __('reports.no_results') }}</div>
      @else
        <table class="data">
          <thead>
            <tr>
              <th>{{ __('reports.col_training_course') }}</th>
              <th>{{ __('reports.col_groups_targeted') }}</th>
              <th>{{ __('reports.col_users_targeted') }}</th>
              <th>{{ __('reports.col_incomplete_or_no_action') }}</th>
              <th>{{ __('reports.status_failed') }}</th>
              <th>{{ __('reports.col_completion_rate') }}</th>
            </tr>
          </thead>
          <tbody>
            @foreach($report['training']['risk']['courses'] as $course)
              <tr>
                <td>{{ $course['course'] }}</td>
                <td>{{ $course['groups_targeted'] }}</td>
                <td>{{ $course['users_targeted'] }}</td>
                <td>{{ $course['incomplete_or_no_action'] }}</td>
                <td>{{ $course['failed'] }}</td>
                <td>{{ $course['completion_rate'] }}%</td>
              </tr>
            @endforeach
          </tbody>
        </table>
      @endif
    @endif
  </div>

  <div class="page">
    <table class="section-head" cellspacing="0" cellpadding="0">
      <tr>
        <td class="section-icon">@include('reports.partials.icon', ['name' => 'remedial', 'size' => 16])</td>
        <td class="section-title">
          <h2>{{ __('reports.remedial_section') }}</h2>
          <div class="muted">{{ $report['period_label'] }}</div>
        </td>
      </tr>
    </table>
    <p class="muted">{{ __('reports.remedial_intro') }}</p>
    @if($report['remedial']['empty'])
      <div class="empty">{{ __('reports.no_results') }}</div>
    @else
      <p>{{ __('reports.total_high_risk_users') }} <strong>{{ $report['remedial']['high_risk_users'] }}</strong></p>
      <table class="strip" cellspacing="8" cellpadding="0">
        <tr>
          @foreach($statusShort as $key => $short)
            <td>
              @include('reports.partials.icon', ['name' => $key, 'size' => 12, 'color' => $tones[$key]])
              <strong>{{ $report['remedial']['counts'][$key] }} ({{ $report['remedial']['percents'][$key] }}%)</strong>
              <br><span class="muted">{{ $short }}</span>
            </td>
          @endforeach
        </tr>
      </table>
      <p class="muted" style="margin-top: 8px;">{{ __('reports.outcome_columns_remedial') }}</p>
      <table class="data">
        <thead>
          <tr>
            <th>{{ __('reports.col_course') }}</th>
            <th>{{ __('reports.col_campaign') }}</th>
            <th>{{ __('reports.col_high_risk_enrollments') }}</th>
            <th>{{ __('reports.status_no_action') }}</th>
            <th>{{ __('reports.status_incomplete') }}</th>
            <th>{{ __('reports.status_failed') }}</th>
            <th>{{ __('reports.status_passed') }}</th>
          </tr>
        </thead>
        <tbody>
          @foreach($report['remedial']['rows'] as $row)
            <tr>
              <td>{{ $row['course'] }}</td>
              <td>{{ $row['campaign'] }}</td>
              <td>{{ $row['enrollments'] }}</td>
              <td>{{ $row['no_action'] }} ({{ $row['no_action_pct'] }}%)</td>
              <td>{{ $row['incomplete'] }} ({{ $row['incomplete_pct'] }}%)</td>
              <td>{{ $row['failed'] }} ({{ $row['failed_pct'] }}%)</td>
              <td>{{ $row['passed'] }} ({{ $row['passed_pct'] }}%)</td>
            </tr>
          @endforeach
        </tbody>
      </table>
    @endif
  </div>
</body>
</html>
