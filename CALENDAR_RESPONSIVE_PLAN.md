# Plan Responsywności Kalendarza - VibePlanner

## Cel
Zapewnienie pełnej responsywności wszystkich komponentów kalendarza na wszystkich urządzeniach: mobile (320px-640px), tablet (640px-1024px) i desktop (1024px+).

---

## 1. ProjectCalendar.tsx (Główny Komponent Projektu)

### Stan obecny:
- Podstawowa struktura z flex layoutem
- Stałe wysokości kalkulowane (`h-[calc(100vh-73px-120px)]`)
- Brak dedykowanych breakpointów mobilnych

### Do poprawy:

#### Mobile (< 640px):
- [ ] Sidebar (TaskSidebar) powinien zajmować pełny ekran na mobile
- [ ] Zredukować padding w nagłówku z `p-4` do `p-2`
- [ ] Ukryć długie nazwy projektów lub skrócić je
- [ ] Dostosować wysokość kalendarza do mniejszych ekranów
- [ ] Zmniejszyć font-size nagłówka z `text-xl` do `text-lg`

#### Tablet (640px - 1024px):
- [ ] Sidebar powinien być w formie slide-in panel o szerokości 50-60%
- [ ] Zachować normalne padddingi
- [ ] Upewnić się, że GanttHeader się nie łamie

#### Desktop (> 1024px):
- [x] Obecna implementacja jest OK
- [ ] Rozważyć większą szerokość sidebara (obecnie domyślna)

---

## 2. Calendar.tsx (Główny Komponent Kalendarza)

### Stan obecny:
- Działa z różnymi widokami (day, week, month, year)
- Podstawowa responsywność
- Modal DayEventsModal

### Do poprawy:

#### Mobile (< 640px):
- [ ] TaskSidebar powinien być pełnoekranowy z animacją slide-up
- [ ] DayEventsModal również pełnoekranowy
- [ ] Zwiększyć touch targets dla eventów (min 44px wysokości)
- [ ] Dodać swipe gestures dla nawigacji między datami

#### Tablet (640px - 1024px):
- [ ] Sidebary jako overlay z backdrop
- [ ] Modal 80% szerokości ekranu
- [ ] Normalne touch targets

#### Desktop (> 1024px):
- [x] Obecna implementacja jest OK

---

## 3. CalendarHeader.tsx (Nawigacja i Filtry)

### Stan obecny:
- Częściowo responsywny
- Desktop filtry widoczne
- Mobile filtry w Sheet (drawer)
- Przełącznik widoków w osobnej sekcji dla mobile

### Do poprawy:

#### Mobile (< 640px):
- [x] Filtry w Sheet - zaimplementowane
- [x] Przełącznik widoku w osobnej sekcji - zaimplementowane
- [ ] Zredukować rozmiar ikon z `h-5 w-5` do `h-4 w-4`
- [ ] Skrócić tekst "Today" do "Now" - ZAIMPLEMENTOWANE
- [ ] Zmniejszyć odstępy między przyciskami
- [ ] Ukryć tooltip z skrótami klawiszowymi na mobile
- [ ] Zoptymalizować wysokość sekcji filtrów (aktualnie dość wysoka)
- [ ] Dodać sticky positioning dla headera przy scrollowaniu
- [ ] Zredukować padding nagłówka z `p-4` do `p-2`
- [ ] Logo może być mniejsze na mobile

#### Tablet (640px - 1024px):
- [ ] Pokazać więcej elementów nawigacji
- [ ] Opcjonalnie pokazać niektóre filtry inline zamiast w Sheet
- [ ] Zmniejszyć tooltip do bardziej kompaktowej formy

#### Desktop (> 1024px):
- [x] Obecna implementacja jest dobra
- [ ] Rozważyć sticky header przy długim scrollowaniu

---

## 4. DayView.tsx (Widok Dnia)

### Stan obecny:
- Stała kolumna czasu (64px / `w-16`)
- Stała wysokość godziny (60px)
- Sekcja all-day events
- Overlay z eventami

### Do poprawy:

