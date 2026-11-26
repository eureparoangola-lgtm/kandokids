import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, supabase } from "./supabase";

/**
 * Chama uma função RPC, recarrega ao voltar ao ecrã e (opcionalmente) a cada N segundos.
 * O polling garante atualização mesmo quando o tempo real não está disponível (rede fraca).
 */
export function useRpc<T>(fn: string, args?: Record<string, unknown>, opts: { pollSeconds?: number; enabled?: boolean } = {}) {
  const { pollSeconds, enabled = true } = opts;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const argsKey = JSON.stringify(args ?? {});
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    if (!enabled) return;
    const { data: result, error: err } = await supabase.rpc(fn, JSON.parse(argsKey));
    if (!mounted.current) return;
    if (err) setError(errorMessage(err));
    else {
      setError(null);
      setData(result as T);
    }
    setLoading(false);
  }, [fn, argsKey, enabled]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      if (!pollSeconds) return;
      const id = setInterval(reload, pollSeconds * 1000);
      return () => clearInterval(id);
    }, [reload, pollSeconds]),
  );

  return { data, error, loading, reload };
}

/** Recarrega quando há alterações numa tabela (Supabase Realtime). */
export function useRealtime(table: string, filter: string | undefined, onChange: () => void, enabled = true) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`${table}:${filter ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, () => cb.current())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, enabled]);
}
