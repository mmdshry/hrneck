@extends('mail.layout')

@section('content')
  <h1 style="margin:0 0 16px 0; font-family:'Plus Jakarta Sans', Arial, Helvetica, sans-serif; font-size:22px; line-height:1.3; font-weight:600; color:#0F172A;">{{ $title }}</h1>

  <p style="margin:0 0 14px 0; font-family:'Plus Jakarta Sans', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#334155;">{{ $summary }}</p>

  @if ($notice !== '')
    <p style="margin:0 0 14px 0; font-family:'Plus Jakarta Sans', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#B45309;">{{ $notice }}</p>
  @endif

  @if ($csvBody !== '')
    <pre style="margin:16px 0 8px 0; padding:16px; background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; font-family:Consolas, Menlo, 'Courier New', monospace; font-size:13px; line-height:1.5; color:#0F172A; white-space:pre-wrap; word-break:break-word;">{{ $csvBody }}</pre>
  @endif
@endsection
