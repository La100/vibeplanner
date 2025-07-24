"use node";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

export const seedInteriorDesignProject = action({
  args: {
    projectSlug: v.string(),
    teamSlug: v.string(),
  },
  returns: v.object({
    tasksCreated: v.float64(),
    shoppingItemsCreated: v.float64(),
    surveysCreated: v.float64(),
    sectionsCreated: v.float64(),
  }),
  handler: async (ctx, args) => {
    // Get project details
    const project = await ctx.runQuery(api.projects.getProjectBySlug, {
      teamSlug: args.teamSlug,
      projectSlug: args.projectSlug,
    });
    
    if (!project) {
      throw new Error("Project not found");
    }

    // Usuń istniejące dane przed dodaniem nowych
    const existingTasks = await ctx.runQuery(api.tasks.listProjectTasks, { projectId: project._id });
    for (const task of existingTasks) {
      await ctx.runMutation(api.tasks.deleteTask, { taskId: task._id });
    }

    const existingShoppingItems = await ctx.runQuery(api.shopping.listShoppingListItems, { projectId: project._id });
    for (const item of existingShoppingItems) {
      await ctx.runMutation(api.shopping.deleteShoppingListItem, { itemId: item._id });
    }

    const existingSections = await ctx.runQuery(api.shopping.listShoppingListSections, { projectId: project._id });
    for (const section of existingSections) {
      await ctx.runMutation(api.shopping.deleteShoppingListSection, { sectionId: section._id });
    }

    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneWeekFromNow = now + 7 * 24 * 60 * 60 * 1000;
    const twoWeeksFromNow = now + 14 * 24 * 60 * 60 * 1000;
    const oneMonthFromNow = now + 30 * 24 * 60 * 60 * 1000;

    // ZADANIA - Interior Design po polsku
    const tasks = [
      {
        title: "Konsultacja z klientem i ocena przestrzeni",
        description: "Spotkanie z klientem w celu poznania jego wizji, stylu życia i potrzeb funkcjonalnych. Pomiar i ocena istniejącej przestrzeni.",
        status: "done" as const,
        priority: "high" as const,
        tags: ["konsultacja", "ocena", "planowanie"],
        startDate: oneWeekAgo,
        endDate: oneWeekAgo + 3 * 60 * 60 * 1000,
        cost: 1200,
      },
      {
        title: "Stworzenie mood board'u i palety kolorów",
        description: "Opracowanie koncepcji wizualnych, schematów kolorystycznych i kierunku stylistycznego w oparciu o preferencje klienta.",
        status: "done" as const,
        priority: "high" as const,
        tags: ["design", "moodboard", "kolory"],
        startDate: oneWeekAgo + 24 * 60 * 60 * 1000,
        endDate: oneWeekAgo + 28 * 60 * 60 * 1000,
        cost: 800,
      },
      {
        title: "Planowanie przestrzeni i projekt układu",
        description: "Zaprojektowanie optymalnego rozmieszczenia mebli i przepływu ruchu. Stworzenie planów pięter i wizualizacji 3D.",
        status: "in_progress" as const,
        priority: "high" as const,
        tags: ["planowanie-przestrzeni", "layout", "wizualizacja-3d"],
        startDate: now - 2 * 24 * 60 * 60 * 1000,
        dueDate: oneWeekFromNow,
        cost: 2200,
      },
      {
        title: "Wybór mebli i oświetlenia",
        description: "Pozyskanie i wybór wszystkich elementów wyposażenia, opraw oświetleniowych i elementów dekoracyjnych zgodnie z projektem.",
        status: "todo" as const,
        priority: "medium" as const,
        tags: ["meble", "oświetlenie", "sourcing"],
        dueDate: oneWeekFromNow,
        cost: 1100,
      },
      {
        title: "Projekt dekoracji okiennych",
        description: "Zaprojektowanie i specyfikacja zasłon, żaluzji lub rolet, które uzupełnią ogólną estetykę designu.",
        status: "todo" as const,
        priority: "medium" as const,
        tags: ["dekoracje-okienne", "tkaniny"],
        dueDate: twoWeeksFromNow,
        cost: 600,
      },
      {
        title: "Wybór farb i wykończeń ścian",
        description: "Dobór kolorów farb i wykończeń ścian. Koordynacja z wykonawcami w celu implementacji.",
        status: "review" as const,
        priority: "high" as const,
        tags: ["farby", "ściany", "wykończenia"],
        dueDate: oneWeekFromNow,
        cost: 400,
      },
      {
        title: "Kuracja sztuki i akcesoriów",
        description: "Wybór dzieł sztuki, przedmiotów dekoracyjnych i akcesoriów w celu personalizacji przestrzeni.",
        status: "todo" as const,
        priority: "low" as const,
        tags: ["sztuka", "akcesoria", "styling"],
        dueDate: twoWeeksFromNow,
        cost: 800,
      },
      {
        title: "Finalna instalacja i stylizacja",
        description: "Nadzór nad dostawą i ustawieniem wszystkich elementów. Finalna stylizacja i prezentacja klientowi.",
        status: "todo" as const,
        priority: "urgent" as const,
        tags: ["instalacja", "stylizacja", "zakończenie"],
        dueDate: twoWeeksFromNow,
        cost: 1500,
      },
      {
        title: "Zakup materiałów budowlanych",
        description: "Zakup wszystkich potrzebnych materiałów do remontu i wykończenia.",
        status: "todo" as const,
        priority: "medium" as const,
        tags: ["materiały", "budowa", "remont"],
        dueDate: oneWeekFromNow,
        cost: 3500,
      },
      {
        title: "Koordynacja z wykonawcami",
        description: "Zarządzanie pracami remontowymi, koordynacja z różnymi wykonawcami i kontrola jakości.",
        status: "in_progress" as const,
        priority: "urgent" as const,
        tags: ["wykonawcy", "koordynacja", "kontrola-jakości"],
        startDate: now - 1 * 24 * 60 * 60 * 1000,
        endDate: oneMonthFromNow,
        cost: 2800,
      },
      // DODATKOWE ZADANIA
      {
        title: "Projekt kuchni - szafki i blaty",
        description: "Zaprojektowanie zabudowy kuchennej, dobór materiałów na blaty robocze i frontów szafek. Współpraca z stolarniami.",
        status: "in_progress" as const,
        priority: "high" as const,
        tags: ["kuchnia", "szafki", "blaty", "stolarka"],
        startDate: now - 3 * 24 * 60 * 60 * 1000,
        dueDate: oneWeekFromNow + 3 * 24 * 60 * 60 * 1000,
        cost: 3200,
      },
      {
        title: "Projekt łazienki - układanie płytek",
        description: "Szczegółowy projekt układania płytek w łazience głównej. Dobór fugowania i akcesoriów.",
        status: "review" as const,
        priority: "medium" as const,
        tags: ["łazienka", "płytki", "fugowanie"],
        dueDate: twoWeeksFromNow,
        cost: 1800,
      },
      {
        title: "Instalacja elektryczna - plan rozmieszczenia gniazdek",
        description: "Opracowanie planu rozmieszczenia gniazdek, przełączników i oświetlenia. Konsultacje z elektrykiem.",
        status: "todo" as const,
        priority: "urgent" as const,
        tags: ["elektryka", "gniazdka", "oświetlenie"],
        dueDate: oneWeekFromNow,
        cost: 1500,
      },
      {
        title: "Projekt garderoby w sypialni",
        description: "Zaprojektowanie funkcjonalnej garderoby w sypialni głównej. Optymalizacja przestrzeni przechowywania.",
        status: "todo" as const,
        priority: "medium" as const,
        tags: ["garderoba", "sypialnia", "przechowywanie"],
        dueDate: twoWeeksFromNow + 5 * 24 * 60 * 60 * 1000,
        cost: 2400,
      },
      {
        title: "Dobór tkanin - zasłony i tapicerka",
        description: "Wybór materiałów na zasłony, pościel i tapicerkę mebli. Dopasowanie kolorystyczne do całości.",
        status: "todo" as const,
        priority: "low" as const,
        tags: ["tkaniny", "zasłony", "tapicerka"],
        dueDate: oneMonthFromNow,
        cost: 900,
      },
      {
        title: "Projekt systemu przechowywania",
        description: "Zaprojektowanie systemów przechowywania w całym mieszkaniu - szafy, półki, organizery.",
        status: "todo" as const,
        priority: "medium" as const,
        tags: ["przechowywanie", "organizacja", "szafy"],
        dueDate: twoWeeksFromNow + 7 * 24 * 60 * 60 * 1000,
        cost: 1600,
      },
      {
        title: "Konsultacje z architektem - zmiany konstrukcyjne",
        description: "Spotkania z architektem w sprawie możliwych zmian konstrukcyjnych - usunięcie ścian, dodanie otworów.",
        status: "done" as const,
        priority: "high" as const,
        tags: ["architektura", "konstrukcja", "konsultacje"],
        startDate: oneWeekAgo - 2 * 24 * 60 * 60 * 1000,
        endDate: oneWeekAgo,
        cost: 2000,
      },
      {
        title: "Projekt ogrodu/balkonu",
        description: "Zaprojektowanie przestrzeni zewnętrznej - dobór roślin, mebli ogrodowych i oświetlenia.",
        status: "todo" as const,
        priority: "low" as const,
        tags: ["ogród", "balkon", "rośliny"],
        dueDate: oneMonthFromNow + 7 * 24 * 60 * 60 * 1000,
        cost: 1200,
      },
      {
        title: "Wycena kosztów całego projektu",
        description: "Szczegółowa wycena wszystkich kosztów projektu - materiały, robocizna, wyposażenie.",
        status: "review" as const,
        priority: "high" as const,
        tags: ["wycena", "koszty", "budżet"],
        dueDate: oneWeekFromNow,
        cost: 500,
      },
      {
        title: "Projekt systemu klimatyzacji",
        description: "Opracowanie systemu klimatyzacji i wentylacji. Wybór jednostek i rozmieszczenie.",
        status: "todo" as const,
        priority: "medium" as const,
        tags: ["klimatyzacja", "wentylacja", "HVAC"],
        dueDate: oneMonthFromNow,
        cost: 1800,
      },
      {
        title: "Dobór podłóg - materiały i kolory",
        description: "Finalizacja wyboru podłóg do wszystkich pomieszczeń. Koordynacja z układaczami.",
        status: "in_progress" as const,
        priority: "high" as const,
        tags: ["podłogi", "materiały", "koordynacja"],
        startDate: now - 1 * 24 * 60 * 60 * 1000,
        dueDate: oneWeekFromNow + 2 * 24 * 60 * 60 * 1000,
        cost: 2200,
      },
      {
        title: "Projekt oświetlenia dekoracyjnego",
        description: "Zaprojektowanie oświetlenia nastrojowego - taśmy LED, lampki, świece LED.",
        status: "todo" as const,
        priority: "low" as const,
        tags: ["oświetlenie", "dekoracje", "LED"],
        dueDate: twoWeeksFromNow + 10 * 24 * 60 * 60 * 1000,
        cost: 800,
      },
      {
        title: "Przygotowanie dokumentacji technicznej",
        description: "Stworzenie kompletnej dokumentacji technicznej dla wykonawców i klienta.",
        status: "todo" as const,
        priority: "medium" as const,
        tags: ["dokumentacja", "rysunki", "specyfikacje"],
        dueDate: twoWeeksFromNow,
        cost: 1000,
      },
      {
        title: "Nadzór nad realizacją - kontrola jakości",
        description: "Regularne wizyty na budowie, kontrola postępu prac i jakości wykonania.",
        status: "in_progress" as const,
        priority: "urgent" as const,
        tags: ["nadzór", "kontrola", "jakość"],
        startDate: now - 5 * 24 * 60 * 60 * 1000,
        endDate: oneMonthFromNow + 14 * 24 * 60 * 60 * 1000,
        cost: 3500,
      },
      {
        title: "Projekt systemu smart home",
        description: "Zaprojektowanie systemu inteligentnego domu - automatyka, czujniki, sterowanie.",
        status: "todo" as const,
        priority: "low" as const,
        tags: ["smart-home", "automatyka", "technologia"],
        dueDate: oneMonthFromNow + 5 * 24 * 60 * 60 * 1000,
        cost: 2500,
      },
    ];

    let tasksCreated = 0;
    for (const task of tasks) {
      await ctx.runMutation(api.tasks.createTask, {
        ...task,
        projectId: project._id,
        teamId: project.teamId,
      });
      tasksCreated++;
    }

    // SEKCJE SHOPPING LIST
    const shoppingSections = [
      { name: "Meble" },
      { name: "Oświetlenie" },
      { name: "Materiały budowlane" },
      { name: "Dekoracje" },
      { name: "Tkaniny i tekstylia" },
      { name: "Elektronika" },
      { name: "Narzędzia" },
      { name: "Kuchnia i akcesoria" },
      { name: "Łazienka" },
      { name: "Rośliny i ogród" },
    ];

    let sectionsCreated = 0;
    const createdSections: any = {};
    
    for (const section of shoppingSections) {
      const sectionId = await ctx.runMutation(api.shopping.createShoppingListSection, {
        name: section.name,
        projectId: project._id,
      });
      createdSections[section.name] = sectionId;
      sectionsCreated++;
    }

    // SHOPPING LIST ITEMS - po polsku z sekcjami
    const shoppingItems = [
      // MEBLE
      {
        name: "Sofa narożna z funkcją spania",
        category: "Meble",
        quantity: 1,
        unitPrice: 4500.00,
        supplier: "IKEA",
        catalogNumber: "FRIHETEN-01",
        dimensions: "230cm x 151cm x 66cm",
        notes: "Kolor ciemnoszary, z pojemnikiem na pościel",
        priority: "high" as const,
        realizationStatus: "PLANNED" as const,
        buyBefore: oneWeekFromNow,
        sectionId: createdSections["Meble"],
      },
      {
        name: "Stół jadalny rozkładany",
        category: "Meble",
        quantity: 1,
        unitPrice: 2200.00,
        supplier: "Agata Meble",
        catalogNumber: "NORDIC-TABLE-01",
        dimensions: "160-220cm x 90cm x 75cm",
        notes: "Drewno dębowe, nogi metalowe w kolorze czarnym",
        priority: "medium" as const,
        realizationStatus: "ORDERED" as const,
        sectionId: createdSections["Meble"],
      },
      {
        name: "Krzesła tapicerowane",
        category: "Meble",
        quantity: 6,
        unitPrice: 380.00,
        supplier: "Black Red White",
        catalogNumber: "COMFORT-CHAIR-01",
        dimensions: "45cm x 52cm x 82cm",
        notes: "Tapicerka w kolorze beżowym, nogi dębowe",
        priority: "medium" as const,
        realizationStatus: "PLANNED" as const,
        buyBefore: twoWeeksFromNow,
        sectionId: createdSections["Meble"],
      },
      {
        name: "Komoda do sypialni",
        category: "Meble",
        quantity: 1,
        unitPrice: 1800.00,
        supplier: "VOX",
        catalogNumber: "LOFT-DRESSER-01",
        dimensions: "120cm x 40cm x 85cm",
        notes: "6 szuflad, front w kolorze białym mat",
        priority: "low" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Meble"],
      },

      // OŚWIETLENIE
      {
        name: "Żyrandol do salonu",
        category: "Oświetlenie",
        quantity: 1,
        unitPrice: 800.00,
        supplier: "Leroy Merlin",
        catalogNumber: "MODERN-CHANDELIER-01",
        dimensions: "Ø60cm x 40cm",
        notes: "LED, możliwość ściemniania, kolor czarny mat",
        priority: "high" as const,
        realizationStatus: "ORDERED" as const,
        buyBefore: oneWeekFromNow,
        sectionId: createdSections["Oświetlenie"],
      },
      {
        name: "Lampy podłogowe",
        category: "Oświetlenie",
        quantity: 2,
        unitPrice: 450.00,
        supplier: "Castorama",
        catalogNumber: "FLOOR-LAMP-SCANDI-01",
        dimensions: "Ø35cm x 150cm",
        notes: "Styl skandynawski, drewniana noga, abażur lniany",
        priority: "medium" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Oświetlenie"],
      },
      {
        name: "Oświetlenie LED pod szafkami",
        category: "Oświetlenie",
        quantity: 5,
        unitPrice: 120.00,
        supplier: "OBI",
        catalogNumber: "LED-STRIP-KITCHEN-01",
        dimensions: "1m każdy",
        notes: "Ciepła biel 3000K, z czujnikiem ruchu",
        priority: "low" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Oświetlenie"],
      },

      // MATERIAŁY BUDOWLANE
      {
        name: "Farba do ścian",
        category: "Materiały",
        quantity: 15,
        unitPrice: 85.00,
        supplier: "Dulux",
        catalogNumber: "DULUX-PREMIUM-WHITE",
        dimensions: "5L każda",
        notes: "Kolor biały ciepły, farba lateksowa, łatwa w myciu",
        priority: "urgent" as const,
        realizationStatus: "ORDERED" as const,
        buyBefore: now + 3 * 24 * 60 * 60 * 1000,
        sectionId: createdSections["Materiały budowlane"],
      },
      {
        name: "Panele podłogowe",
        category: "Materiały",
        quantity: 45,
        unitPrice: 65.00,
        supplier: "Quick-Step",
        catalogNumber: "QUICKSTEP-OAK-NATURAL",
        dimensions: "1380mm x 156mm x 8mm",
        notes: "Dąb naturalny, klasa 32, wodoodporne",
        priority: "high" as const,
        realizationStatus: "DELIVERED" as const,
        sectionId: createdSections["Materiały budowlane"],
      },
      {
        name: "Płytki do łazienki",
        category: "Materiały",
        quantity: 25,
        unitPrice: 120.00,
        supplier: "Ceramika Paradyż",
        catalogNumber: "PARADYZ-MARBLE-WHITE",
        dimensions: "60cm x 60cm",
        notes: "Imitacja marmuru, połysk, antypoślizgowe",
        priority: "medium" as const,
        realizationStatus: "PLANNED" as const,
        buyBefore: twoWeeksFromNow,
        sectionId: createdSections["Materiały budowlane"],
      },

      // DEKORACJE
      {
        name: "Obrazy do salonu",
        category: "Dekoracje",
        quantity: 3,
        unitPrice: 280.00,
        supplier: "Desenio",
        catalogNumber: "ART-SET-MODERN-01",
        dimensions: "50cm x 70cm każdy",
        notes: "Zestaw 3 obrazów, rama drewniana, styl nowoczesny",
        priority: "low" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Dekoracje"],
      },
      {
        name: "Rośliny doniczkowe",
        category: "Dekoracje",
        quantity: 8,
        unitPrice: 45.00,
        supplier: "Obi Garden",
        catalogNumber: "PLANTS-INDOOR-MIX",
        dimensions: "Różne rozmiary",
        notes: "Monstera, fikus, sansewieria, doniczki ceramiczne",
        priority: "low" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Dekoracje"],
      },

      // TKANINY
      {
        name: "Zasłony do salonu",
        category: "Tekstylia",
        quantity: 4,
        unitPrice: 180.00,
        supplier: "IKEA",
        catalogNumber: "SANELA-VELVET-BEIGE",
        dimensions: "140cm x 280cm każda",
        notes: "Welur w kolorze beżowym, zaciemniające",
        priority: "medium" as const,
        realizationStatus: "PLANNED" as const,
        buyBefore: oneWeekFromNow,
        sectionId: createdSections["Tkaniny i tekstylia"],
      },
      {
        name: "Dywan pod stół",
        category: "Tekstylia",
        quantity: 1,
        unitPrice: 650.00,
        supplier: "Carpet Decor",
        catalogNumber: "VINTAGE-RUG-BEIGE",
        dimensions: "200cm x 300cm",
        notes: "Styl vintage, kolor beżowo-szary, bawełna",
        priority: "medium" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Tkaniny i tekstylia"],
      },
      {
        name: "Poduszki dekoracyjne",
        category: "Tekstylia",
        quantity: 6,
        unitPrice: 65.00,
        supplier: "H&M Home",
        catalogNumber: "PILLOW-SET-EARTH",
        dimensions: "45cm x 45cm każda",
        notes: "Kolory ziemi, różne faktury, wypełnienie pierze",
        priority: "low" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Tkaniny i tekstylia"],
      },

      // ELEKTRONIKA
      {
        name: "Telewizor do salonu",
        category: "Elektronika",
        quantity: 1,
        unitPrice: 2800.00,
        supplier: "Samsung",
        catalogNumber: "SAMSUNG-55Q80A",
        dimensions: "55 cali, 4K QLED",
        notes: "Smart TV, HDR, gaming mode",
        priority: "medium" as const,
        realizationStatus: "PLANNED" as const,
        buyBefore: twoWeeksFromNow,
        sectionId: createdSections["Elektronika"],
      },
      {
        name: "Głośniki bezprzewodowe",
        category: "Elektronika",
        quantity: 2,
        unitPrice: 450.00,
        supplier: "Sonos",
        catalogNumber: "SONOS-ONE-GEN2",
        dimensions: "16.8cm x 11.9cm x 11.9cm",
        notes: "Wi-Fi, Alexa, stereo para",
        priority: "low" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Elektronika"],
      },

      // NARZĘDZIA
      {
        name: "Wiertarka udarowa",
        category: "Narzędzia",
        quantity: 1,
        unitPrice: 320.00,
        supplier: "Bosch",
        catalogNumber: "BOSCH-PSB-1800",
        dimensions: "Akumulatorowa 18V",
        notes: "Z zestawem wierteł i bitów",
        priority: "high" as const,
        realizationStatus: "ORDERED" as const,
        sectionId: createdSections["Narzędzia"],
      },
      {
        name: "Poziomica 100cm",
        category: "Narzędzia",
        quantity: 1,
        unitPrice: 85.00,
        supplier: "Stanley",
        catalogNumber: "STANLEY-LEVEL-100",
        dimensions: "100cm",
        notes: "Aluminiowa, 3 libelle",
        priority: "medium" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Narzędzia"],
      },
      {
        name: "Zestaw kluczy",
        category: "Narzędzia",
        quantity: 1,
        unitPrice: 150.00,
        supplier: "Gedore",
        catalogNumber: "GEDORE-WRENCH-SET",
        dimensions: "8-19mm",
        notes: "Klucze płasko-oczkowe, 12 sztuk",
        priority: "medium" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Narzędzia"],
      },

      // KUCHNIA I AKCESORIA
      {
        name: "Blat kuchenny kwarcowy",
        category: "Kuchnia",
        quantity: 1,
        unitPrice: 1800.00,
        supplier: "Silestone",
        catalogNumber: "SILESTONE-WHITE-STORM",
        dimensions: "300cm x 60cm x 3cm",
        notes: "Kolor White Storm, polerowany",
        priority: "high" as const,
        realizationStatus: "ORDERED" as const,
        buyBefore: oneWeekFromNow,
        sectionId: createdSections["Kuchnia i akcesoria"],
      },
      {
        name: "Zlewozmywak granitowy",
        category: "Kuchnia",
        quantity: 1,
        unitPrice: 650.00,
        supplier: "Blanco",
        catalogNumber: "BLANCO-ZENAR-XL",
        dimensions: "78cm x 50cm",
        notes: "Kolor antracyt, z baterią",
        priority: "high" as const,
        realizationStatus: "PLANNED" as const,
        buyBefore: oneWeekFromNow,
        sectionId: createdSections["Kuchnia i akcesoria"],
      },
      {
        name: "Okap kuchenny",
        category: "Kuchnia",
        quantity: 1,
        unitPrice: 1200.00,
        supplier: "Electrolux",
        catalogNumber: "ELECTROLUX-LFP316S",
        dimensions: "60cm",
        notes: "Stal nierdzewna, LED, 3 prędkości",
        priority: "medium" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Kuchnia i akcesoria"],
      },
      {
        name: "Płyta indukcyjna",
        category: "Kuchnia",
        quantity: 1,
        unitPrice: 1400.00,
        supplier: "Bosch",
        catalogNumber: "BOSCH-PXE801DC1E",
        dimensions: "80cm, 4 palniki",
        notes: "Czarna, dotykowe sterowanie",
        priority: "high" as const,
        realizationStatus: "PLANNED" as const,
        buyBefore: oneWeekFromNow,
        sectionId: createdSections["Kuchnia i akcesoria"],
      },

      // ŁAZIENKA
      {
        name: "Wanna wolnostojąca",
        category: "Łazienka",
        quantity: 1,
        unitPrice: 3200.00,
        supplier: "Kaldewei",
        catalogNumber: "KALDEWEI-MEISTERSTUCK",
        dimensions: "170cm x 75cm x 58cm",
        notes: "Stal emaliowana, biała",
        priority: "high" as const,
        realizationStatus: "ORDERED" as const,
        buyBefore: twoWeeksFromNow,
        sectionId: createdSections["Łazienka"],
      },
      {
        name: "Kabina prysznicowa",
        category: "Łazienka",
        quantity: 1,
        unitPrice: 1800.00,
        supplier: "Radaway",
        catalogNumber: "RADAWAY-EUPHORIA-KDJ",
        dimensions: "120cm x 90cm",
        notes: "Szkło 8mm, chrom, drzwi uchylne",
        priority: "high" as const,
        realizationStatus: "PLANNED" as const,
        buyBefore: twoWeeksFromNow,
        sectionId: createdSections["Łazienka"],
      },
      {
        name: "Umywalka z szafką",
        category: "Łazienka",
        quantity: 2,
        unitPrice: 950.00,
        supplier: "Duravit",
        catalogNumber: "DURAVIT-DARLING-NEW",
        dimensions: "80cm x 54cm",
        notes: "Biała, z szafką podumywalkową",
        priority: "medium" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Łazienka"],
      },
      {
        name: "Grzejnik łazienkowy",
        category: "Łazienka",
        quantity: 2,
        unitPrice: 420.00,
        supplier: "Purmo",
        catalogNumber: "PURMO-TIGA-TG",
        dimensions: "60cm x 120cm",
        notes: "Biały, z termostatem",
        priority: "medium" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Łazienka"],
      },

      // ROŚLINY I OGRÓD
      {
        name: "Drzewka w doniczkach",
        category: "Rośliny",
        quantity: 3,
        unitPrice: 180.00,
        supplier: "Obi Garden",
        catalogNumber: "TREE-FICUS-LARGE",
        dimensions: "Wysokość 150cm",
        notes: "Ficus benjamina, doniczki ceramiczne",
        priority: "low" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Rośliny i ogród"],
      },
      {
        name: "System podlewania automatyczny",
        category: "Rośliny",
        quantity: 1,
        unitPrice: 320.00,
        supplier: "Gardena",
        catalogNumber: "GARDENA-SMART-SYSTEM",
        dimensions: "Zestaw startowy",
        notes: "Wi-Fi, czujnik wilgotności, aplikacja",
        priority: "low" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Rośliny i ogród"],
      },
      {
        name: "Meble ogrodowe",
        category: "Rośliny",
        quantity: 1,
        unitPrice: 1200.00,
        supplier: "IKEA",
        catalogNumber: "APPLARO-OUTDOOR-SET",
        dimensions: "Stół + 4 krzesła",
        notes: "Drewno akacjowe, z poduszkami",
        priority: "low" as const,
        realizationStatus: "PLANNED" as const,
        sectionId: createdSections["Rośliny i ogród"],
      },
    ];

    let shoppingItemsCreated = 0;
    for (const item of shoppingItems) {
      await ctx.runMutation(api.shopping.createShoppingListItem, {
        ...item,
        projectId: project._id,
      });
      shoppingItemsCreated++;
    }

    // ANKIETY Z PYTANIAMI - po polsku
    const surveys = [
      {
        title: "Ankieta satysfakcji klienta - etap projektowy",
        description: "Oceń nasz proces projektowania i komunikację na tym etapie realizacji.",
        isRequired: false,
        allowMultipleResponses: true,
        targetAudience: "all_customers" as const,
        startDate: now,
        endDate: oneMonthFromNow,
        questions: [
          {
            questionText: "Jak oceniasz jakość komunikacji z naszym zespołem?",
            questionType: "rating" as const,
            isRequired: true,
            order: 1,
            ratingScale: { min: 1, max: 5, minLabel: "Bardzo słaba", maxLabel: "Doskonała" }
          },
          {
            questionText: "Czy jesteś zadowolony z dotychczasowego przebiegu projektu?",
            questionType: "single_choice" as const,
            isRequired: true,
            order: 2,
            options: ["Tak, bardzo", "Tak, w miarę", "Nie mam zdania", "Raczej nie", "Zdecydowanie nie"]
          },
          {
            questionText: "Co moglibyśmy poprawić w naszej pracy?",
            questionType: "text_long" as const,
            isRequired: false,
            order: 3,
          },
          {
            questionText: "Czy terminarz realizacji jest dla Ciebie odpowiedni?",
            questionType: "yes_no" as const,
            isRequired: true,
            order: 4,
          },
          {
            questionText: "Które aspekty projektu są dla Ciebie najważniejsze? (wybierz wszystkie)",
            questionType: "multiple_choice" as const,
            isRequired: true,
            order: 5,
            options: ["Jakość materiałów", "Terminowość", "Cena", "Estetyka", "Funkcjonalność", "Trwałość"]
          }
        ]
      },
      {
        title: "Ankieta preferencji stylistycznych",
        description: "Pomóż nam lepiej zrozumieć Twoje gusty i preferencje dotyczące wnętrz.",
        isRequired: false,
        allowMultipleResponses: false,
        targetAudience: "all_customers" as const,
        startDate: now,
        endDate: twoWeeksFromNow,
        questions: [
          {
            questionText: "Jaki styl wnętrza najbardziej Ci odpowiada?",
            questionType: "single_choice" as const,
            isRequired: true,
            order: 1,
            options: ["Nowoczesny", "Skandynawski", "Klasyczny", "Industrialny", "Boho", "Minimalistyczny", "Rustykalny"]
          },
          {
            questionText: "Jakie kolory dominują w Twoim idealnym wnętrzu?",
            questionType: "multiple_choice" as const,
            isRequired: true,
            order: 2,
            options: ["Biel", "Szarość", "Beż", "Czerń", "Brąz", "Niebieski", "Zielony", "Kolorowe akcenty"]
          },
          {
            questionText: "Jak ważne jest dla Ciebie oświetlenie naturalne?",
            questionType: "rating" as const,
            isRequired: true,
            order: 3,
            ratingScale: { min: 1, max: 5, minLabel: "Nieważne", maxLabel: "Bardzo ważne" }
          },
          {
            questionText: "Opisz swój idealny salon w kilku zdaniach:",
            questionType: "text_long" as const,
            isRequired: false,
            order: 4,
          },
          {
            questionText: "Czy preferujesz meble drewniane?",
            questionType: "yes_no" as const,
            isRequired: true,
            order: 5,
          },
          {
            questionText: "Jaki jest Twój budżet na wyposażenie salonu?",
            questionType: "single_choice" as const,
            isRequired: false,
            order: 6,
            options: ["Do 20 000 zł", "20 000 - 50 000 zł", "50 000 - 100 000 zł", "Powyżej 100 000 zł", "Wolę nie podawać"]
          }
        ]
      },
      {
        title: "Ocena jakości wykonanych prac",
        description: "Ankieta dotycząca jakości wykonania i zadowolenia z realizacji projektu.",
        isRequired: true,
        allowMultipleResponses: false,
        targetAudience: "all_customers" as const,
        startDate: now,
        endDate: oneMonthFromNow,
        questions: [
          {
            questionText: "Oceń ogólną jakość wykonanych prac:",
            questionType: "rating" as const,
            isRequired: true,
            order: 1,
            ratingScale: { min: 1, max: 10, minLabel: "Bardzo słaba", maxLabel: "Doskonała" }
          },
          {
            questionText: "Czy prace zostały wykonane terminowo?",
            questionType: "single_choice" as const,
            isRequired: true,
            order: 2,
            options: ["Tak, w terminie", "Tak, z niewielkim opóźnieniem", "Z dużym opóźnieniem", "Nie zostały ukończone"]
          },
          {
            questionText: "Czy wszystkie materiały były zgodne z uzgodnieniami?",
            questionType: "yes_no" as const,
            isRequired: true,
            order: 3,
          },
          {
            questionText: "Co było największym wyzwaniem w trakcie realizacji?",
            questionType: "text_long" as const,
            isRequired: false,
            order: 4,
          },
          {
            questionText: "Czy poleciłbyś nasze usługi znajomym?",
            questionType: "rating" as const,
            isRequired: true,
            order: 5,
            ratingScale: { min: 1, max: 5, minLabel: "Zdecydowanie nie", maxLabel: "Zdecydowanie tak" }
          },
          {
            questionText: "Jakie elementy projektu podobały Ci się najbardziej?",
            questionType: "multiple_choice" as const,
            isRequired: false,
            order: 6,
            options: ["Kolorystyka", "Rozwiązania funkcjonalne", "Jakość materiałów", "Oświetlenie", "Układ przestrzeni", "Akcesoria", "Wszystko"]
          }
        ]
      },
      {
        title: "Ankieta funkcjonalności mieszkania",
        description: "Sprawdź, czy nowe wnętrze spełnia Twoje oczekiwania funkcjonalne.",
        isRequired: false,
        allowMultipleResponses: true,
        targetAudience: "all_customers" as const,
        startDate: now + 7 * 24 * 60 * 60 * 1000,
        endDate: oneMonthFromNow,
        questions: [
          {
            questionText: "Jak oceniasz funkcjonalność nowej kuchni?",
            questionType: "rating" as const,
            isRequired: true,
            order: 1,
            ratingScale: { min: 1, max: 5, minLabel: "Niepraktyczna", maxLabel: "Bardzo praktyczna" }
          },
          {
            questionText: "Czy ilość miejsca do przechowywania jest wystarczająca?",
            questionType: "single_choice" as const,
            isRequired: true,
            order: 2,
            options: ["Tak, w zupełności", "Tak, ale mogłoby być więcej", "Nie, zdecydowanie za mało", "Nie wiem jeszcze"]
          },
          {
            questionText: "Które pomieszczenia sprawdzają się najlepiej?",
            questionType: "multiple_choice" as const,
            isRequired: true,
            order: 3,
            options: ["Salon", "Kuchnia", "Sypialnia", "Łazienka", "Przedpokój", "Balkon/taras"]
          },
          {
            questionText: "Czy są jakieś elementy, które chciałbyś zmienić?",
            questionType: "text_long" as const,
            isRequired: false,
            order: 4,
          },
          {
            questionText: "Czy oświetlenie jest wystarczające we wszystkich pomieszczeniach?",
            questionType: "yes_no" as const,
            isRequired: true,
            order: 5,
          }
        ]
      }
    ];

    let surveysCreated = 0;
    
    for (const survey of surveys) {
      const { questions, ...surveyData } = survey;
      
      // Create survey
      const surveyId = await ctx.runMutation(api.surveys.createSurvey, {
        ...surveyData,
        projectId: project._id,
      });
      
      // Create questions for each survey
      for (const question of questions) {
        await ctx.runMutation(api.surveys.createSurveyQuestion, {
          surveyId: surveyId,
          ...question,
        });
      }
      
      surveysCreated++;
    }

    // Note: Survey responses will be created manually by users through the UI

    return {
      tasksCreated,
      shoppingItemsCreated,
      surveysCreated,
      sectionsCreated,
    };
  },
});
