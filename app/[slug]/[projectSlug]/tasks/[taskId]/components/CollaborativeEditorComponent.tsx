"use client";

import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import AdvancedEditor from "@/components/ui/advanced-editor/AdvancedEditor";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";

interface CollaborativeEditorComponentProps {
  taskId: string;
  onCreateDocument: () => void;
}

export default function CollaborativeEditorComponent({ 
  taskId, 
  onCreateDocument 
}: CollaborativeEditorComponentProps) {
  const sync = useTiptapSync(api.prosemirrorSync, taskId || "");

  if (sync.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-muted-foreground">Ładowanie epickich slash commands...</span>
      </div>
    );
  }

  if (sync.initialContent !== null) {
    return (
      <div className="task-detail-main">
        <AdvancedEditor
          content={typeof sync.initialContent === 'string' ? sync.initialContent : JSON.stringify(sync.initialContent)}
          extensions={[sync.extension]}
          editable={true}
          onUpdate={(content: string) => {
            console.log("Content updated with slash commands:", content);
          }}
        />
      </div>
    );
  }

  const handleCreateDocument = () => {
    // Tworzymy dokument z szablonem i slash commands
    const templateContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "📋 Nowe zadanie" }]
        },
        {
          type: "paragraph",
          content: [{ 
            type: "text", 
            text: "Wpisz / aby zobaczyć dostępne opcje formatowania! 🚀" 
          }]
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "🎯 Cel zadania" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Co chcemy osiągnąć?" }]
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "📝 Szczegóły" }]
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ 
                type: "paragraph", 
                content: [{ type: "text", text: "Punkt pierwszy" }] 
              }]
            },
            {
              type: "listItem", 
              content: [{ 
                type: "paragraph", 
                content: [{ type: "text", text: "Punkt drugi" }] 
              }]
            }
          ]
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "✅ Checklist" }]
        },
        {
          type: "paragraph",
          content: [{ 
            type: "text", 
            text: "Użyj / aby dodać więcej bloków:" 
          }]
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ 
                type: "paragraph", 
                content: [{ type: "text", text: "/h1 - Duży nagłówek" }] 
              }]
            },
            {
              type: "listItem",
              content: [{ 
                type: "paragraph", 
                content: [{ type: "text", text: "/table - Tabela" }] 
              }]
            },
            {
              type: "listItem",
              content: [{ 
                type: "paragraph", 
                content: [{ type: "text", text: "/code - Blok kodu" }] 
              }]
            },
            {
              type: "listItem",
              content: [{ 
                type: "paragraph", 
                content: [{ type: "text", text: "/emoji - Emoji picker 🎉" }] 
              }]
            }
          ]
        }
      ]
    };

    // Inicjalizuj dokument z szablonem
    if (sync?.create) {
      sync.create(templateContent);
    } else {
      onCreateDocument();
    }
  };

  return (
    <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl">
      <div className="text-8xl mb-6">✨</div>
      <h3 className="text-2xl font-bold mb-3 text-gray-900">Rozpocznij pisanie!</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
        Utwórz nowy dokument z pełną obsługą slash commands. 
        Wpisz <code className="bg-white px-2 py-1 rounded font-mono text-blue-600">/</code> aby zobaczyć wszystkie opcje!
      </p>
      <Button onClick={handleCreateDocument} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg">
        🚀 Utwórz dokument z slash commands
      </Button>
      <div className="mt-8 grid grid-cols-2 gap-4 max-w-md mx-auto text-sm text-gray-500">
        <div className="bg-white p-3 rounded-lg">
          <div className="font-semibold">📝 Rich Text</div>
          <div>Formatowanie tekstu</div>
        </div>
        <div className="bg-white p-3 rounded-lg">
          <div className="font-semibold">📋 Tabele</div>
          <div>Zaawansowane tabele</div>
        </div>
        <div className="bg-white p-3 rounded-lg">
          <div className="font-semibold">🎨 Kolory</div>
          <div>Kolorowanie tekstu</div>
        </div>
        <div className="bg-white p-3 rounded-lg">
          <div className="font-semibold">🚀 Slash Commands</div>
          <div>Wpisz / dla opcji</div>
        </div>
      </div>
    </div>
  );
} 