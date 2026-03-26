import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { queryClient } from "../lib/queryClient";

type UseAuthResult = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirm: boolean }>;
  signInWithGoogle: (redirectPath?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    const needsEmailConfirm = !data.session;
    return { error: error?.message ?? null, needsEmailConfirm };
  }, []);

  const signInWithGoogle = useCallback(async (redirectPath = "/auth/callback") => {
    const redirectTo = `${window.location.origin}${redirectPath}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    window.location.href = "/login";
  }, []);

  return useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signIn,
      signUp,
      signInWithGoogle,
      signOut
    }),
    [session, loading, signIn, signOut, signUp, signInWithGoogle]
  );
}
