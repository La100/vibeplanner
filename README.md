# VibePlanner

**AI Assistant Workspace for teams**

VibePlanner łączy projekty, zadania, pliki, kalendarze i czat AI w jednym miejscu, żeby zespoły mogły planować i dowozić pracę w pełnym kontekście.

## Szybki kontekst (dla agentów i nowych devów)

### Stos
- **Frontend**: Next.js 15 (App Router) + React 19.
- **Backend**: Convex (queries, mutations, actions).
- **Auth**: Clerk (Organizations mapowane na Teams).
- **Billing**: Stripe.
- **UI**: Tailwind CSS + shadcn/ui.

### Model domeny (Convex)
*Autorytatywnie: `convex/schema.ts`.*

1. **Teams**: top-level org, status subskrypcji, ustawienia.
2. **Projects**: należą do Team; trzymają Tasks/Files/Calendar.
3. **Tasks**: kanban (todo, in_progress, review, done).
4. **Files**: zunifikowane przechowywanie + ekstrakcja/analiza AI.
5. **AI**: wątki i wiadomości + tracking użycia tokenów.

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
