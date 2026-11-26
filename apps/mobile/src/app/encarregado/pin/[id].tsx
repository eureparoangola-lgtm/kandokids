import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Banner, Button, Card, Field, Muted, Screen, Title } from "@/components/ui";
import { errorMessage, supabase } from "@/lib/supabase";

export default function SetPin() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    if (!/^\d{4}$/.test(pin)) return setError("O PIN deve ter 4 dígitos.");
    if (pin !== confirm) return setError("Os PINs não coincidem.");
    setBusy(true);
    const { error: err } = await supabase.rpc("set_pickup_pin", { p_student_id: id, p_pin: pin });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    setDone(true);
  }

  if (done) {
    return (
      <Screen>
        <Banner kind="success">PIN guardado. Partilhe-o apenas com quem vai buscar {name ?? "a criança"}.</Banner>
        <Button title="Voltar" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>PIN de entrega</Title>
      <Card>
        <Muted>
          Na viagem para casa, o assistente só entrega {name ?? "a criança"} a quem disser este PIN (ou a um adulto autorizado).
          Ninguém na empresa consegue ver o PIN.
        </Muted>
      </Card>
      <Field label="Novo PIN (4 dígitos)" value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 4))}
        keyboardType="number-pad" secureTextEntry maxLength={4} />
      <Field label="Confirmar PIN" value={confirm} onChangeText={(t) => setConfirm(t.replace(/\D/g, "").slice(0, 4))}
        keyboardType="number-pad" secureTextEntry maxLength={4} />
      {error && <Banner>{error}</Banner>}
      <Button title="Guardar PIN" onPress={save} loading={busy} disabled={pin.length !== 4 || confirm.length !== 4} />
    </Screen>
  );
}
