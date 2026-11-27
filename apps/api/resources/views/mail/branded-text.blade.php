{!! $title !!}

@foreach ($lines as $line)
{!! $line !!}

@endforeach
@foreach ($actions as $action)
{!! $action['label'] !!}: {!! $action['url'] !!}
@endforeach

--
{!! config('brand.name') !!}
@isset($loginUrl)
Sign in to your organization: {!! $loginUrl !!}
@endisset
Need help? {!! config('brand.support_address') !!}
