import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cloudEnabled, supabase } from '../lib/supabase';
import { startSync, stopSync } from '../lib/sync';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!cloudEnabled);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
      if (data.session) void startSync(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      setSession(next);
      if (event === 'SIGNED_IN' && next) void startSync(next.user.id);
      if (event === 'SIGNED_OUT') stopSync();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, ready, cloudEnabled };
}
