# 📅 Ulepszenia Kalendarza i Gantt - Start/End Dates

## ✅ Co zostało naprawione

### 1. **Poprawiona logika dat w transformTaskToEvent** (`components/calendar/utils.ts`)

#### Przed (❌ ZŁE):
```typescript
// Używało tej samej daty dla start i end jeśli jedna była undefined
const startTimestamp = task.startDate || task.endDate!;
const endTimestamp = task.endDate || task.startDate!;
```

**Problem:** Task z tylko `endDate` (deadline) był wyświetlany jako event od deadline do deadline, co było mylące.

#### Po (✅ DOBRE):
```typescript
if (task.startDate && task.endDate) {
  // Ma obie daty - analizuj typ
  startTime = new Date(task.startDate);
  endTime = new Date(task.endDate);
  // Rozróżnia: task / milestone / deadline
  
} else if (task.endDate) {
  // Tylko deadline - pokazuj jako pojedynczy punkt w czasie
  endTime = new Date(task.endDate);
  startTime = endTime;
  eventType = 'deadline';
  
} else {
  // Tylko startDate - pokazuj jako milestone
  startTime = new Date(task.startDate!);
  endTime = startTime;
  eventType = 'milestone';
}
```

### 2. **Wykrywanie All-Day vs. Timed Events**

Teraz prawidłowo wykrywa czy event jest:
- **All-day** (godzina 00:00:00 UTC) → `isAllDay = true`
- **Timed** (ma konkretną godzinę) → `isAllDay = false`

```typescript
// Sprawdza czy czas jest w midnight UTC
const startIsAllDay = startTime.getUTCHours() === 0 && startTime.getUTCMinutes() === 0;
const endIsAllDay = endTime.getUTCHours() === 0 && endTime.getUTCMinutes() === 0;
isAllDay = startIsAllDay && endIsAllDay;
```

### 3. **Typy eventów**

System teraz prawidłowo rozróżnia:

| Typ | Kiedy | Wyświetlanie |
|-----|-------|--------------|
| **task** | `startDate !== endDate` (multi-day) | Pasek od startu do końca |
| **deadline** | Tylko `endDate` LUB `startDate === endDate` (all-day) | Pojedynczy punkt |
| **milestone** | Tylko `startDate` LUB same day z czasem | Pojedynczy punkt z czasem |

### 4. **Gantt - poprawiona logika** (`app/[slug]/[projectSlug]/gantt/components/ProjectGantt.tsx`)

```typescript
if (task.startDate && task.endDate) {
  // Ma obie - użyj jak jest
  startAt = new Date(task.startDate);
  endAt = new Date(task.endDate);
} else if (task.endDate) {
  // Tylko deadline - pokaż jako punkt
  endAt = new Date(task.endDate);
  startAt = endAt;
} else {
  // Tylko startDate - pokaż jako punkt
  startAt = new Date(task.startDate!);
  endAt = startAt;
}
```

---

## 🎯 Przykłady użycia

### Przykład 1: Task z zakresem dat (All-day)
```typescript
{
  title: "Projekt budowy domu",
  startDate: 1704067200000,  // 2024-01-01 00:00:00 UTC
  endDate: 1735689600000,     // 2025-01-01 00:00:00 UTC
}

// Wynik:
// eventType: 'task'
// isAllDay: true
// Pokazuje: Pasek od 1 stycznia 2024 do 1 stycznia 2025
```

### Przykład 2: Deadline (tylko endDate)
```typescript
{
  title: "Złożyć dokumenty",
  endDate: 1704067200000,  // 2024-01-01 00:00:00 UTC
}

// Wynik:
// eventType: 'deadline'
// isAllDay: true
// startTime === endTime
// Pokazuje: Czerwony punkt na 1 stycznia 2024
```

### Przykład 3: Meeting (specific time)
```typescript
{
  title: "Spotkanie z klientem",
  startDate: 1704099600000,  // 2024-01-01 09:00:00 UTC
  endDate: 1704103200000,     // 2024-01-01 10:00:00 UTC
}

// Wynik:
// eventType: 'milestone'
// isAllDay: false
// Pokazuje: "09:00 - 10:00" w kalendarzu
```

