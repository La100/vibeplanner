"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProject } from '@/components/providers/ProjectProvider';
import { toast } from "sonner";
import { 
  Settings, 
  RotateCcw, 
  Save, 
  Sparkles,
  Copy,
  Check
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function InlinePromptManager() {
  const { project } = useProject();
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Queries
  const activePrompt = useQuery(api.aiPrompts.getActiveCustomPrompt, 
    project ? { projectId: project._id } : "skip"
  );
  const defaultTemplate = useQuery(api.aiPrompts.getDefaultPromptTemplate, {});

  // Mutations
  const saveCustomPrompt = useMutation(api.aiPrompts.saveCustomPrompt);
  const updateCustomPrompt = useMutation(api.aiPrompts.updateCustomPrompt);
  const resetToDefault = useMutation(api.aiPrompts.resetToDefaultPrompt);

  // Initialize custom prompt when dialog opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Always show current active prompt (custom or default)
      if (activePrompt) {
        // User has custom prompt - show it
        setCustomPrompt(activePrompt.customPrompt);
      } else if (defaultTemplate) {
        // No custom prompt - show default template
        setCustomPrompt(defaultTemplate);
      }
    }
  };

  const handleSave = async () => {
    if (!project || !customPrompt.trim()) return;

    setIsSaving(true);
    try {
      if (activePrompt) {
        await updateCustomPrompt({
          promptId: activePrompt._id,
          customPrompt: customPrompt.trim(),
        });
        toast.success("Prompt został zaktualizowany!");
      } else {
        await saveCustomPrompt({
          projectId: project._id,
          customPrompt: customPrompt.trim(),
        });
        toast.success("Własny prompt został zapisany!");
      }
      setIsOpen(false);
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error("Błąd podczas zapisywania promptu");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!project) return;

    try {
      await resetToDefault({ projectId: project._id });
      setCustomPrompt("");
      toast.success("Przywrócono domyślny prompt AI");
      setIsOpen(false);
    } catch (error) {
      console.error("Error resetting prompt:", error);
      toast.error("Błąd podczas przywracania domyślnego promptu");
    }
  };

  const handleLoadTemplate = () => {
    if (defaultTemplate) {
      setCustomPrompt(defaultTemplate);
      toast.info("Załadowano szablon domyślnego promptu");
    }
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Skopiowano do schowka");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Błąd kopiowania do schowka");
    }
  };

  if (!project) return null;

  const hasCustomPrompt = !!activePrompt;
  const isModified = activePrompt ? customPrompt !== activePrompt.customPrompt : customPrompt.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Prompt AI</span>
          {hasCustomPrompt && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              <Sparkles className="h-2.5 w-2.5" />
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Ustawienia Promptu AI
          </DialogTitle>
          <DialogDescription>
            Dostosuj sposób w jaki AI asystent odpowiada na Twoje pytania
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Status */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Obecnie aktywny:</span>
              {hasCustomPrompt ? (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Własny prompt
                </Badge>
              ) : (
                <Badge variant="outline">
                  <Settings className="h-3 w-3 mr-1" />
                  Domyślny prompt
                </Badge>
              )}
            </div>
            
            {hasCustomPrompt && (
              <div className="text-xs text-muted-foreground">
                Ostatnia zmiana: {new Date(activePrompt.updatedAt).toLocaleDateString('pl-PL')}
              </div>
            )}
          </div>

          {!hasCustomPrompt && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Widzisz domyślny prompt.</strong> Możesz go edytować i zapisać jako własny, 
                lub załadować szablon i dostosować do swoich potrzeb.
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadTemplate}
              disabled={!defaultTemplate}
            >
              <Copy className="h-4 w-4 mr-2" />
              Załaduj szablon
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopyToClipboard(customPrompt)}
              disabled={!customPrompt}
            >
              {copied ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Kopiuj
            </Button>
          </div>

          {/* Editor */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Prompt AI:</label>
            <ScrollArea className="h-[400px] w-full">
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={hasCustomPrompt 
                  ? "Edytuj swój własny prompt..." 
                  : "Ładowanie domyślnego promptu... Możesz go edytować i zapisać jako własny."
                }
                className="min-h-[380px] font-mono text-sm resize-none"
              />
            </ScrollArea>
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{customPrompt.length} znaków</span>
              {isModified && <span className="text-orange-600">• Niezapisane zmiany</span>}
            </div>
          </div>

          {/* Help */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-1">💡 Wskazówki:</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Określ styl odpowiedzi (formalny/nieformalny)</li>
              <li>• Dodaj specjalizację (np. styl minimalistyczny, klasyczny)</li>
              <li>• Zachowaj bloki [CREATE_TASK] aby AI mogło tworzyć zadania</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasCustomPrompt}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset do domyślnego
          </Button>
          <Button
            onClick={handleSave}
            disabled={!customPrompt.trim() || isSaving || !isModified}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Zapisywanie..." : "Zapisz prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
