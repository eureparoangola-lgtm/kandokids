import { BOARDING_STATUS_LABELS, DIRECTION_LABELS, TRIP_STATUS_LABELS } from "@kandokids/shared";
import * as Haptics from "expo-haptics";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { Badge, Banner, Button, Card, Field, Loading, Muted, Screen, SectionLabel, Sheet } from "@/components/ui";
import { hhmm, STATUS_STYLE } from "@/lib/format";
import { errorMessage, supabase } from "@/lib/supabase";
import { colors, radius, space } from "@/lib/theme";
import type { Manifest, ManifestStudent } from "@/lib/types";
import { useRealtime, useRpc } from "@/lib/use-rpc";
import { useTripTracker } from "@/lib/use-trip-tracker";

type Panel = null | { kind: "dropoff"; student: ManifestStudent } | { kind: "end" } | { kind: "incident" } | { kind: "sos" };

const tap = () => { if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip, error: loadError, loading, reload } = useRpc<Manifest>("get_trip_manifest", { p_trip_id: id }, { pollSeconds: 20 });
  useRealtime("trip_students", `trip_id=eq.${id}`, reload);

  const inProgress = trip?.status === "in_progress";
  const tracker = useTripTracker(trip?.trip_id, trip?.vehicle.id, inProgress);

  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function run(key: string, fn: string, args: Record<string, unknown>, success?: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    const { data, error: err } = await supabase.rpc(fn, args);
    setBusy(null);
    if (err) {
      setError(errorMessage(err));
      return { ok: false, data: null };
    }
    tap();
    if (success) setNotice(success);
    await reload();
    return { ok: true, data };
  }

  if (loading && !trip) return <Loading />;
  if (!trip) return <Screen><Banner>{loadError ?? "Viagem não encontrada."}</Banner></Screen>;

  const toSchool = trip.direction === "to_school";
  const waiting = trip.students.filter((s) => s.status === "expected");
  const onBoard = trip.students.filter((s) => s.status === "on_board");
  const done = trip.students.filter((s) => !["expected", "on_board"].includes(s.status));

  return (
    <Screen>
      <Stack.Screen options={{ title: trip.vehicle.nickname ?? trip.vehicle.plate }} />

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontWeight: "700", color: colors.muted }}>{toSchool ? "🌅 " : "🏠 "}{DIRECTION_LABELS[trip.direction]}</Text>
          <Badge label={TRIP_STATUS_LABELS[trip.status]} bg={inProgress ? colors.greenSoft : "#F1F5F9"} fg={inProgress ? colors.green : colors.muted} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>{trip.route_name}</Text>
        <Muted>{trip.vehicle.plate}</Muted>
        {inProgress && (
          <Text testID="gps-state" style={{ color: tracker.state === "on" ? colors.green : tracker.state === "denied" ? colors.red : colors.muted, fontWeight: "600" }}>
            {tracker.state === "on" ? "● GPS ativo — os pais veem a viatura no mapa"
              : tracker.state === "denied" ? "GPS sem permissão. Ative a localização nas definições."
              : tracker.state === "error" ? "Erro no GPS." : "A ligar GPS…"}
          </Text>
        )}
      </Card>

      {error && <Banner>{error}</Banner>}
      {notice && <Banner kind="success">{notice}</Banner>}

      {trip.status === "scheduled" && (
        <Button title="Iniciar viagem" icon="▶️" variant="brand" loading={busy === "start"}
          onPress={() => run("start", "start_trip", { p_trip_id: trip.trip_id }, "Viagem iniciada. Os pais foram avisados.")} />
      )}

      {inProgress && (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {trip.features.qr_checkin && (
            <Button style={{ flex: 1 }} title="Ler cartão" icon="📷" onPress={() => router.push(`/assistente/scan/${trip.trip_id}`)} />
          )}
          {trip.features.incident_broadcast && (
            <Button style={{ flex: 1 }} title="Avisar pais" icon="📢" variant="secondary" onPress={() => setPanel({ kind: "incident" })} />
          )}
          {trip.features.sos_button && (
            <Button title="SOS" variant="danger" onPress={() => setPanel({ kind: "sos" })} />
          )}
        </View>
      )}

      {waiting.length > 0 && <SectionLabel>{toSchool ? "Por recolher" : "À espera (na escola)"} · {waiting.length}</SectionLabel>}
      {waiting.map((s) => (
        <StudentRow key={s.trip_student_id} s={s} expanded={expanded === s.student_id} onToggle={() => setExpanded(expanded === s.student_id ? null : s.student_id)}>
          {inProgress && (
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button style={{ flex: 2 }} title="Entrou na viatura" icon="✓" loading={busy === `pick-${s.trip_student_id}`}
                onPress={() => run(`pick-${s.trip_student_id}`, "record_pickup", { p_trip_student_id: s.trip_student_id, p_method: "manual", ...tracker.coords() }, `${s.full_name} a bordo.`)} />
              <Button style={{ flex: 1 }} title="Não apareceu" variant="secondary" loading={busy === `ns-${s.trip_student_id}`}
                onPress={() => run(`ns-${s.trip_student_id}`, "mark_no_show", { p_trip_student_id: s.trip_student_id })} />
            </View>
          )}
        </StudentRow>
      ))}

      {onBoard.length > 0 && <SectionLabel>A bordo · {onBoard.length}</SectionLabel>}
      {onBoard.map((s) => (
        <StudentRow key={s.trip_student_id} s={s} expanded={expanded === s.student_id} onToggle={() => setExpanded(expanded === s.student_id ? null : s.student_id)}>
          <Button title={toSchool ? "Entregue na escola" : "Entregar em casa"} icon="🏁" variant="brand"
            onPress={() => setPanel({ kind: "dropoff", student: s })} />
        </StudentRow>
      ))}

      {done.length > 0 && <SectionLabel>Concluídos · {done.length}</SectionLabel>}
      {done.map((s) => (
        <StudentRow key={s.trip_student_id} s={s} expanded={expanded === s.student_id} onToggle={() => setExpanded(expanded === s.student_id ? null : s.student_id)} />
      ))}

      {inProgress && (
        <Button title="Terminar viagem" icon="⏹" variant="secondary" style={{ marginTop: space.lg }} onPress={() => setPanel({ kind: "end" })} />
      )}
      {trip.status === "completed" && (
        <Banner kind="success">Viagem concluída às {hhmm(trip.ended_at)}.</Banner>
      )}

      {panel?.kind === "dropoff" && (
        <DropoffSheet trip={trip} student={panel.student} busy={busy === "drop"} onClose={() => setPanel(null)}
          onSubmit={async (args) => {
            const r = await run("drop", "record_dropoff", { p_trip_student_id: panel.student.trip_student_id, ...args, ...tracker.coords() });
            // PIN errado: a função devolve uma linha vazia (o contador de tentativas fica gravado).
            if (r.ok && (r.data == null || (r.data as { id?: string }).id == null)) {
              setError("PIN incorreto. Confirme com o adulto e tente novamente.");
              return false;
            }
            if (r.ok) {
              setNotice(`${panel.student.full_name} entregue.`);
              setPanel(null);
            }
            return r.ok;
          }} />
      )}

      {panel?.kind === "end" && (
        <EndTripSheet trip={trip} onBoard={onBoard} busy={busy === "end"} onClose={() => setPanel(null)}
          onConfirm={async (confirmEmpty) => {
            const r = await run("end", "end_trip", { p_trip_id: trip.trip_id, p_confirm_empty: confirmEmpty }, "Viagem terminada. Bom trabalho!");
            if (r.ok) setPanel(null);
          }} />
      )}

      {panel?.kind === "incident" && (
        <IncidentSheet busy={busy === "incident"} onClose={() => setPanel(null)}
          onSend={async (type, message) => {
            const r = await run("incident", "report_incident", { p_trip_id: trip.trip_id, p_type: type, p_message: message || null, ...tracker.coords() }, "Aviso enviado aos pais e à empresa.");
            if (r.ok) setPanel(null);
          }} />
      )}

      {panel?.kind === "sos" && (
        <Sheet visible title="🚨 Emergência" onClose={() => setPanel(null)}>
          <Muted>A empresa e todos os pais desta viatura recebem um alerta com a sua localização.</Muted>
          <Button title="Enviar alerta SOS" variant="danger" loading={busy === "sos"}
            onPress={async () => {
              const r = await run("sos", "report_incident", { p_trip_id: trip.trip_id, p_type: "sos", p_message: "Emergência na viatura", ...tracker.coords() }, "Alerta SOS enviado. Ligue também para a empresa.");
              if (r.ok) setPanel(null);
            }} />
          <Button title="Cancelar" variant="ghost" onPress={() => setPanel(null)} />
        </Sheet>
      )}
    </Screen>
  );
}

