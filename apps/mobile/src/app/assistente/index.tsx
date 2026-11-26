import { DIRECTION_LABELS, TRIP_STATUS_LABELS } from "@kandokids/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Text, View } from "react-native";
import { Badge, Banner, Button, Card, Loading, Muted, Screen, SectionLabel, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors, space } from "@/lib/theme";
import type { CrewTrip } from "@/lib/types";
import { useRpc } from "@/lib/use-rpc";

const STATUS_COLORS = {
  scheduled: { bg: "#F1F5F9", fg: colors.muted },
  in_progress: { bg: colors.greenSoft, fg: colors.green },
  completed: { bg: "#E0E7FF", fg: colors.inkSoft },
  cancelled: { bg: colors.redSoft, fg: colors.red },
} as const;

export default function CrewHome() {
  const { profile, signOut } = useAuth();
  const { data, error, loading } = useRpc<CrewTrip[]>("get_crew_trips", undefined, { pollSeconds: 30 });
  const [suspended, setSuspended] = useState(false);
  useFocusEffect(useCallback(() => {
    if (!profile?.company_id) return;
    supabase.from("companies").select("license_status").eq("id", profile.company_id).single()
      .then(({ data: c }) => setSuspended(c?.license_status === "suspended"));
  }, [profile?.company_id]));

  return (
    <Screen>
      <Title>Bom dia, {profile?.full_name.split(" ")[0]}</Title>
      <Muted>As suas viagens de hoje.</Muted>
      {suspended && <Banner>A conta da empresa está suspensa pela Kandokids. Não é possível iniciar viagens. Fale com o administrador da empresa.</Banner>}
      {error && <Banner>{error}</Banner>}
      {loading && !data && <Loading />}
      {data?.length === 0 && <Card><Muted>Não tem viagens atribuídas hoje.</Muted></Card>}

      {data?.map((t) => (
        <Card key={t.trip_id} testID={`trip-${t.trip_id}`} onPress={() => router.push(`/assistente/viagem/${t.trip_id}`)}
          style={t.status === "in_progress" ? { borderColor: colors.green, borderWidth: 2 } : undefined}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted }}>
              {t.direction === "to_school" ? "🌅 " : "🏠 "}{DIRECTION_LABELS[t.direction].toUpperCase()}
              {t.scheduled_time ? ` · ${t.scheduled_time.slice(0, 5)}` : ""}
            </Text>
            <Badge label={TRIP_STATUS_LABELS[t.status]} {...STATUS_COLORS[t.status]} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink }}>{t.route_name ?? DIRECTION_LABELS[t.direction]}</Text>
          <Muted>{t.vehicle.nickname ? `${t.vehicle.nickname} · ` : ""}{t.vehicle.plate}</Muted>
          <View style={{ flexDirection: "row", gap: space.lg, marginTop: space.xs }}>
            <Stat n={t.total - t.absent} label="crianças" />
            <Stat n={t.on_board} label="a bordo" />
            <Stat n={t.delivered} label="entregues" />
            {t.absent > 0 && <Stat n={t.absent} label="ausentes" />}
          </View>
        </Card>
      ))}

      <SectionLabel>Outros</SectionLabel>
      <Button title="Mensagens dos pais" icon="💬" variant="secondary" onPress={() => router.push("/assistente/mensagens")} />
      <Button title="Terminar sessão" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View>
      <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>{n}</Text>
      <Muted>{label}</Muted>
    </View>
  );
}
