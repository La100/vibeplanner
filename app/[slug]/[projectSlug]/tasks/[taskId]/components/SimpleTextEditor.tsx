"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Bold, 
  Italic, 
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Type,
  Save,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface SimpleTextEditorProps {
  taskId: string;
  initialContent?: string;
}

const slashCommands = [
  { trigger: '/h1 ', replacement: '# ', name: 'Heading 1' },
  { trigger: '/h2 ', replacement: '## ', name: 'Heading 2' },
  { trigger: '/h3 ', replacement: '### ', name: 'Heading 3' },
  { trigger: '/list ', replacement: '- ', name: 'Bullet List' },
  { trigger: '/ol ', replacement: '1. ', name: 'Numbered List' },
  { trigger: '/todo ', replacement: '- [ ] ', name: 'Todo Item' },
  { trigger: '/done ', replacement: '- [x] ', name: 'Done Item' },
  { trigger: '/quote ', replacement: '> ', name: 'Quote' },
];

export default function SimpleTextEditor({ taskId, initialContent = "" }: SimpleTextEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const updateTask = useMutation(api.myFunctions.updateTask);

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;
    
    setIsSaving(true);
    try {
      await updateTask({
        taskId: taskId as Id<"tasks">,
        description: content,
      });
      setHasChanges(false);
      toast.success("💾 Zapisano automatycznie");
    } catch (error) {
      toast.error("❌ Błąd podczas zapisywania");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, content, taskId, updateTask]);

  // Auto-save functionality
  useEffect(() => {
    if (!hasChanges) return;
    
    const timer = setTimeout(async () => {
      await handleSave();
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [content, hasChanges, handleSave]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursor = e.target.selectionStart;
    
    setContent(newContent);
    setCursorPosition(cursor);
    setHasChanges(true);

    // Check for slash commands
    const lines = newContent.substring(0, cursor).split('\n');
    const currentLine = lines[lines.length - 1];
    
         if (currentLine.endsWith('/')) {
       setShowSlashMenu(true);
     } else {
      // Check if user typed a slash command
      for (const command of slashCommands) {
        if (currentLine.endsWith(command.trigger)) {
          executeSlashCommand(command, e.target, cursor);
          break;
        }
      }
      setShowSlashMenu(false);
    }
  };

  const executeSlashCommand = (command: { trigger: string; replacement: string; name: string }, textarea: HTMLTextAreaElement, cursor: number) => {
    const beforeCursor = content.substring(0, cursor - command.trigger.length);
    const afterCursor = content.substring(cursor);
    const newContent = beforeCursor + command.replacement + afterCursor;
    
    setContent(newContent);
    setHasChanges(true);
    
    // Move cursor to end of replacement
    setTimeout(() => {
      const newCursorPos = beforeCursor.length + command.replacement.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const insertFormatting = (before: string, after: string = before) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    const beforeText = content.substring(0, start);
    const afterText = content.substring(end);
    
    const newContent = beforeText + before + selectedText + after + afterText;
    setContent(newContent);
    setHasChanges(true);
    
    // Move cursor
    setTimeout(() => {
      const newStart = start + before.length;
      const newEnd = newStart + selectedText.length;
      textarea.setSelectionRange(newEnd + after.length, newEnd + after.length);
      textarea.focus();
    }, 0);
  };

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertFormatting('**')}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertFormatting('*')}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertFormatting('\n# ', '')}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertFormatting('\n## ', '')}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertFormatting('\n- ', '')}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertFormatting('\n1. ', '')}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-orange-600 flex items-center gap-1">
              <Type className="h-3 w-3" />
              Niezapisane zmiany
            </span>
          )}
          {isSaving && (
            <span className="text-xs text-blue-600 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Zapisywanie...
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            <Save className="h-4 w-4 mr-1" />
            Zapisz
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        <Textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Zacznij pisać... 

Użyj slash commands:
/h1 dla nagłówka
/list dla listy
/todo dla zadania
/quote dla cytatu"
          className="min-h-[500px] resize-none border-0 rounded-t-none focus:ring-0 font-mono text-sm leading-relaxed"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}
        />

        {/* Slash Commands Menu */}
        {showSlashMenu && (
          <div className="absolute left-4 bottom-4 bg-white shadow-lg border rounded-lg py-2 z-50 min-w-64">
            <div className="text-xs text-gray-500 px-3 py-1 font-medium">POLECENIA</div>
            {slashCommands.map((command, index) => (
              <button
                key={index}
                onClick={() => {
                  const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                  executeSlashCommand(command, textarea, cursorPosition);
                  setShowSlashMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-3"
              >
                <span className="font-mono text-xs text-blue-600">{command.trigger.trim()}</span>
                <span className="text-sm">{command.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preview hint */}
      <div className="p-3 border-t bg-gray-50 rounded-b-lg">
        <p className="text-xs text-gray-500">
                     💡 Używa składni Markdown. **bold**, *italic*, # nagłówki, - listy, &gt; cytaty
        </p>
      </div>
    </div>
  );
} 