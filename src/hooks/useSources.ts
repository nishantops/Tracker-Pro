import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface Source {
  source_id: string;
  title: string;
  link: string | null;
  topic: string;
  notes: string | null;
}

export interface SourceFormData {
  title: string;
  link: string;
  topic: string;
  notes: string;
}

export const EMPTY_SOURCE_FORM: SourceFormData = {
  title: '', link: '', topic: 'General', notes: '',
};

export const SOURCE_TOPICS = [
  'General', 'Current Affairs', 'History', 'Geography', 'Polity', 'Economy',
  'Science & Tech', 'Environment', 'Ethics', 'Anthropology', 'Essay',
  'Newspaper', 'YouTube', 'Test Series', 'Other',
] as const;

export const TOPIC_COLORS: Record<string, string> = {
  General: '#64748b', 'Current Affairs': '#f59e0b', History: '#f43f5e',
  Geography: '#10b981', Polity: '#6366f1', Economy: '#8b5cf6',
  'Science & Tech': '#06b6d4', Environment: '#84cc16', Ethics: '#d946ef',
  Anthropology: '#f97316', Essay: '#14b8a6', Newspaper: '#eab308',
  YouTube: '#ef4444', 'Test Series': '#6366f1', Other: '#94a3b8',
};

export function useSources() {
  const { user } = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data } = await supabase
          .from('upsc_user_sources')
          .select('source_id, title, link, topic, notes')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        setSources(data ?? []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const saveSource = useCallback(
    async (form: SourceFormData, existingId?: string) => {
      if (!user) return;
      const sourceId = existingId ?? `src_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const row = {
        source_id: sourceId,
        user_id: user.id,
        title: form.title,
        link: form.link || null,
        topic: form.topic,
        notes: form.notes || null,
      };
      const { error } = await supabase
        .from('upsc_user_sources')
        .upsert(row, { onConflict: 'source_id,user_id' });

      if (!error) {
        setSources((prev) => {
          const idx = prev.findIndex((s) => s.source_id === sourceId);
          const src: Source = { source_id: sourceId, title: form.title, link: form.link || null, topic: form.topic, notes: form.notes || null };
          if (idx >= 0) { const c = [...prev]; c[idx] = src; return c; }
          return [src, ...prev];
        });
      }
    },
    [user],
  );

  const deleteSource = useCallback(
    async (sourceId: string) => {
      if (!user) return;
      await supabase.from('upsc_user_sources').delete().eq('source_id', sourceId).eq('user_id', user.id);
      setSources((prev) => prev.filter((s) => s.source_id !== sourceId));
    },
    [user],
  );

  return { sources, loading, saveSource, deleteSource };
}
