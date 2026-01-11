/**
 * Workflow Loader
 * 
 * Loads and parses workflow definitions from .md files.
 * Since Convex actions run on the server, we need to import workflows
 * at build time or load them from storage.
 * 
 * This module provides:
 * 1. Pre-loaded workflow definitions (imported at build time)
 * 2. Functions to get workflow metadata and full definitions
 */

import type {
  WorkflowDefinition,
  WorkflowMetadata,
  WorkflowStep,
  WorkflowIcon,
  WorkflowFileType,
} from "./types";

// ============================================
// WORKFLOW DEFINITIONS
// ============================================

/**
 * Pre-defined workflows loaded at build time
 * In a production app, these could be loaded from:
 * - File storage (Convex storage)
 * - A dedicated table in the database
 * - External CMS
 */
export const WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "floor-plan-analysis",
    name: "Analiza Rzutu Mieszkania",
    description: "Kompleksowa analiza rzutu z identyfikacją pomieszczeń, wymiarów i generowaniem listy zadań remontowych.",
    icon: "floor-plan" as WorkflowIcon,
    category: "analysis",
    requiredFileTypes: ["image", "pdf"] as WorkflowFileType[],
    fileRequired: true,
    estimatedMinutes: 15,
    steps: [
      {
        id: "upload",
        name: "Wgraj Rzut",
        prompt: null,
        requiresUpload: true,
        description: "Wgraj plik z rzutem mieszkania (zdjęcie, skan lub PDF).",
      },
      {
        id: "room-analysis",
        name: "Analiza Pomieszczeń",
        prompt: `Przeanalizuj wgrany rzut mieszkania i zidentyfikuj:

1. **Pomieszczenia**: Wymień wszystkie widoczne pomieszczenia z ich przybliżonymi wymiarami (jeśli skala jest widoczna).

2. **Układ funkcjonalny**: Oceń rozkład pomieszczeń pod kątem:
   - Komunikacji między pomieszczeniami
   - Dostępu do światła naturalnego
   - Funkcjonalności dla rodziny

3. **Potencjalne problemy**: Zidentyfikuj ewentualne problemy jak:
   - Ciasne przejścia
   - Brak wentylacji
   - Niewygodne połączenia funkcjonalne

Przedstaw analizę w przejrzystej formie punktowej.`,
        description: "AI przeanalizuje rzut i zidentyfikuje pomieszczenia.",
        enabledTools: ["create_note"],
      },
      {
        id: "renovation-scope",
        name: "Zakres Remontu",
        prompt: `Na podstawie poprzedniej analizy rzutu, pomóż użytkownikowi określić zakres remontu:

1. Zapytaj które pomieszczenia mają być remontowane
2. Zaproponuj typowe prace dla każdego wybranego pomieszczenia:
   - Ściany (malowanie, tapetowanie, panele)
   - Podłogi (wymiana, cyklinowanie)
   - Instalacje (elektryka, hydraulika)
   - Stolarka (drzwi, okna)

Stwórz wstępną listę zadań jako tasks w projekcie.`,
        description: "Określ zakres prac remontowych dla wybranych pomieszczeń.",
        enabledTools: ["create_task", "create_multiple_tasks"],
      },
      {
        id: "material-list",
        name: "Lista Materiałów",
        prompt: `Na podstawie zdefiniowanego zakresu remontu, przygotuj wstępną listę materiałów:

1. Dla każdego pomieszczenia i rodzaju prac wypisz potrzebne materiały
2. Oszacuj ilości na podstawie przybliżonych wymiarów z rzutu
3. Podziel materiały na kategorie (budowlane, wykończeniowe, elektryczne, hydrauliczne)

Dodaj materiały do listy zakupów projektu z odpowiednimi sekcjami.`,
        description: "Wygeneruj listę materiałów budowlanych i wykończeniowych.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items", "create_shopping_section"],
      },
      {
        id: "schedule",
        name: "Harmonogram",
        prompt: `Stwórz proponowany harmonogram prac remontowych:

1. Uporządkuj zadania w logicznej kolejności (np. najpierw instalacje, potem wykończenia)
2. Oszacuj czas trwania każdego etapu
3. Uwzględnij czas schnięcia, wietrzenia itp.
4. Zaproponuj podział na etapy tygodniowe

Zaktualizuj daty w utworzonych wcześniej zadaniach aby odzwierciedlały harmonogram.`,
        description: "Zaplanuj kolejność i terminy prac.",
        enabledTools: ["edit_task", "edit_multiple_tasks"],
      },
    ],
    content: `# Analiza Rzutu Mieszkania

Ten workflow pomoże Ci kompleksowo przeanalizować rzut mieszkania i zaplanować remont.

## Co otrzymasz?
- Szczegółową analizę pomieszczeń i ich funkcjonalności
- Listę zadań remontowych dopasowaną do Twojego rzutu
- Listę materiałów z oszacowanymi ilościami
- Proponowany harmonogram prac`,
  },
  {
    id: "kitchen-renovation",
    name: "Remont Kuchni",
    description: "Kompletny przewodnik po remoncie kuchni - od planowania układu po listę zakupów.",
    icon: "kitchen" as WorkflowIcon,
    category: "renovation",
    requiredFileTypes: ["image", "pdf"] as WorkflowFileType[],
    fileRequired: false,
    estimatedMinutes: 20,
    steps: [
      {
        id: "current-state",
        name: "Stan Obecny",
        prompt: `Pomóżmy zaplanować remont kuchni. Na początek zbierzmy informacje o obecnym stanie:

Zapytaj użytkownika o:
1. Wymiary kuchni (długość × szerokość)
2. Obecny układ (aneks, oddzielna kuchnia, z wyspą)
3. Co najbardziej przeszkadza w obecnej kuchni?
4. Czy są jakieś elementy do zachowania (np. okno, drzwi, instalacje)?

Jeśli użytkownik wgrał zdjęcie/rzut, przeanalizuj go i zadaj doprecyzowujące pytania.`,
        description: "Opowiedz o obecnej kuchni i jej problemach.",
        requiresUpload: false,
      },
      {
        id: "layout-planning",
        name: "Planowanie Układu",
        prompt: `Na podstawie zebranych informacji, zaproponuj optymalny układ kuchni:

1. **Trójkąt roboczy**: Zaproponuj rozmieszczenie lodówki, zlewu i kuchenki
2. **Strefa przechowywania**: Gdzie umieścić szafki górne i dolne
3. **Blat roboczy**: Ile powierzchni roboczej będzie dostępne
4. **AGD**: Gdzie zmieszczą się duże sprzęty (zmywarka, piekarnik, mikrofalówka)

Stwórz notatkę z proponowanym układem.`,
        description: "Zaplanuj nowy układ kuchni.",
        enabledTools: ["create_note"],
      },
      {
        id: "style-selection",
        name: "Wybór Stylu",
        prompt: `Pomóż użytkownikowi wybrać styl wykończenia kuchni:

1. **Fronty szafek**: 
   - Nowoczesne (gładkie, matowe/połysk)
   - Klasyczne (ramkowe, frezowane)
   - Skandynawskie (drewno, biel)

2. **Blat**:
   - Laminat (ekonomiczny)
   - Konglomerat kwarcowy (trwały)
   - Drewno (naturalne, wymaga pielęgnacji)
   - Kamień naturalny (premium)

3. **Płytki/ściana nad blatem**:
   - Klasyczne kafelki
   - Szkło hartowane
   - Panel ścienny

Zapisz wybory użytkownika jako notatkę ze specyfikacją.`,
        description: "Wybierz styl i materiały wykończeniowe.",
        enabledTools: ["create_note"],
      },
      {
        id: "appliances",
        name: "Sprzęt AGD",
        prompt: `Przygotuj listę sprzętów AGD do kuchni:

1. **Niezbędne**:
   - Płyta grzewcza (indukcja/gaz/elektryczna)
   - Piekarnik (do zabudowy/wolnostojący)
   - Okap (teleskopowy/wyspowy/do zabudowy)
   - Lodówka (do zabudowy/wolnostojąca)
   - Zmywarka

2. **Opcjonalne**:
   - Mikrofalówka
   - Ekspres do kawy
   - Robot kuchenny

Dodaj wybrane sprzęty do listy zakupów z orientacyjnymi cenami.`,
        description: "Zaplanuj sprzęty AGD.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items", "create_shopping_section"],
      },
      {
        id: "materials-budget",
        name: "Materiały i Budżet",
        prompt: `Przygotuj kompletną listę materiałów i oszacuj budżet:

1. **Meble kuchenne** (szafki, fronty, uchwyty)
2. **Blaty**
3. **Zlew i bateria**
4. **Oświetlenie** (główne + podszafkowe)
5. **Płytki/panele ścienne**
6. **Farba/tapeta** (jeśli dotyczy)
7. **Materiały instalacyjne** (elektryka, hydraulika)

Dla każdej kategorii podaj szacunkowy koszt i dodaj do listy zakupów.
Na koniec podsumuj całkowity budżet.`,
        description: "Stwórz kompletną listę zakupów z budżetem.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items", "create_shopping_section"],
      },
      {
        id: "tasks-schedule",
        name: "Zadania i Harmonogram",
        prompt: `Stwórz listę zadań remontowych dla kuchni w odpowiedniej kolejności:

1. **Przygotowanie** (1-2 dni):
   - Demontaż starych mebli
   - Zabezpieczenie podłóg i innych pomieszczeń

2. **Instalacje** (3-5 dni):
   - Prace elektryczne (nowe punkty, oświetlenie)
   - Prace hydrauliczne (przesunięcia, nowe przyłącza)

3. **Wykończenie ścian** (2-3 dni):
   - Gładzie/tynki
   - Malowanie/kafelkowanie

4. **Montaż mebli** (1-2 dni):
   - Szafki dolne i górne
   - Blaty

5. **AGD i wykończenie** (1-2 dni):
   - Podłączenie sprzętów
   - Montaż oświetlenia
   - Sprzątanie

Utwórz zadania z przypisanymi datami.`,
        description: "Zaplanuj prace i harmonogram.",
        enabledTools: ["create_task", "create_multiple_tasks"],
      },
    ],
    content: `# Remont Kuchni

Kompleksowy przewodnik który przeprowadzi Cię przez cały proces planowania remontu kuchni.`,
  },
  {
    id: "bathroom-renovation",
    name: "Remont Łazienki",
    description: "Od demontażu do wykończenia - zaplanuj remont łazienki krok po kroku.",
    icon: "bathroom" as WorkflowIcon,
    category: "renovation",
    requiredFileTypes: ["image", "pdf"] as WorkflowFileType[],
    fileRequired: false,
    estimatedMinutes: 20,
    steps: [
      {
        id: "assessment",
        name: "Ocena Stanu",
        prompt: `Rozpocznijmy planowanie remontu łazienki. Zbierzmy informacje:

1. **Wymiary**: Podaj wymiary łazienki (długość × szerokość × wysokość)
2. **Obecne wyposażenie**: Co jest teraz? (wanna/prysznic, WC, umywalka, pralka?)
3. **Instalacje**: Czy wiesz gdzie są piony kanalizacyjne i wodne?
4. **Stan techniczny**: Czy są jakieś problemy (wilgoć, pleśń, przecieki)?
5. **Co zostaje?**: Czy cokolwiek z obecnego wyposażenia zostaje?

Jeśli wgrałeś zdjęcie lub rzut, przeanalizuję je i zadam dodatkowe pytania.`,
        description: "Opowiedz o obecnej łazience.",
        requiresUpload: false,
      },
      {
        id: "layout",
        name: "Nowy Układ",
        prompt: `Na podstawie informacji zaproponuję układ łazienki:

1. **Strefa kąpielowa**: 
   - Wanna (klasyczna, narożna, wolnostojąca)
   - Kabina prysznicowa (walk-in, z brodzikiem, bez brodzika)
   - Kombinacja wanna + prysznic

2. **Strefa WC**:
   - WC kompakt czy podwieszane?
   - Czy potrzebny bidet lub deska myjąca?

3. **Strefa umywalkowa**:
   - Jedna czy dwie umywalki?
   - Szafka pod umywalkę
   - Lustro (zwykłe czy z oświetleniem?)

4. **Dodatkowe**:
   - Pralka (w łazience czy osobno?)
   - Grzejnik (drabinkowy?)
   - Przechowywanie

Stworzę notatkę z proponowanym układem.`,
        description: "Zaplanuj nowy układ łazienki.",
        enabledTools: ["create_note"],
      },
      {
        id: "finishes",
        name: "Wykończenia",
        prompt: `Wybierzmy materiały wykończeniowe:

1. **Płytki podłogowe**:
   - Rozmiar (30x30, 60x60, inne)
   - Typ (gres, terakota)
   - Styl (imitacja drewna, kamienia, jednolite)

2. **Płytki ścienne**:
   - Do jakiej wysokości kafelki? (do sufitu, 2m, półścianka)
   - Mozaika jako akcent?

3. **Sufit**:
   - Malowanie
   - Panele PCV
   - Sufit podwieszany

4. **Kolorystyka**:
   - Jasna/minimalistyczna
   - Ciemna/dramatyczna  
   - Ciepła/naturalna

Zapiszę specyfikację wykończeń.`,
        description: "Wybierz płytki i wykończenia.",
        enabledTools: ["create_note"],
      },
      {
        id: "fixtures",
        name: "Armatura i Ceramika",
        prompt: `Przygotujmy listę armatury i ceramiki:

**Ceramika**:
- WC (marka, model, cena orientacyjna)
- Umywalka/umywalki
- Wanna lub brodzik

**Armatura**:
- Bateria umywalkowa
- Bateria wannowa/prysznicowa
- Deszczownica / słuchawka
- Odpływy

**Dodatki**:
- Lustro
- Szafka łazienkowa
- Akcesoria (wieszaki, mydelniczki, uchwyt na papier)

Dodam wszystko do listy zakupów z podziałem na kategorie.`,
        description: "Wybierz armaturę i ceramikę sanitarną.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items", "create_shopping_section"],
      },
      {
        id: "materials",
        name: "Materiały Budowlane",
        prompt: `Lista materiałów budowlanych potrzebnych do remontu:

**Przygotowanie podłoża**:
- Klej do płytek (ile kg na m²)
- Fuga (kolor, ilość)
- Hydroizolacja (pod prysznic/wannę)
- Zaprawa wyrównująca (jeśli potrzebna)

**Instalacje**:
- Rury (PEX/PP do wody)
- Kanalizacja (rury, kolanka, redukcje)
- Stelaż WC (jeśli podwieszany)
- Przewody elektryczne (przekrój)

**Wykończenie**:
- Silikon sanitarny
- Listwy/profile
- Farba (jeśli sufit malowany)

Obliczę ilości na podstawie wymiarów i dodam do listy zakupów.`,
        description: "Lista materiałów budowlanych.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items"],
      },
      {
        id: "execution-plan",
        name: "Plan Wykonania",
        prompt: `Stwórzmy szczegółowy harmonogram prac:

**Etap 1: Demontaż** (1-2 dni)
- Demontaż starej ceramiki
- Skucie płytek
- Wywóz gruzu

**Etap 2: Instalacje** (2-4 dni)
- Hydraulika (nowe punkty wodne i kanalizacyjne)
- Elektryka (oświetlenie, wentylator, gniazdka)
- Montaż stelaża WC

**Etap 3: Hydroizolacja i tynki** (2-3 dni)
- Wyrównanie ścian
- Hydroizolacja strefy mokrej
- Schnięcie

**Etap 4: Płytki** (3-5 dni)
- Układanie płytek ściennych
- Układanie płytek podłogowych
- Fugowanie

**Etap 5: Montaż i wykończenie** (2-3 dni)
- Biały montaż (ceramika, armatura)
- Montaż mebli i akcesoriów
- Sprzątanie i odbiór

Stworzę zadania z terminami.`,
        description: "Harmonogram prac remontowych.",
        enabledTools: ["create_task", "create_multiple_tasks"],
      },
    ],
    content: `# Remont Łazienki

Kompleksowy kreator który pomoże Ci zaplanować remont łazienki od A do Z.`,
  },
  {
    id: "visualization-review",
    name: "Przegląd Wizualizacji",
    description: "Przeanalizuj wizualizację wnętrza, zbierz feedback i stwórz listę zakupów na podstawie projektu.",
    icon: "visualization" as WorkflowIcon,
    category: "design",
    requiredFileTypes: ["image", "pdf"] as WorkflowFileType[],
    fileRequired: true,
    estimatedMinutes: 15,
    steps: [
      {
        id: "upload",
        name: "Wgraj Wizualizację",
        prompt: null,
        requiresUpload: true,
        description: "Wgraj wizualizację 3D lub projekt wnętrza (obraz lub PDF).",
      },
      {
        id: "analysis",
        name: "Analiza Wizualizacji",
        prompt: `Przeanalizuj wgraną wizualizację wnętrza:

1. **Pomieszczenie**: Jakiego typu jest to wnętrze? (salon, sypialnia, kuchnia, etc.)

2. **Styl**: Określ styl wnętrza:
   - Nowoczesny / Minimalistyczny
   - Skandynawski
   - Industrialny
   - Klasyczny / Hampton
   - Boho / Eklektyczny
   - Inny

3. **Kolorystyka**: Opisz paletę kolorów:
   - Kolory dominujące
   - Akcenty kolorystyczne
   - Materiały i tekstury

4. **Główne elementy**: Wymień widoczne elementy wyposażenia:
   - Meble
   - Oświetlenie
   - Dodatki dekoracyjne
   - Rośliny

Przedstaw analizę w czytelnej formie.`,
        description: "AI przeanalizuje wizualizację i zidentyfikuje elementy.",
        enabledTools: ["create_note"],
      },
      {
        id: "feedback",
        name: "Feedback i Uwagi",
        prompt: `Pomóż zebrać feedback do wizualizacji:

1. **Co się podoba?** - Zapytaj użytkownika jakie elementy projektu są trafione

2. **Co zmienić?** - Jakie elementy wymagają poprawy lub zmiany:
   - Układ mebli
   - Kolorystyka
   - Oświetlenie
   - Konkretne meble/dodatki

3. **Pytania do projektanta**: Sformułuj pytania/uwagi do przekazania projektantowi

Stwórz notatkę z feedbackiem do projektu.`,
        description: "Zbierz uwagi i sugestie zmian.",
        enabledTools: ["create_note"],
      },
      {
        id: "shopping-list",
        name: "Lista Zakupów",
        prompt: `Na podstawie analizy wizualizacji, stwórz listę elementów do zakupu:

**Dla każdego widocznego elementu podaj:**
- Nazwa / opis produktu
- Kategoria (meble, oświetlenie, tekstylia, dekoracje)
- Przybliżony zakres cenowy
- Gdzie szukać (typ sklepu: IKEA, premium, vintage, etc.)

**Kategoryzuj elementy:**
1. Meble główne (sofa, stół, łóżko)
2. Meble pomocnicze (stoliki, regały, komody)
3. Oświetlenie
4. Tekstylia (dywany, zasłony, poduszki)
5. Dekoracje i dodatki
6. Rośliny

Dodaj wszystkie elementy do listy zakupów z odpowiednimi sekcjami.`,
        description: "Stwórz listę elementów wyposażenia do zakupu.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items", "create_shopping_section"],
      },
      {
        id: "tasks",
        name: "Zadania Realizacyjne",
        prompt: `Stwórz listę zadań potrzebnych do zrealizowania wizualizacji:

1. **Przygotowanie**:
   - Wymiarowanie pomieszczenia
   - Zamówienie próbek materiałów
   - Wizyta w showroomach

2. **Zamówienia**:
   - Meble z długim czasem realizacji (pierwsze!)
   - Oświetlenie
   - Tekstylia
   - Dekoracje

3. **Realizacja**:
   - Ewentualne prace remontowe
   - Malowanie
   - Dostawa i montaż mebli
   - Aranżacja dodatków

Utwórz zadania z proponowanymi terminami i kolejnością.`,
        description: "Zaplanuj realizację projektu.",
        enabledTools: ["create_task", "create_multiple_tasks"],
      },
    ],
    content: `# Przegląd Wizualizacji

Workflow do analizy wizualizacji wnętrza i przekształcenia projektu w konkretną listę zakupów i zadań.`,
  },
  {
    id: "material-estimation",
    name: "Wycena Materiałów",
    description: "Oblicz ilości i koszty materiałów budowlanych na podstawie wymiarów pomieszczenia.",
    icon: "materials" as WorkflowIcon,
    category: "planning",
    requiredFileTypes: ["image", "pdf"] as WorkflowFileType[],
    fileRequired: false,
    estimatedMinutes: 10,
    steps: [
      {
        id: "dimensions",
        name: "Wymiary Pomieszczenia",
        prompt: `Zbierzmy informacje o pomieszczeniu do wyceny materiałów:

**Wymiary podstawowe:**
1. Długość pomieszczenia (w metrach)
2. Szerokość pomieszczenia (w metrach)  
3. Wysokość pomieszczenia (standardowo 2.5m lub 2.7m)

**Otwory:**
4. Ile okien i jakie wymiary? (np. 1.5m × 1.2m)
5. Ile drzwi i jakie wymiary? (standardowe 0.9m × 2m)

**Dodatkowe:**
6. Czy są jakieś wnęki, skosy lub nietypowe elementy?

Jeśli wgrałeś rzut/zdjęcie, przeanalizuję je i dopytam o szczegóły.`,
        description: "Podaj wymiary pomieszczenia.",
        requiresUpload: false,
      },
      {
        id: "scope",
        name: "Zakres Prac",
        prompt: `Jakie prace planujesz? Zaznacz wszystkie które dotyczą:

**Ściany:**
- [ ] Malowanie
- [ ] Gładź/szpachlowanie
- [ ] Tapetowanie
- [ ] Płytki ceramiczne
- [ ] Panele ścienne

**Podłoga:**
- [ ] Panele laminowane
- [ ] Deska/parkiet
- [ ] Płytki
- [ ] Wykładzina
- [ ] Wylewka samopoziomująca

**Sufit:**
- [ ] Malowanie
- [ ] Sufit podwieszany (karton-gips)
- [ ] Panele sufitowe

**Instalacje:**
- [ ] Elektryka (ile punktów?)
- [ ] Oświetlenie (ile źródeł?)

Zapisz zakres prac jako notatkę.`,
        description: "Określ jakie prace będą wykonywane.",
        enabledTools: ["create_note"],
      },
      {
        id: "calculations",
        name: "Obliczenia Ilości",
        prompt: `Na podstawie wymiarów i zakresu prac obliczę potrzebne ilości:

**Wzory używane:**
- Powierzchnia ścian = (2 × długość + 2 × szerokość) × wysokość - okna - drzwi
- Powierzchnia podłogi = długość × szerokość
- Powierzchnia sufitu = długość × szerokość

**Dla materiałów:**
- Farba: ~0.15L/m² (2 warstwy = 0.3L/m²)
- Gładź: ~1.2kg/m² (grubość 2mm)
- Klej do płytek: ~4kg/m²
- Fuga: ~0.5kg/m² (dla płytek 30×30)
- Panele: +10% na rozkrój
- Płytki: +15% na rozkrój i zapas

Przedstawię szczegółowe obliczenia z ilościami.`,
        description: "AI obliczy potrzebne ilości materiałów.",
        enabledTools: ["create_note"],
      },
      {
        id: "shopping-list",
        name: "Lista Zakupów z Cenami",
        prompt: `Stwórzmy listę zakupów z orientacyjnymi cenami:

Dla każdego materiału podam:
- Ilość z zapasem
- Cenę jednostkową (zakres ekonomiczny/średni/premium)
- Szacowany koszt całkowity

**Kategorie:**
1. Materiały podstawowe (farby, gładzie, kleje)
2. Wykończenia (panele, płytki, listwy)
3. Narzędzia i akcesoria (wałki, szpachle, taśmy)
4. Instalacje (jeśli dotyczy)

Na koniec podsumowanie całkowitego kosztu materiałów.

Dodam wszystko do listy zakupów z podziałem na sekcje.`,
        description: "Lista materiałów z cenami i kosztorys.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items", "create_shopping_section"],
      },
    ],
    content: `# Wycena Materiałów

Szybki kalkulator ilości i kosztów materiałów budowlanych.`,
  },
];

