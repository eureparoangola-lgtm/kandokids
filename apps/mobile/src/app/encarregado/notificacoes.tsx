import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Text, View } from "react-native";
import { Card, Loading, Muted, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { minutesAgo } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { useRealtime } from "@/lib/use-rpc";

interface Notification { id: string; type: string; title: string; body: string; created_at: string; read_at: string | null; data: { conversation_id?: string } }

const ICONS: Record<string, string> = {
  picked_up: "🚌", delivered: "✅", proximity: "📍", vehicle_changed: "🔁", speeding: "⚠️",
  no_show: "❗", message: "💬", student_absent: "🚫", student_absence_cancelled: "↩️", trip_started: "▶️", addon_activated: "⭐", pin_changed: "🔐", pin_failed: "🚨",
};

export default function Notifications() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Notification[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("notifications").select("id, type, title, body, created_at, read_at, data")
      .order("created_at", { ascending: false }).limit(50);
    setItems((data as Notification[]) ?? []);
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtime("notifications", profile ? `recipient_id=eq.${profile.id}` : undefined, load, !!profile);

  return (
    <Screen>
      {!items && <Loading />}
      {items?.length === 0 && <Card><Muted>Ainda não há notificações.</Muted></Card>}
      {items?.map((n) => (
        <Card key={n.id} style={!n.read_at ? { borderColor: colors.brand, borderWidth: 2 } : undefined}
          onPress={n.data?.conversation_id ? () => router.push({ pathname: "/conversa/[id]", params: { id: n.data.conversation_id! } }) : undefined}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Text style={{ fontSize: 22 }}>{ICONS[n.type] ?? (n.type.startsWith("incident_") ? "📢" : "🔔")}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontWeight: "700", color: colors.ink }}>{n.title}</Text>
              <Text style={{ color: colors.text }}>{n.body}</Text>
              <Muted>{minutesAgo(n.created_at)}</Muted>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
