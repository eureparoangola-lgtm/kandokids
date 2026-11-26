import { router } from "expo-router";
import { useState } from "react";
import { Banner, Button, Field, Muted, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { errorMessage, supabase } from "@/lib/supabase";

/** Para quem já tem conta: adicionar outro filho ou entrar numa equipa com um código. */
export default function EnterCode() {
  const { refreshProfile } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("accept_invite", { p_code: code });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    await refreshProfile();
    router.replace("/");
  }

  return (
    <Screen>
      <Title>Código de convite</Title>
      <Muted>Recebeu um código da empresa de transporte? Introduza-o para ligar outra criança à sua conta.</Muted>
      <Field label="Código" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" />
      {error && <Banner>{error}</Banner>}
      <Button title="Confirmar" onPress={submit} loading={busy} disabled={code.trim().length < 6} />
    </Screen>
  );
}
