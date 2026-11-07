<?php

namespace App\Filament\Widgets;

use App\Support\FilamentTenant;
use Filament\Widgets\Widget;

class OpenNextMspWidget extends Widget
{
    protected string $view = 'filament.widgets.open-next-msp';

    protected int|string|array $columnSpan = 'full';

    public function getMspUrl(): string
    {
        return rtrim((string) config('brand.frontend_url'), '/').'/msp';
    }

    public function getOrgUrl(): ?string
    {
        $id = FilamentTenant::id();
        if (! $id) {
            return null;
        }

        return rtrim((string) config('brand.frontend_url'), '/').'/org?tenant='.$id;
    }
}
