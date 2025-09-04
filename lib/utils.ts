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

/**
 * Format currency amount with proper symbol and locale
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  const currencyMap: Record<string, { symbol: string; locale: string }> = {
    'USD': { symbol: '$', locale: 'en-US' },
    'EUR': { symbol: '€', locale: 'de-DE' },
    'PLN': { symbol: 'zł', locale: 'pl-PL' },
    'GBP': { symbol: '£', locale: 'en-GB' },
    'CAD': { symbol: 'C$', locale: 'en-CA' },
    'AUD': { symbol: 'A$', locale: 'en-AU' },
    'JPY': { symbol: '¥', locale: 'ja-JP' },
    'CHF': { symbol: 'CHF', locale: 'de-CH' },
    'SEK': { symbol: 'kr', locale: 'sv-SE' },
    'NOK': { symbol: 'kr', locale: 'nb-NO' },
    'DKK': { symbol: 'kr', locale: 'da-DK' },
    'CZK': { symbol: 'Kč', locale: 'cs-CZ' },
    'HUF': { symbol: 'Ft', locale: 'hu-HU' },
    'CNY': { symbol: '¥', locale: 'zh-CN' },
    'INR': { symbol: '₹', locale: 'en-IN' },
    'BRL': { symbol: 'R$', locale: 'pt-BR' },
    'MXN': { symbol: '$', locale: 'es-MX' },
    'KRW': { symbol: '₩', locale: 'ko-KR' },
    'SGD': { symbol: 'S$', locale: 'en-SG' },
    'HKD': { symbol: 'HK$', locale: 'en-HK' },
  };

  const currency = currencyMap[currencyCode] || currencyMap['USD'];
  
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback to simple format if Intl.NumberFormat fails
    return `${currency.symbol}${amount.toFixed(2)}`;
  }
}
