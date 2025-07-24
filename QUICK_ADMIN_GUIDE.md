# 🚀 Quick Admin: Zmiana subskrypcji

## Jak szybko zmienić subskrypcję organizacji

### 1. **Znajdź Team ID**
- Otwórz [Convex Dashboard](https://dashboard.convex.dev/d/adept-seahorse-493)
- Przejdź do zakładki **Data** → **teams**
- Znajdź swoją organizację (po nazwie) i skopiuj `_id`

### 2. **Użyj funkcji w Console przeglądarki**

Otwórz swoją aplikację, naciśnij **F12** i w Console wklej:

```javascript
// 🟢 Upgrade do Pro (50 projektów, 50 członków, zaawansowane funkcje AI)
await window.convex.mutation(api.quickAdmin.quickSetTeamPro, {
  teamId: "WKLEJ_TUTAJ_TEAM_ID"
});

// 🔵 Upgrade do Basic (10 projektów, 15 członków)
await window.convex.mutation(api.quickAdmin.quickSetTeamBasic, {
  teamId: "WKLEJ_TUTAJ_TEAM_ID"
});

// 👑 Upgrade do Enterprise (bez limitów)
await window.convex.mutation(api.quickAdmin.quickSetTeamEnterprise, {
  teamId: "WKLEJ_TUTAJ_TEAM_ID"
});

// ⬇️ Reset do Free
await window.convex.mutation(api.quickAdmin.quickSetTeamFree, {
  teamId: "WKLEJ_TUTAJ_TEAM_ID"
});

// 📊 Sprawdź status
await window.convex.mutation(api.quickAdmin.getTeamInfo, {
  teamId: "WKLEJ_TUTAJ_TEAM_ID"
});
```

### 3. **Przykład użycia**

```javascript
// Przykład: Upgrade organizacji do Pro
await window.convex.mutation(api.quickAdmin.quickSetTeamPro, {
  teamId: "j57d8c9x8g2h4k5m6n7p8q9r0s1t2u3v"
});

// Odpowiedź:
// {
//   "success": true,
//   "message": "✅ Team 'Moja Firma' upgraded to Pro until 12/25/2024",
//   "teamName": "Moja Firma",
//   "plan": "pro",
//   "limits": {
//     "maxProjects": 50,
//     "maxTeamMembers": 50,
//     "maxStorageGB": 100,
//     "hasAdvancedFeatures": true
//   }
// }
```

## 🤖 AI Features - Wymagana subskrypcja

Po zmianie na Pro/Enterprise, funkcje AI będą działać:

### Funkcje AI w aplikacji:
1. **Task AI Generator** - w formularzu zadań (przycisk z różdżką)
2. **AI Assistant** - w `/ai` stronie projektu
3. **AI Indexing** - indeksowanie dokumentów do wiedzy AI

### Komunikaty o limitach:
- **Free/Basic**: *"🚫 AI features require Pro or Enterprise subscription"*
- **Nieaktywna subskrypcja**: *"🚫 Your subscription is not active. Please update your billing information"*

## 📋 Limity planów

| Plan | Projekty | Członkowie | Storage | AI Features |
|------|----------|------------|---------|-------------|
| **Free** | 3 | 5 | 1GB | ❌ |
| **Basic** | 10 | 15 | 10GB | ❌ |
| **Pro** | 50 | 50 | 100GB | ✅ |
| **Enterprise** | ∞ | ∞ | 1TB | ✅ |

## 🔧 Szybkie komendy

```javascript
// Sprawdź wszystkie zespoły (wymaga bycia adminem)
await window.convex.mutation(api.adminFunctions.getAllTeamsWithSubscriptions, {});

// Przedłuż subskrypcję o 30 dni
await window.convex.mutation(api.adminFunctions.extendTeamSubscription, {
  teamId: "TEAM_ID",
  additionalDays: 30
});
```

---

**⚠️ Uwaga**: Te funkcje są do testowania/administracji. W produkcji użyj prawdziwych płatności Stripe! 