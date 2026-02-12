"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, Flame, Landmark, Leaf, Sparkles } from "lucide-react";

interface AssistantTypeSelectorProps {
  onSelect: (type: "gymbro" | "custom" | "martin" | "monk" | "marcus" | "startup" | "skip") => void;
}

export function AssistantTypeSelector({ onSelect }: AssistantTypeSelectorProps) {
  return (
    <div className="fixed inset-0 z-[50] bg-background flex items-center justify-center animate-in fade-in duration-300">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Witaj w Twoim Asystencie
          </h1>
          <p className="text-lg text-muted-foreground">
            Wybierz, czym ma się zajmować Twój asystent
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => onSelect("gymbro")}
          >
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Dumbbell className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Gym Bro</CardTitle>
              </div>
              <CardDescription className="text-base">
                Asystent, który pomoże Ci w treningach, odżywianiu i osiąganiu celów fitness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Personalizowane plany treningowe</li>
                <li>• Śledzenie postępów</li>
                <li>• Porady dotyczące żywienia</li>
                <li>• Motywacja i wsparcie</li>
              </ul>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => onSelect("martin")}
          >
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Flame className="h-6 w-6 text-orange-500" />
                </div>
                <CardTitle className="text-xl">Martin</CardTitle>
              </div>
              <CardDescription className="text-base">
                Asystent do rutyn, medytacji, Wim Hofa i planowania tygodnia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Proponuje nawyki i plan tygodnia</li>
                <li>• Stały blok kodowania 08:00–12:00</li>
                <li>• Medytacja i oddech</li>
                <li>• Trening i regeneracja</li>
              </ul>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => onSelect("marcus")}
          >
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-stone-500/10">
                  <Landmark className="h-6 w-6 text-stone-600" />
                </div>
                <CardTitle className="text-xl">Marek Aureliusz (Stoicyzm)</CardTitle>
              </div>
              <CardDescription className="text-base">
                Spokój, dyscyplina i jasność działania w codziennych decyzjach
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Priorytety i kontrola reakcji</li>
                <li>• Krótkie rytuały i refleksja</li>
                <li>• Praca na tym, co zależne</li>
                <li>• Stabilna motywacja bez presji</li>
              </ul>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => onSelect("monk")}
          >
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-teal-500/10">
                  <Leaf className="h-6 w-6 text-teal-600" />
                </div>
                <CardTitle className="text-xl">Monk</CardTitle>
              </div>
              <CardDescription className="text-base">
                Spokojny asystent do uważności, dyscypliny i codziennej stabilizacji
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Medytacja i oddech</li>
                <li>• Rytm dnia i koncentracja</li>
                <li>• Redukcja napięcia i wyciszenie</li>
                <li>• Regularna praktyka bez presji</li>
              </ul>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => onSelect("custom")}
          >
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Sparkles className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle className="text-xl">Własny Asystent</CardTitle>
              </div>
              <CardDescription className="text-base">
                Stwórz asystenta dostosowanego do Twoich unikalnych potrzeb
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Pełna personalizacja</li>
                <li>• Własne instrukcje i cele</li>
                <li>• Dowolne zastosowania</li>
                <li>• Elastyczne możliwości</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => onSelect("skip")}
            className="text-muted-foreground hover:text-foreground"
          >
            Pomiń i przejdź do dashboardu
          </Button>
        </div>
      </div>
    </div>
  );
}