function StudentRow({ s, expanded, onToggle, children }: { s: ManifestStudent; expanded: boolean; onToggle: () => void; children?: React.ReactNode }) {
  const st = STATUS_STYLE[s.status];
  return (
    <Card testID={`student-${s.full_name}`}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Detalhes de ${s.full_name}`} onPress={onToggle}
        style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontWeight: "800", color: colors.ink }}>{s.full_name[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{s.full_name}</Text>
          <Muted>{s.home_address ?? s.grade ?? ""}</Muted>
        </View>
        <Badge label={BOARDING_STATUS_LABELS[s.status] + (s.picked_up_at && s.status === "on_board" ? ` ${hhmm(s.picked_up_at)}` : s.delivered_at ? ` ${hhmm(s.delivered_at)}` : "")} bg={st.bg} fg={st.fg} />
      </Pressable>
      {s.medical_notes && <Text style={{ color: colors.red, fontWeight: "600" }}>⚕️ {s.medical_notes}</Text>}
      {expanded && (
        <View style={{ gap: space.xs, paddingVertical: space.xs }}>
          {s.guardians.map((g) => (
            <Pressable key={g.full_name} accessibilityRole="button" disabled={!g.phone} onPress={() => g.phone && Linking.openURL(`tel:${g.phone}`)}>
              <Text style={{ color: colors.inkSoft }}>📞 {g.full_name}{g.relationship ? ` (${g.relationship})` : ""} · {g.phone ?? "sem telefone"}</Text>
            </Pressable>
          ))}
          {s.home_lat != null && s.home_lng != null && (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${s.home_lat},${s.home_lng}`)}>
              <Text style={{ color: colors.inkSoft }}>🧭 Navegar até casa</Text>
            </Pressable>
          )}
        </View>
      )}
      {children}
    </Card>
  );
}

