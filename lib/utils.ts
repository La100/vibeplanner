import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts HTML content to plain text for task previews
 * Removes HTML tags and limits to specified number of words
 */
export function htmlToPlainText(html: string, maxWords: number = 20): string {
  if (!html) return '';
  
  // Remove HTML tags
  const plainText = html.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = plainText;
  const decodedText = textarea.value;
  
  // Split into words and limit
  const words = decodedText.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return decodedText;
  }
  
  return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Gets task preview text - uses content (rich text) if available, falls back to description
 */
export function getTaskPreview(task: { content?: string; description?: string }, maxWords: number = 20): string {
  if (task.content) {
    return htmlToPlainText(task.content, maxWords);
  }
  
  if (task.description) {
    const words = task.description.trim().split(/\s+/);
    if (words.length <= maxWords) {
      return task.description;
    }
    return words.slice(0, maxWords).join(' ') + '...';
  }
  
  return '';
}
