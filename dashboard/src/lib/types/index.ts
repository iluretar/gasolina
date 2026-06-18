export type ProductKey = 'especial_plus' | 'premium_plus' | 'diesel_plus' | 'gas';

export type ProductStock = {
	litros: number;
	cola: string | null;
	autonomia: string | null;
	vehiculos: number;
	espera: string | null;
};

export type Product = ProductStock | null;

export type Station = {
	empresa: string;
	nombre: string;
	direccion: string;
	mapa: string;
	lat: number | null;
	lon: number | null;
	actualizado: string;
	productos: Record<ProductKey, Product>;
};

export const PRODUCT_KEYS: ProductKey[] = [
	'especial_plus',
	'premium_plus',
	'diesel_plus',
	'gas'
];

export const PRODUCT_LABELS: Record<ProductKey, string> = {
	especial_plus: 'Especial+',
	premium_plus: 'Premium+',
	diesel_plus: 'Diesel+',
	gas: 'Gas'
};

export const EMPRESAS = ['GENEX', 'BIOPETROL'] as const;
export type Empresa = (typeof EMPRESAS)[number];

export type StockLevel = 'agotado' | 'disponible' | 'escaso';

export const SCARCE_THRESHOLD = 5000;

export function stockLevel(p: Product): StockLevel {
	if (!p) return 'agotado';
	if (p.litros < SCARCE_THRESHOLD) return 'escaso';
	return 'disponible';
}
