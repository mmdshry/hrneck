{!! $title !!}

@foreach ($lines as $line)
{!! $line !!}

@endforeach
@foreach ($actions as $action)
{!! $action['label'] !!}: {!! $action['url'] !!}
@endforeach

--
{!! config('brand.name') !!}
Need help? {!! config('brand.support_address') !!}
