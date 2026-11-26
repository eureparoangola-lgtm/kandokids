import type { Session } from "@supabase/supabase-js";
import type { AppRole } from "@kandokids/shared";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";

export interface Profile {
  id: string;
  full_name: string;
  role: AppRole;
  company_id: string | null;
  phone: string | null;
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Só a resposta do pedido mais recente conta (ex.: após aceitar um convite, o papel muda
  // e um pedido anterior, mais lento, não pode repor o papel antigo).
  const latestRequest = useRef(0);
  async function loadProfile(userId: string) {
    const request = ++latestRequest.current;
    const { data } = await supabase.from("profiles").select("id, full_name, role, company_id, phone").eq("id", userId).single();
    if (request !== latestRequest.current) return;
    setProfile(data as Profile | null);
    setLoading(false);
  }

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    setLoading(true);
    loadProfile(session.user.id);
  }, [session?.user.id]);

  // Lê a sessão atual (e não a do render anterior): logo após o registo, `session` ainda pode estar vazio.
  async function refreshProfile() {
    const { data } = await supabase.auth.getSession();
    if (data.session) await loadProfile(data.session.user.id);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? "Email ou palavra-passe incorretos." : null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ loading, session, profile, signIn, signOut, refreshProfile }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
