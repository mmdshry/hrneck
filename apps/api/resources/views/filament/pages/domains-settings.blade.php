<x-filament-panels::page>
    @if (! \App\Support\FilamentTenant::has())
        <x-filament::section>
            <p class="text-sm text-gray-500 dark:text-gray-400">Select an organization to manage sending domains.</p>
        </x-filament::section>
    @else
        <form wire:submit="save" class="space-y-6">
            {{ $this->form }}
            <x-filament::button type="submit">Save domain</x-filament::button>
        </form>
        @if ($guidance)
            <x-filament::section class="mt-6" heading="DNS guidance for {{ $guidance['domain'] }}">
                <ul class="space-y-3 text-sm">
                    @foreach ($guidance['records'] as $record)
                        <li class="rounded-lg border border-gray-200 p-3 dark:border-white/10">
                            <p class="font-medium text-gray-950 dark:text-white">{{ $record['type'] }} {{ $record['host'] }}</p>
                            <p class="break-all text-gray-500 dark:text-gray-400">{{ $record['value'] }}</p>
                            <p class="mt-1 text-gray-500 dark:text-gray-400">{{ $record['purpose'] }}</p>
                        </li>
                    @endforeach
                </ul>
            </x-filament::section>
        @endif
    @endif
</x-filament-panels::page>
