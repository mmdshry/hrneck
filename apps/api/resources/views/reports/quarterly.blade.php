@php
    $wordmarkFile = resource_path('images/hrneck-wordmark.png');
    $wordmarkSrc = is_file($wordmarkFile)
        ? 'data:image/png;base64,'.base64_encode((string) file_get_contents($wordmarkFile))
        : null;
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
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
  <meta charset="utf-8">
  <title>{{ $report['title'] }}</title>
  <style>
    @page { margin: 72px 28px 52px 28px; }
    html, body { background: #F8FAFC; }
    body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #0F172A; }
    h1 { font-size: 22px; margin: 8px 0 4px; color: #083A6D; font-weight: normal; }
    h2 { font-size: 14px; margin: 0; color: #083A6D; font-weight: normal; }
    h3 { font-size: 11px; margin: 0 0 8px; color: #334155; font-weight: normal; }
    p { margin: 0 0 6px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { vertical-align: middle; }
    .header {
      position: fixed;
      top: -56px;
      left: 0;
      right: 0;
      height: 44px;
      background: #F8FAFC;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 6px;
    }
    .header td { border: none; }
    .header-title { text-align: right; color: #334155; font-size: 12px; }
    .footer {
      position: fixed;
      bottom: -38px;
      left: 0;
      right: 0;
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      color: #64748B;
      font-size: 9px;
      padding-top: 8px;
      line-height: 1.35;
    }
    .page { page-break-before: always; }
    .cover { padding-top: 28px; }
    .cover-card { background: #FFFFFF; border: 1px solid #E2E8F0; }
    .cover-card td { border: none; background: #FFFFFF; padding: 28px 32px; }
    .spark { height: 3px; background: #F76B13; width: 48px; margin: 16px 0 0; }
    .muted { color: #64748B; font-size: 9px; }
    .section-head td { border: none; padding-bottom: 10px; }
    .cards td {
      width: 25%;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      padding: 14px 16px;
    }
    .big { font-size: 20px; color: #0F172A; line-height: 1; margin: 4px 0 2px; }
    .status-label { font-size: 10px; color: #334155; margin: 4px 0 0; }
    .count-line { font-size: 8px; color: #64748B; margin: 0 0 4px; }
    .delta { font-size: 9px; color: #083A6D; margin-bottom: 6px; }
    .legend { margin-top: 10px; font-size: 9px; color: #64748B; line-height: 1.4; }
    .month-chip { border: none; font-size: 7px; color: #64748B; padding-right: 6px; }
    .strip td { background: #FFFFFF; border: 1px solid #E2E8F0; padding: 8px 10px; width: 16.6%; }
    .strip strong { color: #0F172A; font-size: 13px; font-weight: normal; }
    .data { margin-top: 8px; }
    .data { background: #FFFFFF; }
    .data th {
      background: #FFFFFF;
      color: #083A6D;
      border: none;
      border-bottom: 1px solid #083A6D;
      padding: 6px 4px;
      font-size: 8px;
      font-weight: normal;
      text-align: left;
    }
    .data td {
      background: #FFFFFF;
      border: none;
      border-bottom: 1px solid #E2E8F0;
      padding: 5px 4px;
      text-align: left;
      vertical-align: top;
    }
    .toc td { border: none; border-bottom: 1px solid #F1F5F9; padding: 9px 4px; }
    .toc-num { width: 36px; color: #F76B13; }
    .empty { margin-top: 16px; color: #64748B; }
  </style>
</head>
<body>
  <div class="header">
    <table cellspacing="0" cellpadding="0">
      <tr>
        <td style="width: 160px; border: none;">
          @if($wordmarkSrc)
            <img src="{{ $wordmarkSrc }}" alt="HRneck" width="148" height="35">
          @endif
        </td>
        <td class="header-title">{{ $report['title'] }}</td>
      </tr>
    </table>
  </div>

  <div class="footer">
    {{ __('reports.prepared_for', ['brand' => $report['brand'], 'organization' => $report['organization']]) }}
    {{ __('reports.confidential') }}
    {{ __('reports.generated_at', ['datetime' => $report['generated_at']]) }}
  </div>

  <div class="cover">
    <table class="cover-card" cellspacing="0" cellpadding="0">
      <tr>
        <td style="width: 46%;">
          @if($wordmarkSrc)
            <img src="{{ $wordmarkSrc }}" alt="HRneck" width="300" height="70">
          @endif
          <div class="spark"></div>
        </td>
        <td>
          <h1>{{ $report['title'] }}</h1>
          <p>{{ $report['period_label'] }}</p>
          <p class="muted">{{ __('reports.prepared_for', ['brand' => $report['brand'], 'organization' => $report['organization']]) }}</p>
        </td>
      </tr>
    </table>
  </div>

  <div class="page">
    <table class="section-head" cellspacing="0" cellpadding="0">
      <tr>
        <td style="width: 22px; border: none;">@include('reports.partials.icon', ['name' => 'summary', 'size' => 16])</td>
        <td style="padding-left: 8px; border: none;"><h2>{{ __('reports.contents') }}</h2></td>
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
        <td style="width: 22px; border: none;">@include('reports.partials.icon', ['name' => 'summary', 'size' => 16])</td>
        <td style="padding-left: 8px; border: none;">
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
          <td>
            @include('reports.partials.icon', ['name' => $key, 'size' => 18, 'color' => $color])
            <div class="status-label">{{ $status['label'] }}</div>
            <div class="big">{{ $status['current'] }}%</div>
            <div class="count-line">{{ __('reports.of_assigned', ['count' => $count, 'total' => $assignedTotal]) }}</div>
            <div class="delta">{{ $status['delta_label'] }} {{ __('reports.vs_prior_period') }}</div>
            @include('reports.partials.bar', ['percent' => $status['current'], 'color' => $color])
            @if($report['period_type'] === 'quarterly')
              <table cellspacing="0" cellpadding="0" style="margin-top: 4px;">
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
        <td style="width: 22px; border: none;">@include('reports.partials.icon', ['name' => 'training', 'size' => 16])</td>
        <td style="padding-left: 8px; border: none;">
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
        <td style="width: 22px; border: none;">@include('reports.partials.icon', ['name' => 'risk', 'size' => 16])</td>
        <td style="padding-left: 8px; border: none;">
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
        <td style="width: 22px; border: none;">@include('reports.partials.icon', ['name' => 'remedial', 'size' => 16])</td>
        <td style="padding-left: 8px; border: none;">
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
