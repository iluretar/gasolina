<script lang="ts">
	import type { Station } from '$lib/types';
	import { PRODUCT_KEYS, PRODUCT_LABELS, stockLevel } from '$lib/types';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { Fuel, Clock, Users, MapPin, ExternalLink } from 'lucide-svelte';

	let {
		station,
		id,
		active = false,
		onhover,
		onleave
	}: {
		station: Station;
		id?: string;
		active?: boolean;
		onhover?: (id: string) => void;
		onleave?: () => void;
	} = $props();

	const variantFor = {
		agotado: 'secondary' as const,
		escaso: 'scarce' as const,
		disponible: 'available' as const
	};

	const empresaClass = $derived(
		station.empresa === 'GENEX' ? 'text-genex' : 'text-biopetrol'
	);
</script>

<Card.Root
	{id}
	class={active ? 'border-primary border-2' : ''}
	onmouseenter={onhover ? () => onhover(id ?? '') : undefined}
	onmouseleave={onleave}
	role={onhover ? 'button' : undefined}
>
	<Card.Header>
		<div class="flex items-start justify-between gap-2">
			<div>
				<Card.Title class={empresaClass}>{station.nombre}</Card.Title>
				<Card.Description class="mt-1 flex items-center gap-1">
					<MapPin class="size-3" />
					{station.direccion || '—'}
				</Card.Description>
			</div>
			<a
				href={station.mapa}
				target="_blank"
				rel="noopener noreferrer"
				class="text-muted-foreground hover:text-foreground shrink-0"
				aria-label="Abrir en mapa"
			>
				<ExternalLink class="size-4" />
			</a>
		</div>
	</Card.Header>
	<Card.Content>
		<div class="grid gap-3 sm:grid-cols-2">
			{#each PRODUCT_KEYS as key (key)}
				{@const p = station.productos[key]}
				{@const level = stockLevel(p)}
				<div class="rounded-md border p-3">
					<div class="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
						<span class="text-sm font-medium">{PRODUCT_LABELS[key]}</span>
						<Badge variant={variantFor[level]}>
							{level === 'agotado' ? 'Agotado' : level === 'escaso' ? 'Escaso' : 'Disponible'}
						</Badge>
					</div>
					{#if p}
						<div class="text-muted-foreground space-y-1 text-xs">
							<div class="flex items-center gap-1.5">
								<Fuel class="size-3" />
								<span class="font-mono text-foreground">{p.litros.toLocaleString('es-BO')} L</span>
							</div>
							<div class="flex items-center gap-1.5">
								<Users class="size-3" />
								<span class="font-mono text-foreground">{p.vehiculos}</span>
								<span>vehículos</span>
							</div>
							{#if p.autonomia}
								<div class="flex items-center gap-1.5">
									<Clock class="size-3" />
									<span>{p.autonomia}</span>
								</div>
							{/if}
							{#if p.espera}
								<div class="flex items-center gap-1.5">
									<Clock class="size-3" />
									<span>espera {p.espera}</span>
								</div>
							{/if}
							{#if p.cola}
								<div class="text-muted-foreground/80 text-xs italic">{p.cola}</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</Card.Content>
	<Card.Footer>
		<span class="text-muted-foreground text-xs">
			Actualizado: {station.actualizado}
		</span>
	</Card.Footer>
</Card.Root>