#### Mobile (< 640px):
- [ ] Zmniejszyć szerokość kolumny czasu z `w-16` do `w-12` (48px)
- [ ] Zmniejszyć rozmiar czcionki czasu z `text-xs` do `text-[10px]`
- [ ] Zmniejszyć wysokość godziny z 60px do 40px
- [ ] Eventy: zmniejszyć padding z `p-1 px-2` do `p-0.5 px-1`
- [ ] Tytuły eventów: zmniejszyć font z `text-xs` do `text-[10px]`
- [ ] All-day events: zmniejszyć padding sekcji
- [ ] Umożliwić horizontal scroll jeśli potrzebne
- [ ] Dotknięcie eventu powinno otwierać pełnoekranowy modal zamiast sidebara

#### Tablet (640px - 1024px):
- [ ] Zachować w-16 dla kolumny czasu
- [ ] Wysokość godziny: 50px (kompromis)
- [ ] Normalne rozmiary fontów

#### Desktop (> 1024px):
- [x] Obecna implementacja jest OK
- [ ] Rozważyć powiększenie wysokości godziny do 80px dla lepszej czytelności

---

## 5. WeekView.tsx (Widok Tygodnia)

### Stan obecny:
- 7 kolumn dla dni tygodnia
- Stała kolumna czasu
- Header z nazwami dni
- All-day events w headerze każdego dnia

### Do poprawy:

#### Mobile (< 640px):
- [ ] **KRYTYCZNE**: Zmienić na horizontal scroll z 2-3 widocznymi dniami naraz
- [ ] Alternatywnie: pokazać tylko jeden dzień na raz z swipe navigation
- [ ] Zmniejszyć szerokość kolumny czasu do `w-10` (40px)
- [ ] Zmniejszyć wysokość godziny do 40px
- [ ] Header dni: zmniejszyć padding z `p-3` do `p-1.5`
- [ ] Nazwy dni: skrócić do 1 litery (M, T, W, T, F, S, S)
- [ ] Numer dnia: zmniejszyć z `text-2xl` do `text-lg`
- [ ] All-day events: pokazać tylko liczbę eventów, nie listę
- [ ] Touch targets dla eventów: minimum 40px
- [ ] Usunąć lub zmniejszyć weekend background highlighting

#### Tablet (640px - 1024px):
- [ ] Pokazać 5 dni roboczych z horizontal scroll dla weekendu
- [ ] Lub: pokazać pełny tydzień ze zmniejszonymi kolumnami
- [ ] Zachować 2-literowe nazwy dni (Mo, Tu, We...)
- [ ] Wysokość godziny: 50px
- [ ] All-day events: pokazać 1-2 pierwsze, resztę jako "+X more"

#### Desktop (> 1024px):
- [x] Obecna implementacja jest dobra
- [ ] Opcjonalnie: umożliwić przełączanie między 5-dniowym a 7-dniowym widokiem

---

## 6. YearView.tsx (Widok Roku)

### Stan obecny:
- Grid z 12 miesiącami
- Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Mini kalendarz dla każdego miesiąca
- Wskaźniki eventów (kropki)

### Do poprawy:

#### Mobile (< 640px):
- [ ] Zwiększyć rozmiar mini kalendarzy (aktualnie mogą być za małe)
- [ ] Zmniejszyć padding kontenera głównego z `p-4` do `p-2`
- [ ] Zwiększyć odstęp między miesiącami dla lepszej czytelności
- [ ] Header roku: zmniejszyć z `text-4xl` do `text-2xl`
- [ ] Badge "Current Year": zmniejszyć rozmiar
- [ ] Click target na dni: zwiększyć do minimum 44px
- [ ] Legendę przenieść do sticky bottom lub ukryć (pokazać jako tooltip)
- [ ] Rozważyć pokazanie 1 kolumny miesięcy zamiast 2 dla bardzo małych ekranów

#### Tablet (640px - 1024px):
- [ ] 2 kolumny miesięcy - obecnie OK
- [ ] Możliwe zwiększenie rozmiaru fontów
- [ ] Zwiększyć padding kart miesięcy

#### Desktop (> 1024px):
- [x] Obecna implementacja jest dobra (3-4 kolumny)
- [ ] Opcjonalnie: hover states bardziej widoczne

---

