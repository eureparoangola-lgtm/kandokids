import { router } from "expo-router";
import { useState } from "react";
import { Banner, Button, Field, Muted, Screen, Title } from "@/components/ui";
import { errorMessage, supabase } from "@/lib/supabase";

/** Registo do encarregado com o código de convite enviado pela empresa de transporte. */
export default function Register() {
  const [form, setForm] = useState({ name: "", phone: "+244 ", email: "", password: "", code: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setError(null);
    if (form.password.length < 8) return setError("A palavra-passe deve ter pelo menos 8 caracteres.");
    setBusy(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.name.trim(), phone: form.phone.replace(/\s/g, "") } },
    });
    if (signUpError) {
      setBusy(false);
      return setError(errorMessage(signUpError));
    }
    if (!data.session) {
      setBusy(false);
      return setError("Conta criada. Confirme o seu email e depois entre com o código de convite.");
    }
    const { error: inviteError } = await supabase.rpc("accept_guardian_invite", { p_code: form.code });
    setBusy(false);
    if (inviteError) return setError(errorMessage(inviteError));
    router.replace("/");
  }

  return (
    <Screen>
      <Title>Criar conta</Title>
      <Muted>Use o código de convite que recebeu da empresa de transporte do seu filho.</Muted>
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