function DropoffSheet({ trip, student, busy, onClose, onSubmit }: {
  trip: Manifest; student: ManifestStudent; busy: boolean; onClose: () => void;
  onSubmit: (args: Record<string, unknown>) => Promise<boolean>;
}) {
  const toSchool = trip.direction === "to_school";
  const pinRequired = !toSchool && trip.features.pickup_pin && student.has_pin;
  const adults = trip.features.authorized_adults ? student.authorized_adults : [];
  const [mode, setMode] = useState<"pin" | "adult" | "guardian">(pinRequired ? "pin" : "guardian");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [adultId, setAdultId] = useState<string | null>(null);

  if (toSchool) {
    return (
      <Sheet visible title={`Entregar ${student.full_name.split(" ")[0]} na escola`} onClose={onClose}>
        <Muted>Confirme que a criança entrou na escola. Os pais recebem a hora de chegada.</Muted>
        <Button title="Confirmar entrega na escola" variant="brand" loading={busy} onPress={() => onSubmit({ p_method: "school_staff" })} />
      </Sheet>
    );
  }

  const tabs: { key: typeof mode; label: string }[] = [
    ...(pinRequired ? [{ key: "pin" as const, label: "PIN" }] : [{ key: "guardian" as const, label: "Encarregado" }]),
    ...(adults.length ? [{ key: "adult" as const, label: "Adulto autorizado" }] : []),
  ];

  return (
    <Sheet visible title={`Entregar ${student.full_name.split(" ")[0]} em casa`} onClose={onClose}>
      {tabs.length > 1 && (
        <View style={{ flexDirection: "row", backgroundColor: colors.bg, borderRadius: radius.md, padding: 3 }}>
          {tabs.map((t) => (
            <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: mode === t.key }} onPress={() => setMode(t.key)}
              style={{ flex: 1, padding: 10, borderRadius: radius.sm, backgroundColor: mode === t.key ? "#fff" : "transparent", alignItems: "center" }}>
              <Text style={{ fontWeight: "600", color: mode === t.key ? colors.ink : colors.muted }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {mode === "pin" && (
        <>
          <Muted>Peça ao adulto o PIN de 4 dígitos definido pelo encarregado.</Muted>
          <Field label="PIN" value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" maxLength={4} secureTextEntry />
          <Field label="Nome de quem recebe (opcional)" value={name} onChangeText={setName} />
          <Button title="Confirmar com PIN" variant="brand" loading={busy} disabled={pin.length !== 4}
            onPress={async () => { if (!(await onSubmit({ p_method: "pin", p_pin: pin, p_handed_to_name: name || null }))) setPin(""); }} />
        </>
      )}

      {mode === "adult" && (
        <>
          <Muted>Confirme a identidade (BI) antes de entregar.</Muted>
          {adults.map((a) => (
            <Pressable key={a.id} accessibilityRole="radio" accessibilityState={{ checked: adultId === a.id }} onPress={() => setAdultId(a.id)}
              style={{ padding: space.md, borderRadius: radius.md, borderWidth: 2, borderColor: adultId === a.id ? colors.ink : colors.border }}>
              <Text style={{ fontWeight: "700", color: colors.ink }}>{a.full_name}</Text>
              <Muted>{[a.relationship, a.id_document && `BI ${a.id_document}`].filter(Boolean).join(" · ")}</Muted>
            </Pressable>
          ))}
          <Button title="Confirmar entrega" variant="brand" loading={busy} disabled={!adultId}
            onPress={() => onSubmit({ p_method: "authorized_adult", p_authorized_adult_id: adultId })} />
        </>
      )}

      {mode === "guardian" && (
        <>
          <Field label="Entregue a (nome)" value={name} onChangeText={setName} placeholder="ex.: Mãe" />
          <Button title="Confirmar entrega" variant="brand" loading={busy}
            onPress={() => onSubmit({ p_method: "guardian", p_handed_to_name: name || null })} />
        </>
      )}
    </Sheet>
  );
}

function EndTripSheet({ trip, onBoard, busy, onClose, onConfirm }: {
  trip: Manifest; onBoard: ManifestStudent[]; busy: boolean; onClose: () => void; onConfirm: (confirmEmpty: boolean) => void;
}) {
  const [checked, setChecked] = useState(false);
  const needsCheck = trip.features.empty_vehicle_check;
  return (
    <Sheet visible title="Terminar viagem" onClose={onClose}>
      {onBoard.length > 0 ? (
        <Banner>Ainda há {onBoard.length} criança(s) a bordo: {onBoard.map((s) => s.full_name).join(", ")}. Registe a entrega primeiro.</Banner>
      ) : needsCheck ? (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => setChecked(!checked)}
          style={{ flexDirection: "row", gap: space.md, alignItems: "center", padding: space.md, borderRadius: radius.md, backgroundColor: colors.brandSoft }}>
          <View style={{ width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: colors.ink, backgroundColor: checked ? colors.ink : "#fff", alignItems: "center", justifyContent: "center" }}>
            {checked && <Text style={{ color: "#fff", fontWeight: "800" }}>✓</Text>}
          </View>
          <Text style={{ flex: 1, fontSize: 15, color: colors.ink, fontWeight: "600" }}>Verifiquei todos os bancos, incluindo os de trás. A viatura está vazia.</Text>
        </Pressable>
      ) : (
        <Muted>Confirma que a viagem terminou?</Muted>
      )}
      <Button title="Terminar viagem" variant="primary" loading={busy} disabled={onBoard.length > 0 || (needsCheck && !checked)}
        onPress={() => onConfirm(checked)} />
    </Sheet>
  );
}

const INCIDENTS = [
  { type: "delay", label: "⏱ Atraso" },
  { type: "breakdown", label: "🔧 Avaria" },
  { type: "route_change", label: "↪️ Mudança de rota" },
  { type: "other", label: "💬 Outro" },
] as const;

function IncidentSheet({ busy, onClose, onSend }: { busy: boolean; onClose: () => void; onSend: (type: string, message: string) => void }) {
  const [type, setType] = useState<string>("delay");
  const [message, setMessage] = useState("");
  return (
    <Sheet visible title="Avisar todos os pais" onClose={onClose}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {INCIDENTS.map((i) => (
          <Pressable key={i.type} accessibilityRole="radio" accessibilityState={{ checked: type === i.type }} onPress={() => setType(i.type)}
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 2, borderColor: type === i.type ? colors.ink : colors.border }}>
            <Text style={{ color: colors.ink, fontWeight: "600" }}>{i.label}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Mensagem" value={message} onChangeText={setMessage} placeholder="ex.: Trânsito intenso na Via Expressa, cerca de 20 min de atraso" multiline />
      <Button title="Enviar aviso" variant="brand" loading={busy} onPress={() => onSend(type, message)} />
    </Sheet>
  );
}
