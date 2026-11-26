import { Redirect } from "expo-router";
import { View } from "react-native";
import { Loading, Muted, Screen, Title, Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** Encaminha cada utilizador para a sua área conforme o papel. */
export default function Index() {
  const { loading, session, profile, signOut } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/login" />;
  if (!profile) return <Loading />;

  if (profile.role === "guardian") return <Redirect href="/encarregado" />;
  if (profile.role === "assistant" || profile.role === "driver") return <Redirect href="/assistente" />;

  return (
    <Screen>
      <View style={{ gap: 12, paddingTop: 48 }}>
        <Title>Olá, {profile.full_name.split(" ")[0]}</Title>
        <Muted>A gestão da empresa é feita no painel web Kandokids. Esta app é para encarregados e assistentes das viaturas.</Muted>
        <Button title="Terminar sessão" variant="secondary" onPress={signOut} />
      </View>
    </Screen>
  );
}
