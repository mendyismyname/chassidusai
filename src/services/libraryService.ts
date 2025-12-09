import { supabase } from '../integrations/supabase/client';

// Type Definitions
export interface Author {
  id: string;
  name: string;
}

export interface Book {
  id: string;
  author_id: string;
  title: string;
}

export interface Chapter {
  id: string;
  book_id: string;
  title: string;
  sequence_number: number;
}

export interface Segment {
  id: string;
  chapter_id: string;
  hebrew_text: string;
  english_translation: string | null;
  sequence_number: number;
}

// Return type for chapter content
export interface ChapterContent {
  hebrew: string;
  english: string | null;
  seq: number;
}

// Fetching Functions
export async function getAuthors(): Promise<Author[]> {
  const { data, error } = await supabase
    .from('authors')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getBooks(authorId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('id, author_id, title')
    .eq('author_id', authorId)
    .order('title', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getChapters(bookId: string): Promise<Chapter[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, book_id, title, sequence_number')
    .eq('book_id', bookId)
    .order('sequence_number', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getChapterContent(chapterId: string): Promise<ChapterContent[]> {
  const { data, error } = await supabase
    .from('segments')
    .select('id, chapter_id, hebrew_text, english_translation, sequence_number')
    .eq('chapter_id', chapterId)
    .order('sequence_number', { ascending: true });

  if (error) throw error;
  
  return (data || []).map(segment => ({
    hebrew: segment.hebrew_text,
    english: segment.english_translation,
    seq: segment.sequence_number
  }));
}