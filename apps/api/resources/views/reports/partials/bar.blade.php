@php
    $barPercent = max(0, min(100, (int) ($percent ?? 0)));
    $barColor = $color ?? '#083A6D';
@endphp
<table class="bar" cellspacing="0" cellpadding="0">
  <tr>
    @if($barPercent > 0)
      <td style="width: {{ $barPercent }}%; background: {{ $barColor }}; height: 8px; font-size: 1px; line-height: 8px;">&nbsp;</td>
    @endif
    @if($barPercent < 100)
      <td style="background: #E2E8F0; height: 8px; font-size: 1px; line-height: 8px;">&nbsp;</td>
    @endif
  </tr>
</table>
