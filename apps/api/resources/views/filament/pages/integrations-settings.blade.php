@php($smtp = $this->getSmtpStatus())
<x-filament-panels::page>
    <div class="space-y-4">
        <x-filament::section heading="SMTP mail">
            <p class="text-sm">
                Status: <strong>{{ $smtp['status'] }}</strong>
                · {{ $smtp['host'] }}:{{ $smtp['port'] }}
                · from {{ $smtp['from'] }}
            </p>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Password is never shown; configure via server env only.</p>
        </x-filament::section>

        <x-filament::section heading="Directory sync">
            <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
                Entra/Graphus live sync: coming when credentials are available. Mock sync works per tenant.
            </p>
            @if (\App\Support\FilamentTenant::has())
                <x-filament::button wire:click="runDirectorySync" icon="heroicon-o-arrow-path">
                    Run mock directory sync
                </x-filament::button>
            @else
                <p class="text-sm text-gray-500 dark:text-gray-400">Select an organization to run sync.</p>
            @endif
        </x-filament::section>
    </div>
</x-filament-panels::page>
