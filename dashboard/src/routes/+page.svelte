<script lang="ts">
	import { onMount } from 'svelte';
	import type { Station, ProductKey, Empresa } from '$lib/types';
	import { PRODUCT_KEYS, PRODUCT_LABELS, EMPRESAS } from '$lib/types';
	import StationCard from '$lib/components/StationCard.svelte';
	import StationsTable from '$lib/components/StationsTable.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import * as Card from '$lib/components/ui/card';
	import { LayoutGrid, Table2, Search, X } from 'lucide-svelte';

	let stations = $state<Station[]>([]);
	let loading = $state(true);
	const base = import.meta.env.BASE_URL;
	let view = $state<'cards' | 'table'>('cards');
	let empresaFilter = $state<Empresa[]>([...EMPRESAS]);
	let productFilter = $state<ProductKey[]>([...PRODUCT_KEYS]);
	let search = $state('');
	let focusId = $state<string | undefined>(undefined);

	onMount(async () => {
		try {
			const res = await fetch(`${base}/data.json`);
			stations = await res.json();
		} catch (e) {
			console.error('failed to load data', e);
		} finally {
			loading = false;
		}
	});

	const filtered = $derived(
		stations.filter((s) => {
			if (!empresaFilter.includes(s.empresa as Empresa)) return false;
			const hasAnyProduct = PRODUCT_KEYS.some(
				(k) => productFilter.includes(k) && s.productos[k]
			);
			if (!hasAnyProduct) return false;
			if (search) {
				const q = search.toLowerCase();
				if (
					!s.nombre.toLowerCase().includes(q) &&
					!s.direccion.toLowerCase().includes(q)
				)
					return false;
			}
			return true;
		})
	);

	const stats = $derived({
		total: filtered.length,
		especial: filtered.filter((s) => s.productos.especial_plus).length,
		diesel: filtered.filter((s) => s.productos.diesel_plus).length
	});

	const hasActiveFilters = $derived(
		search !== '' ||
			empresaFilter.length !== EMPRESAS.length ||
			productFilter.length !== PRODUCT_KEYS.length
	);

	function resetFilters() {
		search = '';
		empresaFilter = [...EMPRESAS];
		productFilter = [...PRODUCT_KEYS];
	}
</script>

<div class="flex h-dvh flex-col">
	<header
		class="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 border-b backdrop-blur"
	>
		<div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
			<h1 class="text-lg font-semibold">⛽ Gasolina Santa Cruz</h1>
			<div class="text-muted-foreground ml-auto text-xs">
				{stats.total} estaciones
				{#if productFilter.length !== PRODUCT_KEYS.length}· {stats.especial} especial · {stats.diesel} diesel{/if}
			</div>
		</div>
		<div class="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 pb-3">
			<div class="relative min-w-[180px] flex-1">
				<Search
					class="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
				/>
				<Input
					bind:value={search}
					placeholder="Buscar por nombre o dirección…"
					class="pl-8"
				/>
			</div>

			{#if hasActiveFilters}
				<button
					type="button"
					onclick={resetFilters}
					class="border-input bg-background text-muted-foreground hover:text-foreground inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm"
				>
					<X class="size-4" />
					Limpiar
				</button>
			{/if}

			<Select.Root type="multiple" bind:value={empresaFilter}>
				<Select.Trigger class="w-[160px]">
					{empresaFilter.length === EMPRESAS.length
						? 'Empresas'
						: empresaFilter.length === 0
							? 'Sin empresas'
							: empresaFilter.join(', ')}
				</Select.Trigger>
				<Select.Content>
					{#each EMPRESAS as e (e)}
						<Select.Item value={e} label={e} />
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root type="multiple" bind:value={productFilter}>
				<Select.Trigger class="w-[200px]">
					{productFilter.length === PRODUCT_KEYS.length
						? 'Productos'
						: productFilter.length === 0
							? 'Sin productos'
							: productFilter
									.map((k) => PRODUCT_LABELS[k])
									.join(', ')}
				</Select.Trigger>
				<Select.Content>
					{#each PRODUCT_KEYS as k (k)}
						<Select.Item value={k} label={PRODUCT_LABELS[k]} />
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root type="single" bind:value={view}>
				<Select.Trigger class="w-[140px]">
					{#if view === 'cards'}
						<LayoutGrid class="size-4" /> Cards
					{:else}
						<Table2 class="size-4" /> Tabla
					{/if}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="cards" label="Cards" />
					<Select.Item value="table" label="Tabla" />
				</Select.Content>
			</Select.Root>
		</div>
	</header>

	<div class="flex flex-1 overflow-hidden">
		<main class="flex-1 overflow-y-auto p-4 lg:pr-0">
			<div class="mx-auto max-w-5xl">
				{#if loading}
					<Card.Root>
						<Card.Content class="py-12 text-center">Cargando…</Card.Content>
					</Card.Root>
				{:else if filtered.length === 0}
					<Card.Root>
						<Card.Content class="text-muted-foreground py-12 text-center">
							Sin resultados con esos filtros.
						</Card.Content>
					</Card.Root>
				{:else if view === 'cards'}
					<div class="grid gap-4 lg:grid-cols-2">
						{#each filtered as s (s.empresa + s.nombre)}
							{@const sid = s.empresa + s.nombre}
							<StationCard
								station={s}
								id={sid}
								active={focusId === sid}
								onhover={(id) => (focusId = id)}
								onleave={() => (focusId = undefined)}
							/>
						{/each}
					</div>
				{:else}
					<StationsTable stations={filtered} />
				{/if}
			</div>
		</main>

		<aside
			class="hidden lg:block w-1/2 shrink-0 border-l"
			aria-label="Mapa"
		>
			<MapView stations={filtered} {focusId} />
		</aside>
	</div>

	<div class="lg:hidden border-t h-[400px] shrink-0">
		<MapView stations={filtered} {focusId} />
	</div>
</div>
