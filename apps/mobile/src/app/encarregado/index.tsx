import { BOARDING_STATUS_LABELS } from "@kandokids/shared";
import { Stack, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Badge, Banner, Button, Card, Loading, Muted, Screen, SectionLabel, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { currentTrip, statusSentence } from "@/lib/child";
import { STATUS_STYLE } from "@/lib/format";
import type { Child } from "@/lib/types";
import { useRealtime, useRpc } from "@/lib/use-rpc";
import { colors, space } from "@/lib/theme";

export default function GuardianHome() {
  const { profile, signOut } = useAuth();
  const { data, error, loading, reload } = useRpc<Child[]>("get_guardian_dashboard", undefined, { pollSeconds: 20 });
  useRealtime("trip_students", undefined, reload);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityLabel="Notificações" onPress={() => router.push("/encarregado/notificacoes")} style={{ paddingHorizontal: 8 }}>
              <Text style={{ fontSize: 20 }}>🔔</Text>
            </Pressable>
          ),
        }}
      />
      <Title>Olá, {profile?.full_name.split(" ")[0]} 👋</Title>
      <Muted>Acompanhe aqui as viagens dos seus filhos.</Muted>

      {error && <Banner>{error}</Banner>}
      {loading && !data && <Loading />}
      {data && data.length === 0 && (
        <Card><Muted>Ainda não tem crianças associadas. Use o código de convite que a empresa de transporte lhe enviou.</Muted></Card>
      )}

      {data?.map((child) => {
        const trip = currentTrip(child);
        const style = child.absent_today ? STATUS_STYLE.absent : trip ? STATUS_STYLE[trip.status] : STATUS_STYLE.absent;
        return (
          <Card key={child.student_id} testID={`child-${child.first_name}`} onPress={() => router.push(`/encarregado/aluno/${child.student_id}`)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 22, fontWeight: "800", color: colors.ink }}>{child.first_name[0]}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink }}>{child.full_name}</Text>
                <Muted>{[child.grade, child.school_name].filter(Boolean).join(" · ")}</Muted>
              </View>
              <Badge
                label={child.absent_today ? "Não vai hoje" : trip ? BOARDING_STATUS_LABELS[trip.status] : "Sem viagem"}
                bg={style.bg}
                fg={style.fg}
              />
            </View>
            <Text style={{ fontSize: 15, color: colors.text, marginTop: space.xs }}>{statusSentence(child, trip)}</Text>
            {trip?.can_track && <Text style={{ color: colors.green, fontWeight: "600" }}>● Ver no mapa em tempo real</Text>}
          </Card>
        );
      })}

      <SectionLabel>Conta</SectionLabel>
      <Button title="Extras (SMS, alertas…)" icon="⭐" variant="secondary" onPress={() => router.push("/encarregado/extras")} />
      <Button title="Tenho um código de convite" icon="🔑" variant="secondary" onPress={() => router.push("/codigo")} />
      <Button title="Terminar sessão" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
