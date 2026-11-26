import { ADDON_STATUS_LABELS, formatKz, type AddonStatus, type FeatureMode } from "@kandokids/shared";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text, View } from "react-native";
import { Badge, Banner, Button, Card, Loading, Muted, Screen, SectionLabel, Title } from "@/components/ui";
import { errorMessage, supabase } from "@/lib/supabase";
import { colors, space } from "@/lib/theme";
import type { Child } from "@/lib/types";

interface MyFeature {
  feature_key: string;
  name_pt: string;
  description_pt: string;
  mode: FeatureMode;
  enabled: boolean;
  addon_price_kz: number | null;
  addon_status: AddonStatus | null;
  addon_ends_on: string | null;
}

interface CompanyExtras { companyId: string; companyName: string; companyPhone: string | null; features: MyFeature[] }

export default function Extras() {
  const [companies, setCompanies] = useState<CompanyExtras[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: children, error: e1 } = await supabase.rpc("get_guardian_dashboard");
    if (e1) return setError(errorMessage(e1));
    const unique = new Map<string, Child>();
    for (const c of children as Child[]) unique.set(c.company_id, c);
    const result: CompanyExtras[] = [];
    for (const c of unique.values()) {
      const { data, error: e2 } = await supabase.rpc("get_my_features", { p_company_id: c.company_id });
      if (e2) return setError(errorMessage(e2));
      result.push({ companyId: c.company_id, companyName: c.company_name, companyPhone: c.company_phone, features: (data as MyFeature[]).filter((f) => f.mode === "addon") });
    }
    setCompanies(result);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function request(companyId: string, f: MyFeature) {
    setBusy(f.feature_key);
    setError(null);
    setMessage(null);
    const { error: err } = await supabase.rpc("request_addon", { p_company_id: companyId, p_feature_key: f.feature_key, p_payment_method: "multicaixa_express" });
    setBusy(null);
    if (err) return setError(errorMessage(err));
    setMessage(`Pedido enviado: "${f.name_pt}" (${formatKz(f.addon_price_kz)}/mês). Faça o pagamento por Multicaixa Express à empresa — o extra é ativado assim que o pagamento for confirmado.`);
    load();
  }

  return (
    <Screen>
      <Title>Extras</Title>
      <Muted>Serviços adicionais pagos mensalmente à empresa de transporte.</Muted>
      {message && <Banner kind="success">{message}</Banner>}
      {error && <Banner>{error}</Banner>}
      {!companies && !error && <Loading />}
      {companies?.map((c) => (
        <View key={c.companyId} style={{ gap: space.md }}>
          {companies.length > 1 && <SectionLabel>{c.companyName}</SectionLabel>}
          {c.features.length === 0 && <Card><Muted>Esta empresa não oferece extras de momento.</Muted></Card>}
          {c.features.map((f) => {
            const active = f.enabled;
            const pending = f.addon_status === "pending_payment";
            return (
              <Card key={f.feature_key} testID={`extra-${f.feature_key}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink }}>{f.name_pt}</Text>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{formatKz(f.addon_price_kz)}<Text style={{ fontWeight: "400", color: colors.muted }}>/mês</Text></Text>
                </View>
                <Muted>{f.description_pt}</Muted>
                {active ? (
                  <Badge label={`Ativo${f.addon_ends_on ? ` até ${new Date(f.addon_ends_on + "T00:00:00").toLocaleDateString("pt-AO")}` : ""}`} bg={colors.greenSoft} fg={colors.green} />
                ) : pending ? (
                  <Badge label={ADDON_STATUS_LABELS.pending_payment} bg={colors.amberSoft} fg="#92400E" />
                ) : (
                  <Button title="Quero este extra" variant="brand" loading={busy === f.feature_key} onPress={() => request(c.companyId, f)} />
                )}
              </Card>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}