### Przykład 4: Reminder (single point in time)
```typescript
{
  title: "Zadzwonić do klienta",
  startDate: 1704099600000,  // 2024-01-01 09:00:00 UTC
  endDate: 1704099600000,     // Ta sama data i czas
}

// Wynik:
// eventType: 'milestone'
// isAllDay: false
// Pokazuje: "09:00" w kalendarzu
```

---

## 🧪 Jak przetestować

### Test 1: Utwórz task z zakresem dat
1. Otwórz projekt
2. Utwórz nowy task:
   - Tytuł: "Test multi-day task"
   - Start Date: Dzisiaj
   - End Date: Za 3 dni
   - All day: ✓
3. Sprawdź kalendarz - powinien pokazać pasek przez 3 dni
4. Sprawdź Gantt - powinien pokazać pasek przez 3 dni

### Test 2: Utwórz deadline (tylko endDate)
1. Utwórz nowy task:
   - Tytuł: "Test deadline"
   - Start Date: (puste)
   - End Date: Jutro
   - All day: ✓
2. Sprawdź kalendarz - powinien pokazać jako deadline (⚠️ icon)
3. Sprawdź Gantt - powinien pokazać jako pojedynczy punkt

### Test 3: Utwórz meeting z czasem
1. Utwórz nowy task:
   - Tytuł: "Test meeting"
   - Date: Dzisiaj (single day event: ✓)
   - All day: ✗
   - Start Time: 14:00
   - End Time: 15:00
2. Sprawdź kalendarz - powinien pokazać "14:00-15:00"
3. Kliknij na event - powinien pokazać dokładny czas w sidebar

### Test 4: Utwórz reminder (single point)
1. Utwórz nowy task:
   - Tytuł: "Test reminder"
   - Date: Dzisiaj (single day event: ✓)
   - All day: ✗
   - Start Time: 10:00
   - End Time: nie zaznaczaj "Specify end time"
2. Sprawdź kalendarz - powinien pokazać "10:00" jako milestone

---

## 📝 Zmienione pliki

1. ✅ `components/calendar/utils.ts` - poprawiona transformacja
2. ✅ `app/[slug]/[projectSlug]/gantt/components/ProjectGantt.tsx` - poprawiona logika dat
3. 📄 `components/calendar/MonthView.tsx` - już dobrze działało
4. 📄 `components/calendar/CalendarEventCard.tsx` - już dobrze działało
5. 📄 `app/[slug]/[projectSlug]/tasks/components/TaskForm.tsx` - już dobrze działało
6. 📄 `convex/calendar.ts` - backend już dobrze działał
7. 📄 `convex/tasks.ts` - backend już dobrze działał

---

## 🎨 Wizualne różnice

### Kalendarz:
- **Task (multi-day)**: Niebieski pasek z ikoną 📅
- **Deadline**: Czerwony/Pomarańczowy punkt z ikoną ⚠️
- **Milestone**: Fioletowy punkt z ikoną ✓
- **Shopping**: Zielony punkt z ikoną 🛒

### Gantt:
- **Task (multi-day)**: Kolorowy pasek według statusu
- **Deadline/Milestone**: Pojedynczy punkt (startAt === endAt)

---

## 🚀 Co dalej (opcjonalne ulepszenia)

### Możliwe rozszerzenia:
1. **Drag & Drop** - przeciąganie eventów w kalendarzu
2. **Resize** - zmiana długości taskow przez przeciągnięcie końca
3. **Week/Day views** - dodać widoki tygodnia i dnia
4. **Recurring events** - powtarzające się eventy
5. **Time zones** - lepsze wsparcie dla stref czasowych
6. **Conflict detection** - wykrywanie nakładających się eventów
7. **Color coding** - więcej opcji kolorystycznych

Powiedz mi które z tych chcesz dodać! 🎯

