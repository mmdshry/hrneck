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
    </div>
</x-filament-panels::page>