## 7. MonthView.tsx (Widok Miesiąca - nie widziałem w plikach, ale jest używany)

### Do sprawdzenia i poprawy:

#### Mobile (< 640px):
- [ ] Sprawdzić czy istnieje MonthView.tsx
- [ ] Grid tygodniowy powinien mieć odpowiednie rozmiary komórek
- [ ] Nazwy dni: skrócić do 1-2 liter
- [ ] Eventy: pokazać jako kropki lub pojedyncze znaki
- [ ] Modal "więcej eventów" powinien być pełnoekranowy
- [ ] Click targets minimum 44px dla każdego dnia

#### Tablet (640px - 1024px):
- [ ] Normalna siatka z większymi komórkami
- [ ] Pokazać 2-3 pierwsze eventy, resztę jako "+X"

#### Desktop (> 1024px):
- [ ] Pełna funkcjonalność z listą eventów

---

## 8. Sidebary i Modale

### TaskSidebar:

#### Mobile (< 640px):
- [ ] Pełnoekranowy modal z animacją slide-up
- [ ] Przycisk zamknij wyraźnie widoczny (X w prawym górnym rogu)
- [ ] Scroll wewnętrzny dla długiej zawartości
- [ ] Padding zoptymalizowany dla małych ekranów
- [ ] Formularz: duże inputy (min 44px wysokości)

#### Tablet (640px - 1024px):
- [ ] Slide-in panel z prawej strony (50-60% szerokości)
- [ ] Backdrop z blur
- [ ] Normalne rozmiary elementów

#### Desktop (> 1024px):
- [ ] Sidebar z prawej (aktualna implementacja)
- [ ] Szerokość: 400-500px

### DayEventsModal:

#### Mobile (< 640px):
- [ ] Pełnoekranowy modal
- [ ] Lista eventów z dużymi click targets
- [ ] Scroll dla długiej listy
- [ ] Przycisk zamknij wyraźny

#### Tablet (640px - 1024px):
- [ ] Modal 80% szerokości, wyśrodkowany
- [ ] Backdrop

#### Desktop (> 1024px):
- [ ] Modal 60% szerokości, wyśrodkowany

---

## 9. Touch i Gesture Support

### Do zaimplementowania:

- [ ] Swipe left/right dla nawigacji między datami (wszystkie widoki)
- [ ] Pinch to zoom dla week/month view (opcjonalnie)
- [ ] Long press na event dla opcji edycji/usuwania
- [ ] Pull to refresh dla odświeżenia danych (opcjonalnie)
- [ ] Touch feedback (ripple effect) na wszystkich interaktywnych elementach
- [ ] Prevent default scroll behavior podczas przeciągania eventów

---

## 10. Performance Optimizations

### Do zaimplementowania:

- [ ] Lazy loading dla komponentów widoków
- [ ] Virtual scrolling dla long lists (DayView, WeekView)
- [ ] Memo dla expensive calculations w useMemo/useCallback
- [ ] Debounce dla filtrów wyszukiwania
- [ ] Optimize re-renders przy zmianie filtrów
- [ ] Image lazy loading jeśli są zdjęcia użytkowników

---

## 11. Breakpoint Strategy

### Tailwind CSS Breakpoints:
```
sm: 640px   - Small tablets, large phones
md: 768px   - Tablets
lg: 1024px  - Laptops, small desktops
xl: 1280px  - Desktops
2xl: 1536px - Large desktops
```

### Custom Breakpoints dla kalendarza:
```
mobile:   < 640px   - Phone portrait/landscape
tablet:   640-1024px - Tablet portrait/landscape
desktop:  > 1024px   - Laptop and above
```

---

## 12. Testing Checklist

### Devices to test:
- [ ] iPhone SE (375px) - smallest modern phone
- [ ] iPhone 12/13/14 (390px)
- [ ] iPhone 14 Plus (428px)
- [ ] iPad Mini (768px)
- [ ] iPad Pro (1024px)
- [ ] Desktop (1920px)
- [ ] Large Desktop (2560px)

### Orientations:
- [ ] Portrait mode (wszystkie urządzenia)
- [ ] Landscape mode (wszystkie urządzenia)

