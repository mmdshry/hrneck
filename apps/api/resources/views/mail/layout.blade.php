<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <meta name="x-apple-disable-message-reformatting">
  <title>{{ $title ?? config('brand.name') }}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    @media only screen and (max-width: 640px) {
      .container { width: 100% !important; }
      .px { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#F8FAFC;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px;">
          <tr>
            <td class="px" style="padding:36px 40px 0 40px;">
              <img src="{{ $message->embed(resource_path('images/hrneck-wordmark.png')) }}" width="148" height="35" alt="HRneck" style="display:block; width:148px; height:auto; border:0;">
              <div style="width:48px; height:3px; background-color:#F76B13; line-height:3px; font-size:0; margin-top:20px;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:28px 40px 8px 40px; font-family:'Plus Jakarta Sans', Arial, Helvetica, sans-serif; color:#0F172A;">
              @yield('content')
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:24px 40px 36px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E2E8F0;">
                <tr>
                  <td style="padding-top:20px; font-family:'Plus Jakarta Sans', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.6; color:#64748B;">
                    <strong style="color:#334155;">{{ config('brand.name') }}</strong><br>
                    @isset($loginUrl)
                    Sign in to your organization: <a href="{{ $loginUrl }}" style="color:#083A6D; text-decoration:underline;">{{ $loginUrl }}</a><br>
                    @endisset
                    Need help? Contact <a href="mailto:{{ config('brand.support_address') }}" style="color:#083A6D; text-decoration:underline;">{{ config('brand.support_address') }}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
