<x-filament-panels::page>
    @if (! \App\Support\FilamentTenant::has())
        <x-filament::section>
            <p class="text-sm text-gray-500 dark:text-gray-400">Select an organization in the top bar to edit white-label settings.</p>
        </x-filament::section>
    @else
        <form wire:submit="save" class="space-y-6">
            {{ $this->form }}
            <x-filament::button type="submit">Save settings</x-filament::button>
        </form>
    @endif
</x-filament-panels::page>
