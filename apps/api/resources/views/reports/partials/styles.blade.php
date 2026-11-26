@php
    $reportFontStack = \App\Domains\AnalyticsReporting\Support\ReportPdf::bodyFontStack();
@endphp
{{-- Shared stylesheet for every PDF report. Sizes are CSS px (dompdf renders at 96 dpi). --}}
<style>
  @page { margin: 72px 28px 52px 28px; }
  html, body { background: #F8FAFC; }
  body { font-family: {!! $reportFontStack !!}; font-size: 12px; color: #0F172A; line-height: 1.4; }
  h1 { font-size: 26px; margin: 8px 0 6px; color: #083A6D; font-weight: bold; line-height: 1.2; }
  h2 { font-size: 16px; margin: 0; color: #083A6D; font-weight: bold; }
  h3 { font-size: 13px; margin: 0 0 8px; color: #334155; font-weight: bold; }
  p { margin: 0 0 6px; }
  strong { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  th, td { vertical-align: middle; }

  /* Running header and footer, repeated on every page. */
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
  .header-title { text-align: right; color: #334155; font-size: 12px; font-weight: bold; }
  .footer {
    position: fixed;
    bottom: -38px;
    left: 0;
    right: 0;
    background: #F8FAFC;
    border-top: 1px solid #E2E8F0;
    color: #64748B;
    font-size: 11px;
    padding: 8px 90px 0 0;
    line-height: 1.35;
  }
  .footer p { margin: 0; }

  .page { page-break-before: always; }
  .cover { padding-top: 28px; }
  .cover-card { background: #FFFFFF; border: 1px solid #E2E8F0; }
  .cover-card td { border: none; background: #FFFFFF; padding: 36px 40px; vertical-align: top; }
  .cover-brand { width: 46%; border-right: 1px solid #E2E8F0; }
  .spark { height: 3px; background: #F76B13; width: 48px; margin: 22px 0 0; }

  .section-head td { border: none; padding-bottom: 12px; }
  .section-icon { width: 22px; border: none; }
  .section-title { padding-left: 8px; border: none; }

  .muted { color: #64748B; font-size: 11px; }
  .note { margin-top: 12px; color: #64748B; font-size: 11px; }
  .empty { margin-top: 16px; color: #64748B; }
  .legend { margin-top: 10px; font-size: 11px; color: #64748B; line-height: 1.4; }
  .count-line { font-size: 11px; color: #64748B; margin: 0 0 6px; }

  /* KPI cards. Each card's status colour is applied inline as the top border. */
  .cards td {
    width: 25%;
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-top: 3px solid #E2E8F0;
    padding: 14px 16px;
    vertical-align: top;
  }
  .status-label { font-size: 12px; font-weight: bold; color: #334155; margin: 6px 0 0; }
  .big { font-size: 28px; font-weight: bold; color: #0F172A; line-height: 1; margin: 10px 0 4px; }
  .delta { font-size: 11px; color: #083A6D; margin-bottom: 8px; }
  .month-chip { border: none; font-size: 11px; color: #64748B; padding-right: 8px; }

  /* Summary strip of counts. */
  .strip td {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    padding: 10px 12px;
    width: 16.6%;
    vertical-align: top;
  }
  .strip strong { color: #0F172A; font-size: 16px; font-weight: bold; }

  .profile { background: #FFFFFF; border: 1px solid #E2E8F0; }
  .profile td { border: none; padding: 12px 14px; width: 33%; }

  /* Data tables. */
  .data { margin-top: 8px; background: #FFFFFF; }
  .data th {
    background: #FFFFFF;
    color: #083A6D;
    border: none;
    border-bottom: 1px solid #083A6D;
    padding: 7px 5px;
    font-size: 11px;
    font-weight: bold;
    text-align: left;
  }
  .data td {
    background: #FFFFFF;
    border: none;
    border-bottom: 1px solid #E2E8F0;
    padding: 6px 5px;
    font-size: 11px;
    text-align: left;
    vertical-align: top;
  }

  .toc td { border: none; border-bottom: 1px solid #F1F5F9; padding: 10px 4px; }
  .toc-num { width: 36px; color: #F76B13; font-weight: bold; }
</style>
