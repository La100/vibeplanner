"use client";

import { EditorContent, EditorProvider, useCurrentEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Button } from "@/components/ui/button";
import { 
  Bold, 
  Italic, 
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Smile,
  Table as TableIcon
} from "lucide-react";
import { useState } from 'react';

interface AdvancedEditorProps {
  content: Record<string, unknown> | string;
  extensions: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  editable?: boolean;
  onUpdate?: (content: string) => void;
}

// Slash commands data
const slashCommands = [
  {
    title: '📝 Tekst',
    description: 'Zwykły paragraf tekstu',
    command: 'paragraph',
  },
  {
    title: '📋 Nagłówek 1',
    description: 'Duży nagłówek sekcji',
    command: 'heading1',
  },
  {
    title: '📄 Nagłówek 2',
    description: 'Średni nagłówek podsekcji', 
    command: 'heading2',
  },
  {
    title: '📑 Nagłówek 3',
    description: 'Mały nagłówek',
    command: 'heading3',
  },
  {
    title: '• Lista punktowa',
    description: 'Utwórz listę z punktami',
    command: 'bulletList',
  },
  {
    title: '1. Lista numerowana',
    description: 'Utwórz listę numerowaną',
    command: 'orderedList',
  },
  {
    title: '💬 Cytat',
    description: 'Wyróżnij tekst jako cytat',
    command: 'blockquote',
  },
  {
    title: '🔢 Tabela',
    description: 'Dodaj tabelę',
    command: 'table',
  },
  {
    title: '💻 Kod',
    description: 'Blok kodu z podświetlaniem składni',
    command: 'codeBlock',
  },
  {
    title: '➖ Separator',
    description: 'Dodaj poziomą linię',
    command: 'horizontalRule',
  },
];

// Emoji picker data
const commonEmojis = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
  '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋',
  '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳',
  '👍', '👎', '👌', '🤌', '👊', '✊', '🤛', '🤜', '👏', '🙌',
  '🔥', '💯', '💪', '🚀', '⭐', '✨', '💎', '🎯', '📝', '📋',
  '📊', '📈', '📉', '💡', '🔧', '⚡', '🌟', '🎉', '🎊', '🔔'
];

