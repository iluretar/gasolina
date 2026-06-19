<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import type { Station, Product } from '$lib/types';
	import { stockLevel, type StockLevel } from '$lib/types';

	let { stations, focusId }: { stations: Station[]; focusId?: string } = $props();

	const activeId = $derived(focusId);

	let mapEl: HTMLDivElement;
	let mapInstance = $state<any>(null);
	let LRef = $state<any>(null);
	let markers: Map<string, { marker: any; fillColor: string }> = new Map();

	const LEVEL_COLORS: Record<StockLevel, string> = {
		disponible: '#22c55e',
		escaso: '#eab308',
		agotado: '#71717a'
	};

	function stationLevel(station: Station): StockLevel {
		const prods = Object.values(station.productos).filter((p): p is Product => p !== null);
		if (prods.length === 0) return 'agotado';
		if (prods.every((p) => stockLevel(p) === 'disponible')) return 'disponible';
		if (prods.every((p) => stockLevel(p) === 'agotado')) return 'agotado';
		return 'escaso';
	}

	function statusColor(station: Station): string {
		return LEVEL_COLORS[stationLevel(station)];
	}

	function popupHtml(s: Station): string {
		const lines: string[] = [
			`<div style="font-family: system-ui; min-width: 180px">`,
			`<div style="font-weight:600; margin-bottom:4px">${s.nombre}</div>`,
			`<div style="font-size:11px; color:#a1a1aa; margin-bottom:6px">${s.direccion}</div>`
		];
		for (const [k, label] of [
			['especial_plus', 'Gasolina'],
			['diesel_plus', 'Diesel']
		] as const) {
			const p = s.productos[k];
			if (p) {
				lines.push(
					`<div style="font-size:12px">${label}: <b>${p.litros.toLocaleString('es-BO')} L</b> · ${p.vehiculos} autos</div>`
				);
			}
		}
		if (s.mapa) {
			lines.push(
				`<a href="${s.mapa}" target="_blank" rel="noopener" style="font-size:11px; color:#3b82f6">Ver en Google Maps →</a>`
			);
		}
		lines.push('</div>');
		return lines.join('');
	}

	onMount(async () => {
		const L = (await import('leaflet')).default;
		LRef = L;
		await import('leaflet/dist/leaflet.css');

		const center: [number, number] = [-17.7863, -63.1812];
		mapInstance = L.map(mapEl, { zoomControl: true, maxZoom: 19 }).setView(center, 13);

		L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
			attribution: '© OpenStreetMap © CARTO',
			subdomains: 'abcd',
			maxZoom: 17
		}).addTo(mapInstance);
	});

	$effect(() => {
		const map = mapInstance;
		const L = LRef;
		if (!map || !L) return;
		const wanted = new Set(
			stations.filter((s) => s.lat != null && s.lon != null).map((s) => s.empresa + s.nombre)
		);
		for (const [key, { marker }] of markers) {
			if (!wanted.has(key)) {
				marker.remove();
				markers.delete(key);
			}
		}
		for (const s of stations) {
			if (s.lat == null || s.lon == null) continue;
			const key = s.empresa + s.nombre;
			if (markers.has(key)) continue;
			const fillColor = statusColor(s);
			const marker = L.circleMarker([s.lat, s.lon], {
				radius: 8,
				fillColor,
				color: '#fff',
				weight: 2,
				fillOpacity: 0.9
			})
				.bindPopup(popupHtml(s), { autoPan: false })
				.addTo(map);
			markers.set(key, { marker, fillColor });
		}
		if (markers.size > 0 && !untrack(() => activeId)) {
			const bounds = L.latLngBounds([...markers.values()].map((m) => m.marker.getLatLng()));
			map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
		}
	});

	$effect(() => {
		const id = activeId;
		const map = mapInstance;
		if (!map) return;
		for (const [key, { marker, fillColor }] of markers) {
			const isActive = key === id;
			marker.setStyle({
				radius: isActive ? 12 : 8,
				weight: isActive ? 3 : 2,
				fillColor,
				color: '#fff',
				fillOpacity: 0.9
			});
		}
		if (id) {
			const entry = markers.get(id);
			if (entry) {
				entry.marker.openPopup();
			}
		} else {
			for (const { marker } of markers.values()) {
				marker.closePopup();
			}
		}
	});

	onDestroy(() => {
		mapInstance?.remove();
		mapInstance = null;
		markers.clear();
	});
</script>

<div bind:this={mapEl} class="h-full w-full"></div>
