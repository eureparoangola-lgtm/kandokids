import { ADDON_STATUS_LABELS, formatKz, whatsappLink, type AddonStatus } from "@kandokids/shared";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Badge, Banner, Button, Card, Loading, Muted, Screen, SectionLabel, Title } from "@/components/ui";
import { errorMessage, supabase } from "@/lib/supabase";
import { colors, space } from "@/lib/theme";

interface Extra {
  feature_key: string; name_pt: string; description_pt: string; price_kz: number | null;
  active: boolean; status: AddonStatus | null; ends_on: string | null;
}

/** Extras vendidos pela Kandokids. Um pagamento vale para todos os filhos. */
export default function Extras() {
  const [extras, setExtras] = useState<Extra[] | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data, error: e1 }, { data: s }] = await Promise.all([
      supabase.rpc("get_my_extras"),
      supabase.from("platform_settings").select("key, value"),
    ]);
    if (e1) return setError(errorMessage(e1));
    setExtras(data as Extra[]);
    setSettings(Object.fromEntries((s ?? []).map((r: { key: string; value: string }) => [r.key, r.value])));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function request(e: Extra) {
    setBusy(e.feature_key);
    setError(null);
    setMessage(null);
    const { error: err } = await supabase.rpc("request_addon", { p_feature_key: e.feature_key, p_payment_method: "multicaixa_express" });
    setBusy(null);
    if (err) return setError(errorMessage(err));
    setMessage(`Pedido enviado: "${e.name_pt}" (${formatKz(e.price_kz)}/mês). Veja abaixo como pagar.`);
    load();
  }

  const hasPending = extras?.some((e) => e.status === "pending_payment" && !e.active);
  const whatsapp = settings.support_whatsapp;

  return (
    <Screen>
      <Title>Extras</Title>
      <Muted>Serviços adicionais da Kandokids, pagos mensalmente. Valem para todos os seus filhos.</Muted>
      {message && <Banner kind="success">{message}</Banner>}
      {error && <Banner>{error}</Banner>}
      {!extras && !error && <Loading />}
      {extras?.length === 0 && <Card><Muted>Não há extras disponíveis de momento.</Muted></Card>}

      {extras?.map((e) => (
        <Card key={e.feature_key} testID={`extra-${e.feature_key}`}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink }}>{e.name_pt}</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{formatKz(e.price_kz)}<Text style={{ fontWeight: "400", color: colors.muted }}>/mês</Text></Text>
          </View>
          <Muted>{e.description_pt}</Muted>
          {e.active ? (
            <Badge label={`Ativo${e.ends_on ? ` até ${new Date(e.ends_on + "T00:00:00").toLocaleDateString("pt-AO")}` : ""}`} bg={colors.greenSoft} fg={colors.green} />
          ) : e.status === "pending_payment" ? (
            <Badge label={ADDON_STATUS_LABELS.pending_payment} bg={colors.amberSoft} fg="#92400E" />
          ) : (
            <Button title="Quero este extra" variant="brand" loading={busy === e.feature_key} onPress={() => request(e)} />
          )}
        </Card>
      ))}

      {(hasPending || message) && settings.payment_instructions ? (
        <>
          <SectionLabel>Como pagar</SectionLabel>
          <Card testID="payment-instructions">
            <Text style={{ color: colors.text, fontSize: 15 }}>{settings.payment_instructions}</Text>
            {whatsapp ? (
              <Button title="Enviar comprovativo por WhatsApp" icon="💬" variant="secondary"
                onPress={() => Linking.openURL(whatsappLink(whatsapp, "Olá Kandokids! Envio o comprovativo de pagamento do extra."))} />
            ) : null}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
