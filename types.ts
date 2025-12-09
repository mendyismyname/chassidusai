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
  localProgress: BookProgress[]; // Added for guest users
}

export interface WebcamState {
  isVisible: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  updated_at: string | null;
  title: string | null;
  location: string | null;
  phone: string | null;
  bio: string | null;
  skills: string[] | null;
  experience: any[] | null;
  // Add settings fields to profile for persistence
  theme: Theme | null;
  font_size: number | null;
  line_height: number | null;
  translation_mode: TranslationMode | null;
  text_align: TextAlign | null;
  progress: BookProgress[] | null;
}