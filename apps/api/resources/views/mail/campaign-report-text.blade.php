{!! $title !!}

{!! $summary !!}
@if ($notice !== '')

{!! $notice !!}
@endif
{!! $csvBody !!}

--
{!! config('brand.name') !!}
@isset($loginUrl)
Sign in to your organization: {!! $loginUrl !!}
@endisset
