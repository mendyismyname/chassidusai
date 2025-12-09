import { useState, useEffect } from 'react';
import { getChapterContent, ChapterContent } from '../services/libraryService';

export const useChapterContent = (chapterId: string | null) => {
  const [content, setContent] = useState<ChapterContent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chapterId) {
      setContent([]);
      setLoading(false);
      return;
    }

    const fetchContent = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getChapterContent(chapterId);
        setContent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [chapterId]);

  return { content, loading, error };
};