// ============================================
// ACCESSOR FUNCTIONS
// ============================================

/**
 * Get all available workflows as metadata (for selector UI)
 */
export function getWorkflowsMetadata(): WorkflowMetadata[] {
  return WORKFLOWS.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    icon: w.icon,
    category: w.category,
    stepCount: w.steps.length,
    estimatedMinutes: w.estimatedMinutes,
    requiredFileTypes: w.requiredFileTypes,
  }));
}

/**
 * Get a specific workflow by ID
 */
export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return WORKFLOWS.find((w) => w.id === id);
}

/**
 * Get workflows filtered by category
 */
export function getWorkflowsByCategory(category: string): WorkflowDefinition[] {
  return WORKFLOWS.filter((w) => w.category === category);
}

/**
 * Get a specific step from a workflow
 */
export function getWorkflowStep(workflowId: string, stepId: string): WorkflowStep | undefined {
  const workflow = getWorkflow(workflowId);
  return workflow?.steps.find((s) => s.id === stepId);
}

/**
 * Get the next step in a workflow
 */
export function getNextStep(workflowId: string, currentStepId: string): WorkflowStep | undefined {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return undefined;
  
  const currentIndex = workflow.steps.findIndex((s) => s.id === currentStepId);
  if (currentIndex === -1 || currentIndex >= workflow.steps.length - 1) {
    return undefined;
  }
  
  return workflow.steps[currentIndex + 1];
}

/**
 * Check if a workflow requires file upload
 */
export function workflowRequiresFile(workflowId: string): boolean {
  const workflow = getWorkflow(workflowId);
  return workflow?.fileRequired ?? false;
}

/**
 * Get all workflow IDs
 */
export function getWorkflowIds(): string[] {
  return WORKFLOWS.map((w) => w.id);
}



