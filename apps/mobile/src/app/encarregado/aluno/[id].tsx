import { BOARDING_STATUS_LABELS, DIRECTION_LABELS } from "@kandokids/shared";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Switch, Text, View } from "react-native";
import { Badge, Banner, Button, Card, Loading, Muted, Screen, SectionLabel } from "@/components/ui";
import { VehicleMap } from "@/components/vehicle-map";
import { useAuth } from "@/lib/auth";
import { currentTrip, statusSentence } from "@/lib/child";
import { hhmm, luandaDate, minutesAgo, STATUS_STYLE } from "@/lib/format";
import { errorMessage, supabase } from "@/lib/supabase";
import { colors, space } from "@/lib/theme";
import type { Child, ChildTrip, LivePosition } from "@/lib/types";
import { useRealtime, useRpc } from "@/lib/use-rpc";

export default function ChildDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const dash = useRpc<Child[]>("get_guardian_dashboard", undefined, { pollSeconds: 20 });
  const child = dash.data?.find((c) => c.student_id === id) ?? null;
  const trip = child ? currentTrip(child) : null;
  const tracking = Boolean(trip?.can_track);

  const live = useRpc<LivePosition | null>("get_trip_live", { p_trip_id: trip?.trip_id }, { pollSeconds: 10, enabled: tracking });
  useRealtime("vehicle_positions", trip ? `trip_id=eq.${trip.trip_id}` : undefined, live.reload, tracking);
  useRealtime("trip_students", `student_id=eq.${id}`, dash.reload);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (dash.loading && !dash.data) return <Loading />;
  if (!child) return <Screen><Banner>{dash.error ?? "Criança não encontrada."}</Banner></Screen>;

  async function setGoing(day: 0 | 1, going: boolean) {
    setBusy(`day${day}`);
    setError(null);
    const date = luandaDate(day);
    const { error: err } = going
      ? await supabase.from("absences").delete().eq("student_id", id).eq("service_date", date).is("direction", null)
      : await supabase.from("absences").insert({ student_id: id, service_date: date, created_by: profile!.id });
    if (err) setError(errorMessage(err));
    await dash.reload();
    setBusy(null);
  }

  async function openChat() {
    setBusy("chat");
    setError(null);
    const { data, error: err } = await supabase.rpc("open_vehicle_conversation", { p_student_id: id });
    setBusy(null);
    if (err) return setError(errorMessage(err));
    router.push({ pathname: "/conversa/[id]", params: { id: data as string, title: trip?.vehicle.nickname ?? trip?.vehicle.plate ?? "Viatura" } });
  }

  const pos = live.data?.position;
  const style = child.absent_today ? STATUS_STYLE.absent : trip ? STATUS_STYLE[trip.status] : STATUS_STYLE.absent;

  return (
    <Screen>
      <Stack.Screen options={{ title: child.first_name }} />

      <Card>
        <Badge label={child.absent_today ? "Não vai hoje" : trip ? BOARDING_STATUS_LABELS[trip.status] : "Sem viagem"} bg={style.bg} fg={style.fg} />
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink }}>{statusSentence(child, trip)}</Text>
        {trip && (
          <Muted>
            Viatura {trip.vehicle.nickname ? `${trip.vehicle.nickname} · ` : ""}{trip.vehicle.plate}
            {trip.vehicle.color ? ` · ${trip.vehicle.color}` : ""}
          </Muted>
        )}
      </Card>

      {tracking && (
        <View style={{ gap: space.xs }}>
          <VehicleMap
            vehicle={pos ? { lat: pos.lat, lng: pos.lng } : null}
            vehicleLabel={trip!.vehicle.nickname ?? trip!.vehicle.plate}
            home={child.home_lat != null && child.home_lng != null ? { lat: child.home_lat, lng: child.home_lng } : null}
            school={live.data?.school?.lat != null ? { name: live.data.school.name, lat: live.data.school.lat!, lng: live.data.school.lng! } : null}
          />
          <Muted>{pos ? `Posição atualizada ${minutesAgo(pos.recorded_at)}${pos.speed_kmh != null ? ` · ${Math.round(pos.speed_kmh)} km/h` : ""}` : "À espera da primeira posição da viatura…"}</Muted>
        </View>
      )}

      {error && <Banner>{error}</Banner>}

      {child.features.absence_toggle && (
        <>
          <SectionLabel>Vai à escola?</SectionLabel>
          <Card>
            <ToggleRow label="Hoje" value={!child.absent_today} busy={busy === "day0"} onChange={(v) => setGoing(0, v)} />
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <ToggleRow label="Amanhã" value={!child.absent_tomorrow} busy={busy === "day1"} onChange={(v) => setGoing(1, v)} />
            <Muted>Se desligar, a viatura não passa em casa e o assistente é avisado.</Muted>
          </Card>
        </>
      )}

      <SectionLabel>Viagens de hoje</SectionLabel>
      {child.trips.length === 0 && <Card><Muted>Sem viagens hoje.</Muted></Card>}
      {child.trips.map((t) => <TripTimeline key={t.trip_id} trip={t} firstName={child.first_name} />)}

      <SectionLabel>Contactar</SectionLabel>
      {child.features.vehicle_chat && trip && (
        <Button title="Enviar mensagem à viatura" icon="💬" onPress={openChat} loading={busy === "chat"} />
      )}
      {trip?.assistant?.phone && (
        <Button title={`Ligar a ${trip.assistant.full_name.split(" ")[0]} (assistente)`} icon="📞" variant="secondary"
          onPress={() => Linking.openURL(`tel:${trip.assistant!.phone}`)} />
      )}
      {child.company_phone && (
        <Button title={`Ligar para ${child.company_name}`} icon="🏢" variant="secondary" onPress={() => Linking.openURL(`tel:${child.company_phone}`)} />
      )}

      {child.features.pickup_pin && (
        <>
          <SectionLabel>Segurança</SectionLabel>
          <Card onPress={() => router.push({ pathname: "/encarregado/pin/[id]", params: { id: child.student_id, name: child.first_name } })}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>🔐 PIN de entrega</Text>
            <Muted>
              {child.has_pin
                ? `Definido. ${child.first_name} só é entregue em casa a quem disser o PIN. Toque para alterar.`
                : `Ainda não definiu um PIN. Toque para proteger a entrega de ${child.first_name}.`}
            </Muted>
          </Card>
        </>
      )}
    </Screen>
  );
}

