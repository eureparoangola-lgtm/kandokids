import { Redirect, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Banner, Button, Field, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors, space } from "@/lib/theme";

export default function Login() {
  const { session, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/" />;

  async function submit() {
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.ink }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: 96, paddingBottom: space.xxl, alignItems: "center", gap: space.sm }}>
        <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 34 }}>🚌</Text>
        </View>
        <Text accessibilityRole="header" style={{ color: "#fff", fontSize: 30, fontWeight: "800" }}>Kandokids</Text>
        <Text style={{ color: "#CBD5E1", fontSize: 15 }}>O seu filho, sempre na viatura certa.</Text>
      </View>
      <View style={{ flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
        <Screen>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
          <Field label="Palavra-passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={submit} />
          {error && <Banner>{error}</Banner>}
          <Button title="Entrar" onPress={submit} loading={busy} disabled={!email || !password} />
          <Button title="Tenho um código de convite" variant="ghost" onPress={() => router.push("/registo")} />
        </Screen>
      </View>
    </KeyboardAvoidingView>
  );
}
