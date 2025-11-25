# 📅 Plan Ulepszeń Kalendarza - VibePlanner

## 🎯 Obecny stan

### ✅ Co działa:
- ✓ Widok miesięczny (MonthView)
- ✓ Nawigacja prev/next/today
- ✓ Filtry (search, type, priority, status)
- ✓ Event cards z priorytetami i statusami
- ✓ TaskSidebar dla szczegółów
- ✓ DayEventsModal dla wielu eventów
- ✓ Responsive design (mobile/desktop)

### ❌ Braki:
- ✗ Tylko jeden miesiąc widoczny
- ✗ Brak widoku tygodniowego (WeekView)
- ✗ Brak widoku dziennego (DayView)
- ✗ Brak widoku rocznego (YearView)
- ✗ Brak przełącznika widoków w UI
- ✗ CalendarProvider ma viewMode ale nie jest używany

---

## 📋 PLAN IMPLEMENTACJI

### **FAZA 1: Przełącznik widoków** ⚡ (1-2h)

#### 1.1 Dodać UI przełącznika do CalendarHeader
```typescript
// Dodać do CalendarHeader.tsx
<div className="flex items-center gap-1 border rounded-lg p-1">
  <Button 
    variant={viewMode === 'day' ? 'default' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('day')}
  >
    Day
  </Button>
  <Button 
    variant={viewMode === 'week' ? 'default' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('week')}
  >
    Week
  </Button>
  <Button 
    variant={viewMode === 'month' ? 'default' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('month')}
  >
    Month
  </Button>
  <Button 
    variant={viewMode === 'year' ? 'default' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('year')}
  >
    Year
  </Button>
</div>
```

#### 1.2 Połączyć z CalendarProvider
- Eksportować `setViewMode` z providera
- Przekazać do CalendarHeader
- Aktualizować stan

**Pliki do zmiany:**
- ✏️ `components/calendar/CalendarHeader.tsx` - dodać przełącznik
- ✏️ `components/calendar/CalendarProvider.tsx` - eksportować setViewMode
- ✏️ `components/calendar/Calendar.tsx` - przekazać props

---

### **FAZA 2: Week View** 🗓️ (3-4h)

#### 2.1 Utworzyć WeekView.tsx
```typescript
components/calendar/WeekView.tsx
```

**Funkcjonalność:**
- Pokazuje 7 dni (poniedziałek-niedziela)
- Oś czasu pionowa (00:00 - 23:00)
- Eventy jako bloki z czasem
- All-day events na górze
- Grid z godzinami
- Drag & drop (opcjonalnie)

**Layout:**
```
┌─────────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Time    │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │
├─────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ 00:00   │     │     │     │     │     │     │     │
│ 01:00   │     │     │     │     │     │     │     │
│ 02:00   │     │     │     │     │     │     │     │
│ ...     │     │ ███ │     │     │     │     │     │ ← Event 10:00-12:00
│ 10:00   │     │ ███ │     │     │     │     │     │
│ 11:00   │     │ ███ │     │     │     │     │     │
│ 12:00   │     │     │     │     │     │     │     │
│ ...     │     │     │     │     │     │     │     │
└─────────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
```

**Komponenty:**
- `WeekView.tsx` - główny widok
- `WeekGrid.tsx` - grid z godzinami
- `WeekEventBlock.tsx` - blok eventu

---

### **FAZA 3: Day View** 📆 (2-3h)

#### 3.1 Utworzyć DayView.tsx
```typescript
components/calendar/DayView.tsx
```

**Funkcjonalność:**
- Pokazuje jeden dzień
- Oś czasu pionowa (00:00 - 23:00)
- Szersze eventy niż w week view
- Więcej szczegółów
- Lista eventów na boku (opcjonalnie)

**Layout:**
```
┌──────────────────────────────────────────┐
│  Monday, December 23, 2024               │
├─────────┬────────────────────────────────┤
│ 00:00   │                                │
│ 01:00   │                                │
│ ...     │                                │
│ 09:00   │  ┌──────────────────────────┐ │
│         │  │ Meeting with client      │ │
│ 10:00   │  │ 09:00 - 10:30           │ │
│         │  │ Priority: High           │ │
│         │  └──────────────────────────┘ │
│ 11:00   │                                │
│ ...     │                                │
└─────────┴────────────────────────────────┘
```

---

### **FAZA 4: Year View** 📅 (2-3h)

#### 4.1 Utworzyć YearView.tsx
```typescript
components/calendar/YearView.tsx
```

**Funkcjonalność:**
- Pokazuje 12 miesięcy w gridzie (3x4 lub 4x3)
- Mini kalendarz dla każdego miesiąca
- Kropki/kolory pokazujące eventy
- Kliknięcie na miesiąc → przełącza na month view

