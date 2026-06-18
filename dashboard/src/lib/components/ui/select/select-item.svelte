<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn, type WithoutChild } from "$lib/utils";
	import Check from "lucide-svelte/icons/check";

	let {
		ref = $bindable(null),
		class: className,
		value,
		label,
		children: childrenProp,
		...restProps
	}: WithoutChild<SelectPrimitive.ItemProps> = $props();
</script>

	<SelectPrimitive.Item
		bind:ref
		{value}
		data-slot="select-item"
		class={cn(
			"focus:bg-accent data-highlighted:bg-accent data-highlighted:text-accent-foreground focus:text-accent-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 ps-2 pe-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
			className
		)}
		{...restProps}
	>
		{#snippet children({ selected, highlighted })}
			<span class="flex size-4 shrink-0 items-center justify-center">
				{#if selected}
					<Check class="size-4" />
				{/if}
			</span>
			<span class="shrink-0 whitespace-nowrap">
				{#if childrenProp}
					{@render childrenProp({ selected, highlighted })}
				{:else}
					{label || value}
				{/if}
			</span>
		{/snippet}
	</SelectPrimitive.Item>
