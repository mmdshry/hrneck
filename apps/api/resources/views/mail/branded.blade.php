@extends('mail.layout')

@section('content')
  <h1 style="margin:0 0 16px 0; font-family:'Plus Jakarta Sans', Arial, Helvetica, sans-serif; font-size:22px; line-height:1.3; font-weight:600; color:#0F172A;">{{ $title }}</h1>

  @foreach ($lines as $line)
    <p style="margin:0 0 14px 0; font-family:'Plus Jakarta Sans', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#334155;">{{ $line }}</p>
  @endforeach

  @foreach ($actions as $action)
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px 0;">
      <tr>
        <td align="center" bgcolor="#083A6D" style="border-radius:8px; background-color:#083A6D;">
          <a href="{{ $action['url'] }}" target="_blank" style="display:inline-block; padding:12px 24px; font-family:'Plus Jakarta Sans', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; line-height:1; color:#FFFFFF; text-decoration:none; border-radius:8px;">{{ $action['label'] }}</a>
        </td>
      </tr>
    </table>
  @endforeach

  @if (count($actions) === 1)
    <p style="margin:0 0 8px 0; font-family:'Plus Jakarta Sans', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.5; color:#64748B;">
      If the button does not work, copy this link into your browser:<br>
      <a href="{{ $actions[0]['url'] }}" style="color:#083A6D; word-break:break-all;">{{ $actions[0]['url'] }}</a>
    </p>
  @endif
@endsection
