<script lang="ts">
	import type { Station } from '$lib/types';
	import { PRODUCT_KEYS, PRODUCT_LABELS, stockLevel } from '$lib/types';
	import { Badge } from '$lib/components/ui/badge';
	import { MapPin, ExternalLink } from 'lucide-svelte';

	let { stations }: { stations: Station[] } = $props();

	const levelClass = {
		agotado: 'text-muted-foreground',
		escaso: 'text-yellow-400',
		disponible: 'text-green-400'
	};
</script>

<div class="overflow-x-auto rounded-md border">
	<table class="w-full text-sm">
		<thead>
			<tr class="bg-muted/50 border-b text-left">
				<th class="px-3 py-2 font-medium">Estación</th>
				<th class="px-3 py-2 font-medium">Empresa</th>
				<th class="px-3 py-2 font-medium text-right">Especial+</th>
				<th class="px-3 py-2 font-medium text-right">Premium+</th>
				<th class="px-3 py-2 font-medium text-right">Diesel+</th>
				<th class="px-3 py-2 font-medium text-right">Gas</th>
				<th class="px-3 py-2 font-medium">Actualizado</th>
			</tr>
		</thead>
		<tbody>
			{#each stations as s (s.empresa + s.nombre)}
				<tr class="border-b last:border-0 hover:bg-muted/30">
					<td class="px-3 py-2">
						<div class="font-medium">{s.nombre}</div>
						<div class="text-muted-foreground flex items-center gap-1 text-xs">
							<MapPin class="size-3" />
							{s.direccion || '—'}
						</div>
					</td>
					<td class="px-3 py-2">
						<Badge variant={s.empresa === 'GENEX' ? 'default' : 'secondary'}>
							{s.empresa}
						</Badge>
					</td>
					{#each PRODUCT_KEYS as key (key)}
						{@const p = s.productos[key]}
						{@const level = stockLevel(p)}
						<td class="px-3 py-2 text-right font-mono">
							{#if p}
								<div class={levelClass[level]}>{p.litros.toLocaleString('es-BO')} L</div>
								<div class="text-muted-foreground text-xs">{p.vehiculos} autos</div>
							{:else}
								<span class="text-muted-foreground/50">—</span>
							{/if}
						</td>
					{/each}
					<td class="text-muted-foreground px-3 py-2 text-xs whitespace-nowrap">
						<div class="flex items-center gap-1">
							{s.actualizado}
							{#if s.mapa}
								<a
									href={s.mapa}
									target="_blank"
									rel="noopener noreferrer"
									class="hover:text-foreground"
									aria-label="Mapa"
								>
									<ExternalLink class="size-3" />
								</a>
							{/if}
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
