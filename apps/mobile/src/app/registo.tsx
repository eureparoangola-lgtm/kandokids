import { router, useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import { useState } from "react";
import { Banner, Button, Field, Muted, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { errorMessage, supabase } from "@/lib/supabase";

/** Registo com o código de convite enviado pela empresa (encarregados e equipa). */
export default function Register() {
  const { refreshProfile } = useAuth();
  const params = useLocalSearchParams<{ codigo?: string }>();
  const [form, setForm] = useState({ name: "", phone: "+244 ", email: "", password: "", code: (params.codigo ?? "").toUpperCase() });
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setError(null);
    if (form.password.length < 8) return setError("A palavra-passe deve ter pelo menos 8 caracteres.");
    setBusy(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        // O código fica guardado na conta: se for preciso confirmar o email, a criança é ligada no primeiro login.
        data: { full_name: form.name.trim(), phone: form.phone.replace(/\s/g, ""), pending_invite: form.code.trim().toUpperCase() },
        ...(Platform.OS === "web" && typeof window !== "undefined"
          ? { emailRedirectTo: `${window.location.origin}${window.location.pathname.startsWith("/app") ? "/app" : ""}/login?confirmado=1` }
          : {}),
      },
    });
    if (signUpError) {
      setBusy(false);
      return setError(errorMessage(signUpError));
    }
    if (!data.session) {
      setBusy(false);
      return setSentTo(form.email.trim());
    }
    // Sessão imediata (sem confirmação de email): o código é aceite já.
    const { error: inviteError } = await supabase.rpc("accept_invite", { p_code: form.code });
    await supabase.auth.updateUser({ data: { pending_invite: null } });
    setBusy(false);
    if (inviteError) return setError(errorMessage(inviteError));
    await refreshProfile();
    router.replace("/");
  }

  if (sentTo) {
    return (
      <Screen>
        <Title>Confirme o seu email</Title>
        <Banner kind="success">
          Enviámos um email para {sentTo}. Abra-o e carregue em confirmar. Depois entre com o seu email e palavra-passe:
          a ligação à criança é feita automaticamente.
        </Banner>
        <Button title="Ir para o login" onPress={() => router.replace("/login")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Criar conta</Title>
      <Muted>
        {params.codigo
          ? "Bem-vindo(a)! O seu código de convite já está preenchido. Complete os seus dados para criar a conta."
          : "Use o código de convite que recebeu da empresa de transporte (por WhatsApp ou SMS)."}
      </Muted>
      <Field label="Código de convite" value={form.code} onChangeText={(v) => set("code")(v.toUpperCase())} autoCapitalize="characters" />
      <Field label="Nome completo" value={form.name} onChangeText={set("name")} autoComplete="name" />
      <Field label="Telefone" value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" autoComplete="tel" />
      <Field label="Email" value={form.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Palavra-passe" value={form.password} onChangeText={set("password")} secureTextEntry autoComplete="new-password" />
      {error && <Banner>{error}</Banner>}
      <Button title="Criar conta" variant="brand" onPress={submit} loading={busy}
        disabled={!form.code || !form.name || !form.email || !form.password} />
    </Screen>
  );
}
