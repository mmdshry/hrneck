@php($d = $this->getViewData())
<x-filament-panels::page>
    <div class="grid gap-4 md:grid-cols-2">
        <x-filament::section heading="Directory">
            <ul class="space-y-1 text-sm">
                <li>Organizations: <strong>{{ $d['tenants'] }}</strong></li>
                <li>Central users: <strong>{{ $d['users'] }}</strong></li>
            </ul>
        </x-filament::section>
        <x-filament::section heading="Mail">
            <ul class="space-y-1 text-sm">
                <li>Mailer: <strong>{{ $d['mailer'] }}</strong></li>
                <li>SMTP: {{ $d['smtpHost'] }}:{{ $d['smtpPort'] }}</li>
                <li class="text-xs text-gray-500 dark:text-gray-400">Password never displayed here.</li>
            </ul>
        </x-filament::section>
        <x-filament::section heading="Links">
            <div class="flex flex-wrap gap-3">
                <x-filament::button tag="a" :href="$d['mspUrl']" target="_blank" icon="heroicon-o-arrow-top-right-on-square">
                    Open MSP (Next)
                </x-filament::button>
                <x-filament::button tag="a" :href="$d['horizonUrl']" target="_blank" color="gray" icon="heroicon-o-queue-list">
                    Horizon
                </x-filament::button>
            </div>
            <p class="mt-3 break-all text-xs text-gray-500 dark:text-gray-400">Frontend: {{ $d['frontend'] }}</p>
        </x-filament::section>
    </div>
</x-filament-panels::page>
