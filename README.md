# gasolina

Dashboard que muestra la disponibilidad de gasolina (Especial+, Premium+, Diesel+, Gas) en las estaciones de GENEX y Biopetrol en Santa Cruz, Bolivia.

Sitio en producción: https://iluretar.github.io/gasolina/

## Datos

Los datos se scrappean de:

- [GENEX](https://genex.com.bo/estaciones/)
- [Biopetrol](https://app9.biocloud.info/saldos)

y se guardan en `dashboard/static/data.json` mediante un GitHub Action que corre cada 15 minutos.

## Estructura

- `scrape.ts` — scraper (Node + cheerio)
- `dashboard/` — SvelteKit + Svelte 5 + Tailwind v4 + Leaflet
- `.github/workflows/scrape.yml` — GitHub Action: scraper + deploy a Pages

## Desarrollo local

```sh
npm install
npm run scrape
cd dashboard && npm run dev
```

Abre http://localhost:5173

## Despliegue

1. Subir el código a un repo público de GitHub
2. En **Settings → Pages**, seleccionar **GitHub Actions** como source
3. Cada push a `main` dispara el workflow:
   - Job `scrape`: corre el scraper, commitea `data.json` si hay cambios
   - Job `deploy`: build del dashboard y deploy a Pages

El scraper también corre cada 15 minutos vía `cron`, y al terminar hace push con la data actualizada → trigger automático del deploy.

## Despliegue con repo name diferente a `gasolina`

Si tu repo no se llama `gasolina`, hay que actualizar el `BASE_PATH` en `vite.config.ts` (default: `/gasolina`). O setearlo como env var en el workflow:

```yaml
env:
  BASE_PATH: /mi-repo
```
