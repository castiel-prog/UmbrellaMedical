# Umbrella Medical Center: website

The Angular 21 front-end of Umbrella Medical Center. See the [main README](../README.md) for the whole system.

## Run
```bash
npm ci
npm start        # http://localhost:4200 — /api is proxied to the API at https://localhost:7128 (proxy.conf.json)
```

## Build
```bash
npx ng build     # production build into dist/umbrella-web/browser
```
The `Dockerfile` builds the site and serves it with **Caddy** (`Caddyfile`): HTTPS, `/api`, `/swagger` and `/health` forwarded to the API container, every other path falls back to `index.html`.

## Where things are
| Folder | What |
|---|---|
| `src/app/pages/` | One folder per page (doctors, booking, health, pharmacy, admin, reports, support chat…) |
| `src/app/core/` | API services, models, auth, cart, notifications, presence, i18n |
| `src/app/core/i18n/` | Translations: `ka.ts`, `de.ts`, `fr.ts`, `it.ts`, `es.ts`, `ru.ts` (English is the source text) |
| `src/app/shared/` | Reusable components: icons, date picker, card fields, product image, pager, avatar |
| `src/styles.scss` | Global styles, light/dark themes, responsive rules |
| `public/` | Static files: logo, favicon, photo credits page |

## Conventions
- Standalone components with signals and `OnPush` change detection.
- Every visible text goes through the `t` pipe (`{{ 'Book a visit' | t }}`), or `i18n.t()` in code. Add the text to all six dictionaries.
- Dates use the `ldate` pipe so they follow the chosen language.
- Layouts must fit a 320px-wide phone: grids use `minmax(min(Npx, 100%), 1fr)`, and tab rows scroll sideways on phones.
