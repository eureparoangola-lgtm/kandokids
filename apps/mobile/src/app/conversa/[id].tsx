import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { hhmm } from "@/lib/format";
import { errorMessage, supabase } from "@/lib/supabase";
import { colors, radius, space } from "@/lib/theme";
import { useRealtime } from "@/lib/use-rpc";

interface Message { id: string; sender_id: string; body: string | null; created_at: string; profiles: { full_name: string; role: string } | null }

const QUICK_GUARDIAN = ["Vou atrasar 2 minutos", "Hoje está doente", "Já está à porta", "Obrigado!"];
const QUICK_CREW = ["Estamos a 5 minutos", "Atraso por causa do trânsito", "Já chegámos", "Recebido, obrigado"];

export default function Conversation() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at, profiles(full_name, role)")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (err) return setError(errorMessage(err));
    setMessages((data as unknown as Message[]) ?? []);
    supabase.rpc("mark_conversation_read", { p_conversation_id: id });
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);
  useRealtime("messages", `conversation_id=eq.${id}`, load);

  async function send(body: string) {
    const trimmed = body.trim();
    if (!trimmed || !profile) return;
    setSending(true);
    setError(null);
    const { error: err } = await supabase.from("messages").insert({ conversation_id: id, sender_id: profile.id, body: trimmed });
    setSending(false);
    if (err) return setError(errorMessage(err));
    setText("");
    load();
  }

  const quick = profile?.role === "guardian" ? QUICK_GUARDIAN : QUICK_CREW;

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: title ? `💬 ${title}` : "Mensagens" }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, maxWidth: 640, width: "100%", alignSelf: "center" }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={{ textAlign: "center", color: colors.muted, marginTop: 40 }}>Ainda não há mensagens. Escreva a primeira!</Text>}
          renderItem={({ item }) => {
            const mine = item.sender_id === profile?.id;
            return (
              <View style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", gap: 2 }}>
                {!mine && <Text style={{ fontSize: 12, color: colors.muted, marginLeft: 4 }}>{item.profiles?.full_name}</Text>}
                <View style={{ backgroundColor: mine ? colors.ink : "#fff", borderRadius: radius.lg, padding: space.md, borderWidth: mine ? 0 : 1, borderColor: colors.border }}>
                  <Text style={{ color: mine ? "#fff" : colors.text, fontSize: 15 }}>{item.body}</Text>
                  <Text style={{ color: mine ? "#CBD5E1" : colors.muted, fontSize: 11, alignSelf: "flex-end", marginTop: 2 }}>{hhmm(item.created_at)}</Text>
                </View>
              </View>
            );
          }}
        />
        <View style={{ padding: space.md, gap: space.sm, borderTopWidth: 1, borderColor: colors.border, backgroundColor: "#fff" }}>
          {error && <Banner>{error}</Banner>}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {quick.map((q) => (
              <Pressable key={q} accessibilityRole="button" onPress={() => send(q)} disabled={sending}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.brand }}>
                <Text style={{ color: colors.ink, fontSize: 13 }}>{q}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <TextInput
              accessibilityLabel="Mensagem"
              value={text}
              onChangeText={setText}
              placeholder="Escreva uma mensagem…"
              placeholderTextColor={colors.muted}
              multiline
              style={{ flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 16 }}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Enviar" onPress={() => send(text)} disabled={sending || !text.trim()}
              style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: text.trim() ? colors.ink : colors.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 20 }}>➤</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