### Browsers:
- [ ] Safari (iOS)
- [ ] Chrome (Android)
- [ ] Firefox (Desktop)
- [ ] Safari (macOS)
- [ ] Edge (Windows)

---

## 13. Priority Levels

### 🔴 High Priority (Critical for MVP):
1. CalendarHeader - mobile filtry i nawigacja
2. WeekView - horizontal scroll na mobile
3. DayView - zmniejszone rozmiary na mobile
4. MonthView - basic responsiveness
5. Sidebary - pełnoekranowe na mobile

### 🟡 Medium Priority (Important for UX):
1. YearView - optymalizacja mobile
2. Touch gestures - swipe navigation
3. Sticky headers przy scrollowaniu
4. All-day events handling na mobile
5. Performance optimizations

### 🟢 Low Priority (Nice to have):
1. Advanced gestures (pinch to zoom)
2. Pull to refresh
3. Animation enhancements
4. Advanced hover states
5. Large desktop optimizations

---

## 14. Implementation Order

### Sprint 1 (Week 1) - Critical Mobile:
1. CalendarHeader mobile optimizations
2. DayView mobile layout
3. MonthView responsive grid
4. TaskSidebar full-screen mobile

### Sprint 2 (Week 2) - Views:
1. WeekView horizontal scroll
2. YearView mobile optimization
3. DayEventsModal responsive
4. Touch gestures podstawowe

### Sprint 3 (Week 3) - Polish & Test:
1. Performance optimizations
2. Testing na prawdziwych urządzeniach
3. Bug fixes
4. Edge cases
5. Documentation

---

## 15. CSS Utilities do dodania

### Wspólne klasy responsywne:
```css
/* Mobile-first touch targets */
.touch-target {
  @apply min-h-[44px] min-w-[44px];
}

/* Responsive text sizes */
.text-responsive-sm {
  @apply text-xs sm:text-sm md:text-base;
}

.text-responsive-md {
  @apply text-sm sm:text-base md:text-lg;
}

.text-responsive-lg {
  @apply text-base sm:text-lg md:text-xl;
}

/* Responsive spacing */
.spacing-responsive {
  @apply p-2 sm:p-3 md:p-4;
}

/* Full screen modal for mobile */
.modal-mobile-fullscreen {
  @apply fixed inset-0 z-50 sm:relative sm:inset-auto;
}

/* Sidebar responsive */
.sidebar-responsive {
  @apply fixed inset-0 z-40 sm:relative sm:w-96 md:w-[28rem];
}
```

---

## 16. Accessibility Considerations

- [ ] Wszystkie interaktywne elementy mają wystarczający contrast ratio (WCAG AA)
- [ ] Touch targets minimum 44x44px
- [ ] Keyboard navigation działa poprawnie
- [ ] Screen reader labels dla wszystkich akcji
- [ ] Focus states wyraźnie widoczne
- [ ] Skip to content links
- [ ] ARIA labels dla złożonych komponentów

---

## 17. Notes & Considerations

1. **Overflow Handling**: Upewnić się, że żaden element nie powoduje horizontal scroll na mobile
2. **Font Scaling**: Respektować ustawienia accessibility dla wielkości czcionki
3. **Dark Mode**: Sprawdzić czy wszystkie zmiany działają w trybie ciemnym
4. **Loading States**: Skeletony powinny też być responsywne
5. **Error States**: Komunikaty błędów powinny być czytelne na małych ekranach
6. **Network**: Rozważyć offline mode dla podstawowych funkcji kalendarza

---

## 18. Dependencies & Tools

### Potrzebne biblioteki:
- `react-swipeable` lub własne touch handlers
- `react-virtual` dla virtual scrolling (jeśli potrzebne)
- `@use-gesture/react` dla zaawansowanych gesturesów (opcjonalnie)

### Development tools:
- Chrome DevTools Device Mode
- React Developer Tools
- Lighthouse dla performance audit
- Accessibility Insights

---

## Status: 📋 PLAN GOTOWY DO IMPLEMENTACJI

**Utworzono**: 31 października 2025
**Autor**: AI Assistant
**Status**: Oczekuje na zatwierdzenie i rozpoczęcie implementacji