**Layout:**
```
┌────────────────────────────────────────────────┐
│              2024                              │
├──────────┬──────────┬──────────┬──────────────┤
│ January  │ February │ March    │ April        │
│  S M T..│  S M T.. │  S M T.. │  S M T..    │
│  1 2 3  │     1 2  │     1 2  │  1 2 3 4 5  │
│  ● ● ○  │  ● ○ ●   │  ○ ● ●   │  ● ● ○ ○ ●  │
├──────────┼──────────┼──────────┼──────────────┤
│ May      │ June     │ July     │ August       │
│  ...     │  ...     │  ...     │  ...         │
└──────────┴──────────┴──────────┴──────────────┘
```

---

### **FAZA 5: Mini kalendarz (sidebar)** 📌 (2h)

#### 5.1 Utworzyć MiniCalendar.tsx
- Mały kalendarz nawigacyjny
- Pokazuje obecny miesiąc
- Highlightuje dzień z eventami
- Quick navigation

**Umieścić w:**
- Sidebar w ProjectCalendar
- Opcjonalnie jako popup

---

### **FAZA 6: Ulepszenia UX** ✨ (3-4h)

#### 6.1 Klawisze skrótów
```
← → : Nawigacja prev/next
T   : Today
D   : Day view
W   : Week view
M   : Month view
Y   : Year view
N   : New event
```

#### 6.2 Gesture support (mobile)
- Swipe left/right → prev/next
- Pinch → zoom (w week/day view)
- Long press → create event

#### 6.3 Scroll to current time (week/day view)
- Auto scroll do obecnej godziny
- Highlight obecnej godziny

---

## 🎨 Design System

### Kolory według typu eventu:
```typescript
task      → Niebieski (#3B82F6)
shopping  → Zielony (#10B981)
deadline  → Czerwony (#EF4444)
milestone → Fioletowy (#8B5CF6)
```

### Kolory według priorytetu:
```typescript
urgent → Czerwony (#EF4444)
high   → Pomarańczowy (#F97316)
medium → Żółty (#EAB308)
low    → Zielony (#22C55E)
```

### Kolory według statusu:
```typescript
planned     → Szary (#9CA3AF)
confirmed   → Niebieski (#3B82F6)
in_progress → Żółty (#F59E0B)
completed   → Zielony (#10B981)
cancelled   → Czerwony (#EF4444)
```

---

## 📁 Struktura plików (DOCELOWA)

```
components/calendar/
├── Calendar.tsx                    # Main component
├── CalendarProvider.tsx            # Context z viewMode
├── CalendarHeader.tsx              # Header z przełącznikiem ✏️
├── CalendarEventCard.tsx           # Event card
├── TaskSidebar.tsx                 # Sidebar ze szczegółami
├── DayEventsModal.tsx              # Modal z eventami dnia
├── utils.ts                        # Helpers
│
├── views/
│   ├── MonthView.tsx              # Istniejący ✅
│   ├── WeekView.tsx               # NOWY 📝
│   ├── DayView.tsx                # NOWY 📝
│   └── YearView.tsx               # NOWY 📝
│
├── components/
│   ├── WeekGrid.tsx               # Grid dla week view
│   ├── DayGrid.tsx                # Grid dla day view
│   ├── TimeAxis.tsx               # Oś czasu (vertical)
│   ├── EventBlock.tsx             # Event w week/day view
│   └── MiniCalendar.tsx           # Mini kalendarz nawigacyjny
│
└── hooks/
    ├── useCalendarKeyboard.ts     # Keyboard shortcuts
    └── useCalendarGestures.ts     # Touch gestures
```

---

## ⏱️ Harmonogram (szacunkowy czas)

| Faza | Zadanie | Czas | Priorytet |
|------|---------|------|-----------|
| 1 | Przełącznik widoków | 1-2h | 🔥 HIGH |
| 2 | Week View | 3-4h | 🔥 HIGH |
| 3 | Day View | 2-3h | 🟡 MEDIUM |
| 4 | Year View | 2-3h | 🟢 LOW |
| 5 | Mini Calendar | 2h | 🟢 LOW |
| 6 | UX improvements | 3-4h | 🟡 MEDIUM |

**TOTAL:** ~13-18 godzin

---

## 🚀 Kolejność implementacji (RECOMMENDED)

### Sprint 1 (4-6h): **Podstawy**
1. ✅ Dodać przełącznik widoków do UI
2. ✅ Połączyć z CalendarProvider
3. ✅ Utworzyć WeekView (basic)
4. ✅ Testować przełączanie month ↔ week

