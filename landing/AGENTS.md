# CLAUDE.md, remindy landing + docs

Astro + Starlight site: marketing landing at `/`, documentation at `/docs`. Deploys to [remindy.henix.my.id](https://remindy.henix.my.id) via Vercel on push to `main`.

## Stack

- Astro 7, Starlight 0.41 for docs, Tailwind v4 through the `@tailwindcss/vite` plugin.
- Landing: `src/pages/index.astro`, a single file with scroll-snap sections and anime.js reveals.
- Docs: Markdown/MDX in `src/content/docs/docs/`; sidebar and config in `astro.config.mjs`.

## Rules

- Do NOT run long-lived servers (`npm run dev`) inside tool calls; the user runs those. Verify with `npm run build`.
- Restart the dev server after editing `astro.config.mjs`; config changes are not hot-reloaded.
- Copy is plain and concrete. No AI-slop words (unlock, seamless, elevate, delve) and no em-dashes.
- Keep docs scannable: bullets, tables, short lines. Not paragraph-heavy.
- Images shown on npm or GitHub READMEs must use absolute URLs; repo-relative images do not render on npm.

## Commands

- `npm install`
- `npm run build` (static output to `dist/`)
- `npm run preview`
