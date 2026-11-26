import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(url, anonKey, {
  auth: {
    // No browser usamos o localStorage; no telemóvel, AsyncStorage.
    ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Só renovar o token enquanto a app está em primeiro plano (recomendação Supabase).
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Mensagem de erro legível (os erros da base de dados já vêm em português). */
export function errorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "object" && error && "message" in error) {
    const msg = String((error as { message: string }).message);
    if (/network|fetch/i.test(msg)) return "Sem ligação à internet. Tente novamente.";
    return msg;
  }
  return String(error);
}
