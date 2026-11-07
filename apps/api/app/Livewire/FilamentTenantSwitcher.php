<?php

namespace App\Livewire;

use App\Support\FilamentTenant;
use Livewire\Component;

class FilamentTenantSwitcher extends Component
{
    public ?string $tenantId = null;

    public function mount(): void
    {
        $this->tenantId = FilamentTenant::id();
    }

    public function updatedTenantId(?string $value): void
    {
        FilamentTenant::set($value ?: null);
        $this->redirect(request()->header('Referer') ?: url('/admin'), navigate: true);
    }

    public function clear(): void
    {
        FilamentTenant::set(null);
        $this->tenantId = null;
        $this->redirect(url('/admin'), navigate: true);
    }

    public function render()
    {
        return view('livewire.filament-tenant-switcher', [
            'options' => FilamentTenant::options(),
        ]);
    }
}
