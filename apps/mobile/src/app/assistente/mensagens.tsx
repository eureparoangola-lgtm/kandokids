import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { Card, Loading, Muted, Screen } from "@/components/ui";
import { hhmm } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import type { CrewTrip } from "@/lib/types";

interface Conv {
  id: string;
  students: { full_name: string } | null;
  vehicles: { plate: string; nickname: string | null } | null;
  messages: { body: string | null; created_at: string; read_at: string | null }[];
}

/** Conversas das viaturas onde o assistente trabalha hoje. */
export default function CrewMessages() {
  const [items, setItems] = useState<Conv[] | null>(null);

  const load = useCallback(async () => {
    const { data: trips } = await supabase.rpc("get_crew_trips");
    const vehicleIds = [...new Set(((trips as CrewTrip[]) ?? []).map((t) => t.vehicle.id))];
    if (vehicleIds.length === 0) return setItems([]);
    const { data } = await supabase
      .from("conversations")
      .select("id, students(full_name), vehicles(plate, nickname), messages(body, created_at, read_at)")
      .in("vehicle_id", vehicleIds)
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(1, { referencedTable: "messages" });
    setItems(((data as unknown as Conv[]) ?? []).sort((a, b) => (b.messages[0]?.created_at ?? "").localeCompare(a.messages[0]?.created_at ?? "")));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen>
      {!items && <Loading />}
      {items?.length === 0 && <Card><Muted>Ainda não há mensagens dos pais.</Muted></Card>}
      {items?.map((c) => {
        const last = c.messages[0];
        return (
          <Card key={c.id} onPress={() => router.push({ pathname: "/conversa/[id]", params: { id: c.id, title: c.students?.full_name ?? "" } })}
            style={last && !last.read_at ? { borderColor: colors.brand, borderWidth: 2 } : undefined}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "700", color: colors.ink }}>Família de {c.students?.full_name}</Text>
              {last && <Muted>{hhmm(last.created_at)}</Muted>}
            </View>
            <Muted>{last?.body ?? "Sem mensagens"}</Muted>
          </Card>
        );
      })}
    </Screen>
  );
}
