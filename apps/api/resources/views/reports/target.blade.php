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
    $isSingle = $report['mode'] === 'single';
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
    .count-line { font-size: 8px; color: #64748B; margin: 0 0 6px; }
    .legend { margin-top: 10px; font-size: 9px; color: #64748B; line-height: 1.4; }
    .profile { background: #FFFFFF; border: 1px solid #E2E8F0; }
    .profile td { border: none; padding: 10px 12px; width: 33%; }
    .data { margin-top: 8px; background: #FFFFFF; }
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
          @if($isSingle && $report['employee'])
            <p>{{ $report['employee']['name'] }} &lt;{{ $report['employee']['email'] }}&gt;</p>
          @endif
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

  @if($isSingle)
    <div class="page">
      <table class="section-head" cellspacing="0" cellpadding="0">
        <tr>
          <td style="width: 22px; border: none;">@include('reports.partials.icon', ['name' => 'summary', 'size' => 16])</td>
          <td style="padding-left: 8px; border: none;"><h2>{{ __('reports.employee_section') }}</h2></td>
        </tr>
      </table>
      @if($report['employee'])
        <table class="profile" cellspacing="0" cellpadding="0">
          <tr>
            <td><strong>{{ __('reports.col_name') }}</strong><br>{{ $report['employee']['name'] }}</td>
            <td><strong>{{ __('reports.col_email') }}</strong><br>{{ $report['employee']['email'] }}</td>
            <td><strong>{{ __('reports.col_group') }}</strong><br>{{ $report['employee']['group'] !== '' ? $report['employee']['group'] : __('reports.em_dash') }}</td>
          </tr>
          <tr>
            <td><strong>{{ __('reports.col_department') }}</strong><br>{{ $report['employee']['department'] !== '' ? $report['employee']['department'] : __('reports.em_dash') }}</td>
            <td><strong>{{ __('reports.col_job_title') }}</strong><br>{{ $report['employee']['job_title'] !== '' ? $report['employee']['job_title'] : __('reports.em_dash') }}</td>
            <td><strong>{{ __('reports.col_employee_number') }}</strong><br>{{ $report['employee']['employee_number'] !== '' ? $report['employee']['employee_number'] : __('reports.em_dash') }}</td>
          </tr>
        </table>
      @endif
    </div>
  @endif

  <div class="page">
    <table class="section-head" cellspacing="0" cellpadding="0">
      <tr>
        <td style="width: 22px; border: none;">@include('reports.partials.icon', ['name' => 'summary', 'size' => 16])</td>
        <td style="padding-left: 8px; border: none;">
          <h2>{{ __('reports.summary_section_alt', ['number' => $isSingle ? '02' : '01']) }}</h2>
          <div class="muted">{{ $report['period_label'] }}</div>
        </td>
      </tr>
    </table>
    <p>{{ __('reports.assigned_trainings_count') }} <strong>{{ $report['summary']['assigned'] }}</strong></p>
    <p class="muted">{{ $isSingle ? __('reports.share_employee') : __('reports.share_roster') }}</p>
    <table class="cards" cellspacing="8" cellpadding="0">
      <tr>
        @foreach($report['status_order'] as $key)
          @php $color = $tones[$key]; @endphp
          <td>
            @include('reports.partials.icon', ['name' => $key, 'size' => 18, 'color' => $color])
            <div class="status-label">{{ $report['status_labels'][$key] }}</div>
            <div class="big">{{ $report['summary']['percents'][$key] }}%</div>
            <div class="count-line">{{ __('reports.of_assigned', ['count' => $report['summary']['counts'][$key], 'total' => $report['summary']['assigned']]) }}</div>
            @include('reports.partials.bar', ['percent' => $report['summary']['percents'][$key], 'color' => $color])
          </td>
        @endforeach
      </tr>
    </table>
    @if($isSingle && $report['employee'])
      <p class="muted" style="margin-top: 10px;">{{ __('reports.remedial_assignments', ['count' => $report['employee']['remedial_count']]) }}</p>
    @endif
    <p class="legend">{{ __('reports.bars_legend_target') }}</p>
  </div>

  @if($isSingle)
    <div class="page">
      <table class="section-head" cellspacing="0" cellpadding="0">
        <tr>
          <td style="width: 22px; border: none;">@include('reports.partials.icon', ['name' => 'training', 'size' => 16])</td>
          <td style="padding-left: 8px; border: none;"><h2>{{ __('reports.assignments_section') }}</h2></td>
        </tr>
      </table>
      @if(count($report['assignments']) === 0)
        <p class="empty">{{ __('reports.no_assignments') }}</p>
      @else
        <table class="data" cellspacing="0" cellpadding="0">
          <thead>
            <tr>
              <th>{{ __('reports.col_campaign') }}</th>
              <th>{{ __('reports.col_course') }}</th>
              <th>{{ __('reports.col_group') }}</th>
              <th>{{ __('reports.col_status') }}</th>
              <th>{{ __('reports.col_remedial') }}</th>
              <th>{{ __('reports.col_date') }}</th>
            </tr>
          </thead>
          <tbody>
            @foreach($report['assignments'] as $row)
              <tr>
                <td>{{ $row['campaign'] }}</td>
                <td>{{ $row['course'] }}</td>
                <td>{{ $row['group'] }}</td>
                <td>{{ $row['status_label'] }}</td>
                <td>{{ $row['is_remedial'] ? __('reports.yes') : __('reports.no') }}</td>
                <td>{{ $row['date'] }}</td>
              </tr>
            @endforeach
          </tbody>
        </table>
      @endif
    </div>
  @else
    <div class="page">
      <table class="section-head" cellspacing="0" cellpadding="0">
        <tr>
          <td style="width: 22px; border: none;">@include('reports.partials.icon', ['name' => 'training', 'size' => 16])</td>
          <td style="padding-left: 8px; border: none;"><h2>{{ __('reports.employees_section') }}</h2></td>
        </tr>
      </table>
      @if($report['truncated'])
        <p class="muted">{{ __('reports.employees_truncated') }}</p>
      @endif
      <p class="muted">{{ __('reports.completion_intro') }}</p>
      @if(count($report['employees']) === 0)
        <p class="empty">{{ __('reports.no_employees') }}</p>
      @else
        <table class="data" cellspacing="0" cellpadding="0">
          <thead>
            <tr>
              <th>{{ __('reports.col_name') }}</th>
              <th>{{ __('reports.col_email') }}</th>
              <th>{{ __('reports.col_group') }}</th>
              <th>{{ __('reports.col_assigned') }}</th>
              <th>{{ __('reports.col_passed') }}</th>
              <th>{{ __('reports.col_failed') }}</th>
              <th>{{ __('reports.col_incomplete') }}</th>
              <th>{{ __('reports.col_no_action_short') }}</th>
              <th>{{ __('reports.col_completion') }}</th>
              <th>{{ __('reports.col_remedial') }}</th>
            </tr>
          </thead>
          <tbody>
            @foreach($report['employees'] as $row)
              <tr>
                <td>{{ $row['name'] }}</td>
                <td>{{ $row['email'] }}</td>
                <td>{{ $row['group'] }}</td>
                <td>{{ $row['assigned'] }}</td>
                <td>{{ $row['passed'] }}</td>
                <td>{{ $row['failed'] }}</td>
                <td>{{ $row['incomplete'] }}</td>
                <td>{{ $row['no_action'] }}</td>
                <td>{{ $row['completion_rate'] }}% ({{ $row['passed'] }}/{{ $row['assigned'] }})</td>
                <td>{{ $row['remedial_count'] }}</td>
              </tr>
            @endforeach
          </tbody>
        </table>
      @endif
    </div>
  @endif
</body>
</html>