function ToggleRow({ label, value, busy, onChange }: { label: string; value: boolean; busy: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
      <View>
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{label}</Text>
        <Text style={{ color: value ? colors.green : colors.red, fontWeight: "600" }}>{value ? "Vai" : "Não vai"}</Text>
      </View>
      <Switch accessibilityLabel={`Vai à escola ${label.toLowerCase()}`} value={value} disabled={busy} onValueChange={onChange}
        trackColor={{ true: colors.green, false: "#CBD5E1" }} thumbColor="#fff" />
    </View>
  );
}

function TripTimeline({ trip, firstName }: { trip: ChildTrip; firstName: string }) {
  const toSchool = trip.direction === "to_school";
  const steps: { done: boolean; label: string; time?: string }[] = [
    { done: !!trip.started_at, label: "Viatura iniciou a viagem", time: hhmm(trip.started_at) },
    { done: !!trip.picked_up_at, label: toSchool ? `${firstName} foi recolhido(a)` : `${firstName} entrou na viatura`, time: hhmm(trip.picked_up_at) },
    {
      done: !!trip.delivered_at,
      label: toSchool ? "Chegou à escola" : `Entregue em casa${trip.handed_to_name ? ` a ${trip.handed_to_name}` : ""}${trip.handover_method === "pin" ? " (PIN ✓)" : ""}`,
      time: hhmm(trip.delivered_at),
    },
  ];
  const ended = trip.status === "absent" || trip.status === "no_show";
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{toSchool ? "🌅 " : "🏠 "}{DIRECTION_LABELS[trip.direction]}</Text>
        <Muted>{trip.vehicle.plate}</Muted>
      </View>
      {ended ? (
        <Muted>{BOARDING_STATUS_LABELS[trip.status]}</Muted>
      ) : (
        steps.map((s, i) => (
          <View key={i} style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: s.done ? colors.green : "#fff", borderWidth: 2, borderColor: s.done ? colors.green : colors.border }} />
            <Text style={{ flex: 1, color: s.done ? colors.text : colors.muted }}>{s.label}</Text>
            {s.done && <Text style={{ fontWeight: "700", color: colors.ink }}>{s.time}</Text>}
          </View>
        ))
      )}
    </Card>
  );
}
