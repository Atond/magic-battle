# Stack idlev1 — rapport stack-scout (2026-09-20, vérifié sur npm / docs)

## Versions retenues
| Paquet | Version | Note |
| --- | --- | --- |
| vite | 8.x | `@vitejs/plugin-react` (Babel, pas SWC) exige vite ^8 |
| react / react-dom | 19.3 | |
| typescript | ~6.0.3 | **pas TS 7** : typescript-eslint 8.70 impose `<6.1` (issue #12123) |
| eslint + typescript-eslint | 9.x / 8.x | flat config, aligné nylnatosport ; eslint 10 trop frais |
| tailwindcss + @tailwindcss/vite | 4.x | |
| shadcn (CLI) | 4.x | `npx shadcn@latest init` natif Tailwind 4 + Vite ; style `new-york` (défaut, `default` déprécié) ; primitives `data-slot`, plus de `forwardRef` |
| vitest | 5.x | |
| zustand | 5.x | sélecteurs = souscriptions sélectives à 10 ticks/s ; `subscribeWithSelector` + `persist` (localStorage) |

## Installation (ordre impératif)
```bash
npm create vite@latest . -- --template react-ts
npm install tailwindcss @tailwindcss/vite zustand
# src/index.css : @import "tailwindcss";
# vite.config.ts : plugins:[react(), tailwindcss()], resolve.alias "@" -> "./src", base: '/idlev1/'
# tsconfig.json ET tsconfig.app.json : baseUrl + paths "@/*"
npx shadcn@latest init
npx shadcn@latest add button
```

## Idle-spécifique
- Grands nombres : `Number` natif tant que < 1e308 ; `break_infinity.js` 2.2 (ou `break_eternity.js` si tétration) seulement si le simulateur le déclenche.
- Formatage : `Intl.NumberFormat` compact fr suffit en V1.
- Canvas : aucune lib de test ; logique de combat en fonctions pures testées par Vitest ; `vitest-canvas-mock` 1.2 si besoin ponctuel de `getContext`.

## GitHub Pages
- `base: '/idlev1/'` dans vite.config.ts (piège n°1) ; remettre `'/'` si domaine custom.
- Settings → Pages → Source = GitHub Actions. Workflow : checkout@v4 → setup-node (cache npm) → `npm ci` → `npm run build` → configure-pages@v5 → upload-pages-artifact@v3 (`path: dist`) → deploy-pages@v4.
- Permissions : `contents: read`, `pages: write`, `id-token: write` ; `concurrency: pages`.

## Intégrations Claude Code à réutiliser (≤ 5)
context7 (docs Tailwind 4 / shadcn / Zustand) · skill `vercel:shadcn` · skill `vercel:react-best-practices` · skill `atelier:idle-balance`. Aucun MCP supplémentaire (git/gh natifs suffisent). Pas d'indexation type repowise (projet minuscule).

## À éviter
TS 7 · eslint 10 · Next.js · PixiJS/Phaser · break_infinity dès le départ · style shadcn `default`.

Sources : typescript-eslint.io/users/dependency-versions · github.com/typescript-eslint/typescript-eslint/issues/12123 ·
ui.shadcn.com/docs/tailwind-v4 · shadcn.io/ui/installation/vite · vite.dev/guide/static-deploy#github-pages ·
github.com/Patashu/break_infinity.js · npm registry (2026-09-20).
