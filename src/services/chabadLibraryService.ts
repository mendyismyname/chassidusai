import { supabase } from '../integrations/supabase/client';
import { Book } from '../../types'; // Assuming Book type is defined in types.ts

interface ScrapedBook {
  author: string;
  title: string;
  url: string;
}

export const fetchAndStoreChabadLibraryBooks = async (): Promise<Book[]> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-chabad-library-books');

    if (error) {
      console.error('Error invoking get-chabad-library-books Edge Function:', error);
      throw new Error(error.message);
    }

    if (!data || !Array.isArray(data.books)) {
      throw new Error('Invalid data received from get-chabad-library-books Edge Function');
    }

    const scrapedBooks: ScrapedBook[] = data.books;
    const booksToInsert: Partial<Book>[] = [];
    const existingBookIds: Set<string> = new Set();

    // First, fetch existing books to avoid duplicates and get their IDs
    const { data: existingBooks, error: fetchError } = await supabase
      .from('books')
      .select('id, external_link');

    if (fetchError) {
      console.error('Error fetching existing books:', fetchError);
      // Continue without checking for duplicates if fetch fails
    } else if (existingBooks) {
      existingBooks.forEach(book => {
        if (book.external_link) {
          existingBookIds.add(book.external_link);
        }
      });
    }

    for (const scrapedBook of scrapedBooks) {
      if (!existingBookIds.has(scrapedBook.url)) {
        booksToInsert.push({
          title: scrapedBook.title,
          author: scrapedBook.author,
          external_link: scrapedBook.url,
          category: 'Chabad', // Default category for scraped books
          description: null, // Can be scraped later if needed
          image_url: null,
          full_text: null,
        });
      }
    }

    if (booksToInsert.length > 0) {
      const { data: insertedBooks, error: insertError } = await supabase
        .from('books')
        .insert(booksToInsert)
        .select('*'); // Select all columns of the inserted rows

      if (insertError) {
        console.error('Error inserting new books:', insertError);
        throw new Error(insertError.message);
      }
      console.log(`Inserted ${insertedBooks?.length || 0} new books.`);
      return insertedBooks as Book[];
    } else {
      console.log('No new books to insert.');
      return [];
    }

  } catch (error) {
    console.error('Failed to fetch and store Chabad library books:', error);
    throw error;
  }
};

export const getChabadBooksFromDB = async (): Promise<Book[]> => {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('category', 'Chabad'); // Filter by category if desired

  if (error) {
    console.error('Error fetching books from DB:', error);
    return [];
  }
  return data as Book[];
};