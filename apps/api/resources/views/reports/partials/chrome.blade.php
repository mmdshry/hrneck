{{-- Running header and footer. Expects $headerTitle (string) and $footerLines (list of strings). --}}
@php
    $wordmarkSrc = \App\Domains\AnalyticsReporting\Support\ReportPdf::wordmarkDataUri();
@endphp
<div class="header">
  <table cellspacing="0" cellpadding="0">
    <tr>
      <td style="width: 160px; border: none;">
        @if($wordmarkSrc)
          <img src="{{ $wordmarkSrc }}" alt="HRneck" width="148" height="35">
        @endif
      </td>
      <td class="header-title">{{ $headerTitle }}</td>
    </tr>
  </table>
</div>

<div class="footer">
  @foreach($footerLines as $line)
    <p>{{ $line }}</p>
  @endforeach
</div>
