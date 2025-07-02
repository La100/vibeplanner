"use client";

import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import AdvancedEditor from './index';

interface TaskEditorProps {
  taskId: string;
  initialContent?: string;
  placeholder?: string;
}

export default function TaskEditor({ 
  taskId, 
  initialContent = '', 
  placeholder = "Opisz szczegóły zadania..." 
}: TaskEditorProps) {
  const updateTask = useMutation(api.myFunctions.updateTask);

  const handleSave = useCallback(async (content: string) => {
    try {
      await updateTask({
        taskId: taskId as Id<"tasks">,
        content: content, // Używamy pola 'content' dla rich text
      });
    } catch (error) {
      console.error('Błąd podczas zapisywania zadania:', error);
      throw error; // Re-throw żeby AdvancedEditor mógł obsłużyć błąd
    }
  }, [taskId, updateTask]);

  return (
    <div className="task-editor">
      <AdvancedEditor
        content={initialContent}
        onSave={handleSave}
        placeholder={placeholder}
        autoSave={true}
        autoSaveDelay={3000} // 3 sekundy dla zadań
        className="min-h-[400px]"
      />
    </div>
  );
} 