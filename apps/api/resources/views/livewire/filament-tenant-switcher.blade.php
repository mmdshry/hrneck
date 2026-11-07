<div class="fi-tenant-switcher flex items-center gap-2 px-2">
    <label class="hidden text-sm text-gray-500 sm:inline dark:text-gray-400">Org</label>
    <select
        wire:model.live="tenantId"
        class="fi-input block max-w-xs rounded-lg border-none bg-white text-sm text-gray-950 shadow-sm ring-1 ring-gray-950/10 transition dark:bg-white/5 dark:text-white dark:ring-white/20"
        aria-label="Organization context"
    >
        <option value="">Select organization…</option>
        @foreach ($options as $id => $label)
            <option value="{{ $id }}" @selected($tenantId === $id)>{{ $label }}</option>
        @endforeach
    </select>
    @if ($tenantId)
        <button
            type="button"
            wire:click="clear"
            class="min-h-9 rounded-lg px-2 text-xs text-gray-500 underline-offset-2 hover:underline dark:text-gray-400"
        >
            Clear
        </button>
    @endif
</div>
