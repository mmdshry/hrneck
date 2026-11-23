@php
    $iconSize = (int) ($size ?? 16);
    $iconColor = $color ?? '#083A6D';
    $iconName = $name ?? 'summary';
    $iconLabel = match ($iconName) {
        'no_action' => __('reports.icon_no_action'),
        'incomplete' => __('reports.icon_incomplete'),
        'failed' => __('reports.icon_failed'),
        'passed' => __('reports.icon_passed'),
        'training' => __('reports.icon_training'),
        'risk' => __('reports.icon_risk'),
        'remedial' => __('reports.icon_remedial'),
        default => __('reports.icon_summary'),
    };
@endphp
<svg xmlns="http://www.w3.org/2000/svg" width="{{ $iconSize }}" height="{{ $iconSize }}" viewBox="0 0 24 24" role="img" aria-label="{{ $iconLabel }}">
  @switch($iconName)
    @case('no_action')
      <circle cx="12" cy="12" r="8" fill="none" stroke="{{ $iconColor }}" stroke-width="1.8"/>
      <path d="M8 12 H16" fill="none" stroke="{{ $iconColor }}" stroke-width="1.8"/>
      @break
    @case('incomplete')
      <circle cx="12" cy="12" r="8" fill="none" stroke="{{ $iconColor }}" stroke-width="1.8"/>
      <path d="M12 8 V12 L15.5 14" fill="none" stroke="{{ $iconColor }}" stroke-width="1.8"/>
      @break
    @case('failed')
      <circle cx="12" cy="12" r="8" fill="none" stroke="{{ $iconColor }}" stroke-width="1.8"/>
      <path d="M9 9 L15 15 M15 9 L9 15" fill="none" stroke="{{ $iconColor }}" stroke-width="1.8"/>
      @break
    @case('passed')
      <circle cx="12" cy="12" r="8" fill="none" stroke="{{ $iconColor }}" stroke-width="1.8"/>
      <path d="M8 12.5 L11 15.5 L16.5 9" fill="none" stroke="{{ $iconColor }}" stroke-width="1.8"/>
      @break
    @case('training')
      <path d="M4 7 H12 V18 H4 Z M12 7 H20 V18 H12 Z" fill="none" stroke="{{ $iconColor }}" stroke-width="1.6"/>
      @break
    @case('risk')
      <path d="M12 4 L21 19 H3 Z" fill="none" stroke="{{ $iconColor }}" stroke-width="1.6"/>
      <path d="M12 10 V14 M12 16.5 V17.2" fill="none" stroke="{{ $iconColor }}" stroke-width="1.6"/>
      @break
    @case('remedial')
      <path d="M12 6 A6 6 0 1 1 7.5 16" fill="none" stroke="{{ $iconColor }}" stroke-width="1.6"/>
      <path d="M12 3 V7 H16" fill="none" stroke="{{ $iconColor }}" stroke-width="1.6"/>
      @break
    @default
      <path d="M5 17 V11 M12 17 V6 M19 17 V9" fill="none" stroke="{{ $iconColor }}" stroke-width="1.8"/>
  @endswitch
</svg>
