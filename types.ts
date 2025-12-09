
export type Theme = 'light' | 'sepia' | 'dark';
export type TranslationMode = 'hebrew' | 'bilingual' | 'english';
export type TextAlign = 'center' | 'justify';

export interface Book {
  id: string;
  title: string;
  category: string;
}

export interface BookCategory {
  title: string;
  books: Book[];
}

export interface TextSelection {
  text: string;
  rect: DOMRect | null;
}

export interface TextChunk {
  id: number;
  hebrew: string;
  translation: string | null;
  isLoading: boolean;
  context?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface AIState {
  isLoading: boolean;
  messages: ChatMessage[];
  type: 'translation' | 'summary' | 'chat' | null;
  error: string | null;
  followUps?: string[];
}

export interface BookProgress {
  bookId: string;
  percentage: number;
  lastReadDate: string;
}

export interface Settings {
  theme: Theme;
  fontSize: number; // in rem
  lineHeight: number;
  translationMode: TranslationMode;
  textAlign: TextAlign;
  apiKey: string;
  dailyUsageCount: number;
  lastUsageDate: string; // YYYY-MM-DD
  progress: BookProgress[];
}

export interface WebcamState {
  isVisible: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}