### Sprint 2 (3-4h): **Week View complete**
5. ✅ Dodać TimeAxis (oś czasu)
6. ✅ Dodać WeekGrid z godzinami
7. ✅ EventBlock z czasem
8. ✅ All-day events na górze
9. ✅ Testować z różnymi eventami

### Sprint 3 (2-3h): **Day View**
10. ✅ Utworzyć DayView
11. ✅ Reużyć komponenty z WeekView
12. ✅ Dodać więcej szczegółów
13. ✅ Testować

### Sprint 4 (2-3h): **Year View**
14. ✅ Utworzyć YearView
15. ✅ Mini kalendarze dla miesięcy
16. ✅ Indicators dla eventów
17. ✅ Kliknięcie → month view

### Sprint 5 (3-4h): **Polish & UX**
18. ✅ Keyboard shortcuts
19. ✅ Mobile gestures
20. ✅ Scroll to current time
21. ✅ Mini calendar sidebar
22. ✅ Bug fixes & polish

---

## 🧪 Testy dla każdego widoku

### Month View (już działa):
- ✓ Events pokazują się poprawnie
- ✓ Multi-day events
- ✓ Kliknięcie na event
- ✓ More events modal

### Week View (do zrobienia):
- [ ] All-day events na górze
- [ ] Timed events w gridzie
- [ ] Overlapping events
- [ ] Różne długości (30min, 1h, 2h)
- [ ] Midnight events
- [ ] Multi-day spanning

### Day View (do zrobienia):
- [ ] Full day coverage (00:00-23:59)
- [ ] Multiple events same time
- [ ] Empty slots
- [ ] Scroll to current time

### Year View (do zrobienia):
- [ ] 12 miesięcy
- [ ] Event indicators
- [ ] Navigation to month
- [ ] Current month highlight

---

## 💡 Dodatkowe pomysły (Nice to have)

### Drag & Drop:
- Przeciąganie eventów między dniami
- Resize eventów (zmiana długości)
- Create by drag (przeciągnij → utwórz event)

### Sync z zewnętrznymi kalendarzami:
- Google Calendar integration
- Outlook/Office 365
- Apple Calendar
- iCal export/import

### Recurring events:
- Daily, Weekly, Monthly, Yearly
- Custom recurrence rules
- Edit single/all occurrences

### Team calendar:
- Zobacz eventy innych użytkowników
- Availability view
- Schedule meetings
- Conflict detection

### Smart scheduling:
- AI suggests best time slots
- Based on task priority
- Team availability
- Working hours

---

## 📝 Notatki techniczne

### State management:
```typescript
// CalendarProvider state
{
  currentDate: Date;      // Obecna data do wyświetlenia
  viewMode: ViewMode;     // 'day' | 'week' | 'month' | 'year'
  selectedDate: Date | null; // Wybrany dzień
  loading: boolean;
  error: string | null;
}
```

### Props dla widoków:
```typescript
interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  onMoreEventsClick?: (date: Date) => void;
  className?: string;
}
```

### Event positioning (week/day):
```typescript
// Oblicz pozycję Y na podstawie czasu
const getYPosition = (time: Date): number => {
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const hourHeight = 60; // px per hour
  return (hours * hourHeight) + (minutes * hourHeight / 60);
};

// Oblicz wysokość na podstawie duration
const getHeight = (start: Date, end: Date): number => {
  const durationMinutes = differenceInMinutes(end, start);
  const hourHeight = 60;
  return (durationMinutes / 60) * hourHeight;
};
```

---

## ✅ Checklist przed rozpoczęciem

- [ ] Przeczytać cały plan
- [ ] Ustalić priorytety z zespołem
- [ ] Przygotować design mockups (opcjonalnie)
- [ ] Utworzyć branch `feature/calendar-views`
- [ ] Zacząć od Fazy 1 (przełącznik)

---

## 🎯 Success Criteria

Kalendarz będzie gotowy gdy:
1. ✅ Wszystkie 4 widoki działają (day/week/month/year)
2. ✅ Płynne przełączanie między widokami
3. ✅ Events wyświetlają się poprawnie we wszystkich widokach
4. ✅ Responsywny design (mobile + desktop)
5. ✅ Testy manualne przechodzą
6. ✅ Brak błędów w console
7. ✅ Performance OK (< 100ms render time)

---

**Autor:** AI Assistant  
**Data:** 2024-12-23  
**Wersja:** 1.0  
**Status:** 📋 Plan gotowy do implementacji

---

## 🚀 Quick Start

Chcesz zacząć teraz? Powiedz które zadanie mam zaimplementować:

1. **FAZA 1** - Przełącznik widoków (fastest)
2. **FAZA 2** - Week View (most useful)
3. **FAZA 3** - Day View
4. Coś innego?




