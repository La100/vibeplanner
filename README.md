# VibePlanner

**AI Habit Planner with AI Assistants**

VibePlanner pomaga budować nawyki, utrzymywać rytm dnia i domykać cele z pomocą asystentów AI.

## Szybki kontekst (dla agentów i nowych devów)

### Stos
- **Frontend**: Next.js 15 (App Router) + React 19.
- **Backend**: Convex (queries, mutations, actions).
- **Auth**: Clerk (Organizations mapowane na wewnętrzne encje organizacyjne).
- **Billing**: Stripe.
- **UI**: Tailwind CSS + shadcn/ui.

### Model domeny (Convex)
*Autorytatywnie: `convex/schema.ts`.*

1. **Legacy nazewnictwo backendu**: utrzymane dla kompatybilności, nie traktuj go jako pozycjonowania produktu.
2. **Pozycjonowanie produktu**: habits-first (nawyki, rutyny, streaki, check-iny, accountability).
3. **AI**: wątki i wiadomości + tracking użycia tokenów.

### Ważne ścieżki
- `app/`: trasy Next.js (App Router).
- `app/(main)/page.tsx`: landing marketingowy.
- `components/ui/landing/`: komponenty landing page.
- `convex/`: logika backendu i schema.
- `components/`: komponenty UI i feature.
- `app/globals.css`: tokeny tematu (beige/ink).

## Uruchomienie lokalnie

### Wymagania
- Node.js 20+
- pnpm (zalecane)
- Konta: Convex, Clerk, Stripe

### Instalacja
```bash
pnpm install
```

### Konfiguracja środowiska
Utwórz `.env.local` i dodaj klucze dla Clerk, Convex, OpenAI, Stripe oraz storage (R2/S3).

### Dev
```bash
pnpm dev
```
To uruchamia równolegle Next.js i Convex.

### Lint
```bash
pnpm lint
```

## Skrypty
- `pnpm dev`: frontend + backend równolegle
- `pnpm dev:frontend`: Next.js na `0.0.0.0:3000`
- `pnpm dev:backend`: Convex dev
- `pnpm build`: build produkcyjny
- `pnpm start`: start produkcyjny
- `pnpm elo`: lokalny skrypt w `./elo`

## Licencja
MIT — zobacz `LICENSE`.
