import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { Banner, Button, Field, Muted, Screen } from "@/components/ui";
import { errorMessage, supabase } from "@/lib/supabase";
import { colors, radius, space } from "@/lib/theme";

/** Lê o cartão QR da mochila e regista a entrada na viatura. Recusa crianças de outra viatura. */
export default function Scan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [manual, setManual] = useState("");
  const busy = useRef(false);
  const lastCode = useRef<{ code: string; at: number } | null>(null);

  async function checkin(token: string) {
    const now = Date.now();
    if (busy.current || (lastCode.current?.code === token && now - lastCode.current.at < 4000)) return;
    busy.current = true;
    lastCode.current = { code: token, at: now };
    const { data, error } = await supabase.rpc("checkin_by_token", { p_trip_id: id, p_token: token.trim() });
    busy.current = false;
    if (error) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult({ ok: false, text: errorMessage(error) });
      return;
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { data: s } = await supabase.from("students").select("full_name").eq("id", (data as { student_id: string }).student_id).single();
    setResult({ ok: true, text: `${s?.full_name ?? "Criança"} a bordo ✓` });
    setManual("");
  }

  return (
    <Screen>
      {permission?.granted ? (
        <View style={{ height: 320, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#000" }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => checkin(data)} />
        </View>
      ) : (
        <View style={{ gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.ink }}>
          <Text style={{ color: "#fff", fontSize: 16 }}>Para ler os cartões QR, a app precisa da câmara.</Text>
          <Button title="Permitir câmara" variant="brand" onPress={requestPermission} />
        </View>
      )}

      {result && <Banner kind={result.ok ? "success" : "error"}>{result.text}</Banner>}
      <Muted>Aponte a câmara para o cartão QR na mochila. Cartão estragado? Escreva o código:</Muted>
      <Field label="Código do cartão" value={manual} onChangeText={setManual} autoCapitalize="none" onSubmitEditing={() => checkin(manual)} />
      <Button title="Registar código" variant="secondary" disabled={!manual.trim()} onPress={() => { lastCode.current = null; checkin(manual); }} />
      <Button title="Voltar à lista" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
