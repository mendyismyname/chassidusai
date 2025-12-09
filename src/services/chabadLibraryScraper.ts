import { supabase } from '../integrations/supabase/client';

interface ChabadBookSection {
  title: string;
  url: string;
}

interface ChabadSectionContent {
  title: string;
  content: string;
}

export const fetchChabadBookSections = async (bookUrl: string): Promise<ChabadBookSection[]> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-chabad-book-sections', {
      body: { bookUrl },
    });

    if (error) {
      console.error('Error invoking get-chabad-book-sections Edge Function:', error);
      throw new Error(error.message);
    }

    if (data && Array.isArray(data.sections)) {
      return data.sections as ChabadBookSection[];
    } else {
      throw new Error('Invalid data received from get-chabad-book-sections Edge Function');
    }
  } catch (error) {
    console.error('Failed to fetch Chabad book sections:', error);
    throw error;
  }
};

export const fetchChabadSectionContent = async (sectionUrl: string): Promise<ChabadSectionContent> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-chabad-section-content', {
      body: { sectionUrl },
    });

    if (error) {
      console.error('Error invoking get-chabad-section-content Edge Function:', error);
      throw new Error(error.message);
    }

    if (data && data.title !== undefined && data.content !== undefined) {
      return data as ChabadSectionContent;
    } else {
      throw new Error('Invalid data received from get-chabad-section-content Edge Function');
    }
  } catch (error) {
    console.error('Failed to fetch Chabad section content:', error);
    throw error;
  }
};