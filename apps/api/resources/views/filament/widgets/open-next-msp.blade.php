<x-filament-widgets::widget>
    <x-filament::section>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h2 class="text-base font-semibold tracking-tight text-gray-950 dark:text-white">
                    Next product UI
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                    Filament and Next both expose full tenant operations. Use Next for the product UX; Filament for operator control.
                </p>
            </div>
            <div class="flex flex-wrap gap-2">
                <x-filament::button
                    tag="a"
                    :href="$this->getMspUrl()"
                    target="_blank"
                    icon="heroicon-o-arrow-top-right-on-square"
                >
                    Open MSP (Next)
                </x-filament::button>
                @if ($org = $this->getOrgUrl())
                    <x-filament::button
                        tag="a"
                        :href="$org"
                        target="_blank"
                        color="gray"
                        icon="heroicon-o-building-office-2"
                    >
                        Open selected org
                    </x-filament::button>
                @endif
            </div>
        </div>
    </x-filament::section>
</x-filament-widgets::widget>