function EditorToolbar() {
  const { editor } = useCurrentEditor();
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  if (!editor) {
    return null;
  }

  const executeSlashCommand = (command: string) => {
    switch (command) {
      case 'paragraph':
        editor.chain().focus().setParagraph().run();
        break;
      case 'heading1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'heading2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'heading3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'table':
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case 'codeBlock':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'horizontalRule':
        editor.chain().focus().setHorizontalRule().run();
        break;
    }
    setShowSlashMenu(false);
  };



  const addEmoji = (emoji: string) => {
    editor.chain().focus().insertContent(emoji).run();
    setShowEmojiPicker(false);
  };

  return (
    <div className="border-b p-2 flex flex-wrap gap-1 bg-gray-50">
      {/* Format buttons */}
      <Button
        variant={editor.isActive('bold') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Button>
      
      <Button
        variant={editor.isActive('italic') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('strike') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('code') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Heading buttons */}
      <Button
        variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* List buttons */}
      <Button
        variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('blockquote') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Advanced buttons */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon className="h-4 w-4" />
      </Button>

      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          <Smile className="h-4 w-4" />
        </Button>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute top-full left-0 mt-1 bg-white shadow-lg border rounded-lg p-4 z-50 max-w-sm">
            <div className="text-sm font-medium mb-2">Wybierz emoji:</div>
            <div className="grid grid-cols-10 gap-1">
              {commonEmojis.map((emoji, index) => (
                <button
                  key={index}
                  onClick={() => addEmoji(emoji)}
                  className="p-1 hover:bg-gray-100 rounded text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative ml-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSlashMenu(!showSlashMenu)}
        >
          <span className="text-sm font-mono">/</span> Polecenia
        </Button>

        {/* Slash Commands Menu */}
        {showSlashMenu && (
          <div className="absolute top-full right-0 mt-1 bg-white shadow-lg border rounded-lg py-2 z-50 min-w-64">
            <div className="text-xs text-gray-500 px-3 py-1 font-medium">BLOKI</div>
            {slashCommands.map((command, index) => (
              <button
                key={index}
                onClick={() => executeSlashCommand(command.command)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-start gap-3"
              >
                <div className="text-sm">
                  <div className="font-medium">{command.title}</div>
                  <div className="text-gray-500 text-xs">{command.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdvancedEditor({ content, extensions, editable = true, onUpdate }: AdvancedEditorProps) {
  const lowlight = createLowlight();

  const editorExtensions = [
    StarterKit.configure({
      codeBlock: false,
    }),
    Placeholder.configure({
      placeholder: 'Wpisz "/h1" dla nagłówka, "/list" dla listy, "/table" dla tabeli lub "/" w toolbar...',
    }),
    Link.configure({
      openOnClick: false,
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    Image.configure({
      HTMLAttributes: {
        class: 'rounded-lg max-w-full h-auto',
      },
    }),
    CodeBlockLowlight.configure({
      lowlight,
    }),
    TextStyle,
    Color,
    Highlight.configure({
      multicolor: true,
    }),
    ...extensions,
  ];

  return (
    <EditorProvider
      content={content}
      extensions={editorExtensions}
      editable={editable}
      onUpdate={({ editor }) => {
        const currentText = editor.getText();
        
        // Check for slash commands in the text
        if (currentText.includes('/')) {
          const lines = currentText.split('\n');
          const currentLine = lines[lines.length - 1];
          
          // Check if any line ends with a slash command pattern
          const slashPatterns = [
            { pattern: '/h1 ', action: () => {
              editor.commands.deleteRange({ from: editor.state.selection.from - 4, to: editor.state.selection.from });
              editor.chain().focus().toggleHeading({ level: 1 }).run();
            }},
            { pattern: '/h2 ', action: () => {
              editor.commands.deleteRange({ from: editor.state.selection.from - 4, to: editor.state.selection.from });
              editor.chain().focus().toggleHeading({ level: 2 }).run();
            }},
            { pattern: '/h3 ', action: () => {
              editor.commands.deleteRange({ from: editor.state.selection.from - 4, to: editor.state.selection.from });
              editor.chain().focus().toggleHeading({ level: 3 }).run();
            }},
            { pattern: '/list ', action: () => {
              editor.commands.deleteRange({ from: editor.state.selection.from - 6, to: editor.state.selection.from });
              editor.chain().focus().toggleBulletList().run();
            }},
            { pattern: '/ol ', action: () => {
              editor.commands.deleteRange({ from: editor.state.selection.from - 4, to: editor.state.selection.from });
              editor.chain().focus().toggleOrderedList().run();
            }},
            { pattern: '/quote ', action: () => {
              editor.commands.deleteRange({ from: editor.state.selection.from - 7, to: editor.state.selection.from });
              editor.chain().focus().toggleBlockquote().run();
            }},
            { pattern: '/table ', action: () => {
              editor.commands.deleteRange({ from: editor.state.selection.from - 7, to: editor.state.selection.from });
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            }},
            { pattern: '/code ', action: () => {
              editor.commands.deleteRange({ from: editor.state.selection.from - 6, to: editor.state.selection.from });
              editor.chain().focus().toggleCodeBlock().run();
            }},
            { pattern: '/hr ', action: () => {
              editor.commands.deleteRange({ from: editor.state.selection.from - 4, to: editor.state.selection.from });
              editor.chain().focus().setHorizontalRule().run();
            }},
          ];
          
          for (const { pattern, action } of slashPatterns) {
            if (currentLine.endsWith(pattern)) {
              action();
              break;
            }
          }
        }
        
        if (onUpdate) {
          onUpdate(editor.getHTML());
        }
      }}
    >
      <div className="border rounded-lg overflow-hidden bg-white">
        <EditorToolbar />
        
        <div className="prose prose-sm max-w-none min-h-[400px] focus-within:outline-none">
          <EditorContent 
            editor={null}
            className="min-h-[400px] p-4 focus:outline-none"
          />
        </div>
      </div>
    </EditorProvider>
  );
} 