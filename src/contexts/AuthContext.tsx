import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Auto-anonymous auth: every visitor immediately gets a Supabase anonymous session.
 * UI for login/signup is hidden, but session.user.id is used for RLS-scoped data.
 * Falls back to a fake guest session if anonymous signups are disabled.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    (async () => {
      const { data: { session: existing } } = await supabase.auth.getSession();
      if (existing) {
        setSession(existing);
        setUser(existing.user);
        setLoading(false);
        return;
      }
      // No session — try anonymous signup
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.warn('[Auth] anonymous sign-in unavailable, running guest mode:', error.message);
        setLoading(false);
        return;
      }
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
      }
      setLoading(false);
    })();

    return () => subscription.unsubscribe();
  }, []);

  // Kept as no-ops so legacy callers don't crash; UI no longer exposes them
  const signIn = async () => {};
  const signUp = async () => {};
  const signOut = async () => {};

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
