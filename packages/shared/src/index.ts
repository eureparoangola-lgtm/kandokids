// Tipos e textos partilhados entre a app móvel e o painel web.
// Os valores espelham os enums da base de dados (supabase/migrations).

export type AppRole =
  | "platform_admin"
  | "company_admin"
  | "dispatcher"
  | "assistant"
  | "driver"
  | "guardian";

export type FeatureMode = "off" | "included" | "addon";
export type FeatureCategory = "tracking" | "safety" | "communication" | "operations" | "extra";
export type AddonStatus = "pending_payment" | "active" | "cancelled" | "expired";
export type TripDirection = "to_school" | "to_home";
export type TripStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type BoardingStatus = "expected" | "absent" | "on_board" | "delivered" | "no_show" | "transferred";

export type FeatureKey =
  | "live_tracking"
  | "proximity_alert"
  | "extended_history"
  | "pickup_pin"
  | "authorized_adults"
  | "empty_vehicle_check"
  | "sos_button"
  | "speeding_alerts"
  | "dropoff_photo"
  | "vehicle_chat"
  | "voice_notes"
  | "incident_broadcast"
  | "sms_alerts"
  | "family_sharing"
  | "monthly_report"
  | "absence_toggle"
  | "qr_checkin"
  | "route_optimization"
  | "trip_feedback";

export interface Feature {
  key: FeatureKey;
  name_pt: string;
  description_pt: string;
  category: FeatureCategory;
  allows_included: boolean;
  allows_addon: boolean;
  default_mode: FeatureMode;
  addon_price_kz: number | null; // preço mensal do extra (cobrado pela Kandokids)
  sort_order: number;
}

export interface CompanyFeature {
  company_id: string;
  feature_key: FeatureKey;
  mode: FeatureMode;
  addon_price_kz: number | null;
  locked_by_platform: boolean;
  updated_at: string;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  platform_admin: "Equipa Kandokids",
  company_admin: "Administrador",
  dispatcher: "Operador",
  assistant: "Assistente",
  driver: "Motorista",
  guardian: "Encarregado",
};

export const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  tracking: "Localização",
  safety: "Segurança",
  communication: "Comunicação",
  operations: "Operações",
  extra: "Extras",
};

export const MODE_LABELS: Record<FeatureMode, string> = {
  off: "Desligado",
  included: "Incluído",
  addon: "Extra pago",
};

export const ADDON_STATUS_LABELS: Record<AddonStatus, string> = {
  pending_payment: "Aguarda pagamento",
  active: "Ativo",
  cancelled: "Cancelado",
  expired: "Expirado",
};

export const DIRECTION_LABELS: Record<TripDirection, string> = {
  to_school: "Ida para a escola",
  to_home: "Regresso a casa",
};

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  scheduled: "Agendada",
  in_progress: "Em curso",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export const BOARDING_STATUS_LABELS: Record<BoardingStatus, string> = {
  expected: "À espera",
  absent: "Ausente",
  on_board: "A bordo",
  delivered: "Entregue",
  no_show: "Não apareceu",
  transferred: "Mudou de viatura",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  multicaixa_express: "Multicaixa Express",
  referencia: "Pagamento por referência",
  transferencia: "Transferência bancária",
  numerario: "Numerário",
};

const kz = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

/** Formata um valor em kwanzas, ex.: 1500 → "1 500 Kz". */
export function formatKz(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return kz.format(Number(value));
}

// ---------------------------------------------------------------------------
// Convites por WhatsApp
// ---------------------------------------------------------------------------

/** Normaliza um número angolano para o formato internacional sem "+" (ex.: 244923000000). */
export function normalizeAngolanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("244")) return digits;
  if (digits.length === 9 && digits.startsWith("9")) return `244${digits}`;
  return digits;
}

/** Link que abre o WhatsApp com a mensagem já escrita. */
export function whatsappLink(phone: string | null | undefined, text: string): string {
  const to = phone ? normalizeAngolanPhone(phone) : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

export function guardianInviteMessage(opts: { company: string; student: string; code: string; guardianName?: string | null }): string {
  const hello = opts.guardianName ? `Olá ${opts.guardianName.split(" ")[0]}!` : "Olá!";
  return `${hello} A ${opts.company} usa a app Kandokids: vai poder ver em que viatura está ${opts.student}, acompanhar a viagem no mapa e falar com a viatura. Instale a app Kandokids, escolha "Tenho um código de convite" e use o código ${opts.code}.`;
}

export function staffInviteMessage(opts: { company: string; name: string; role: string; code: string }): string {
  return `Olá ${opts.name.split(" ")[0]}! Foi adicionado(a) como ${opts.role.toLowerCase()} da ${opts.company} na Kandokids. Instale a app Kandokids, escolha "Tenho um código de convite" e use o código ${opts.code}.`;
}

// ---------------------------------------------------------------------------
// Importação de alunos (Excel / CSV)
// ---------------------------------------------------------------------------

export interface StudentImportRow {
  full_name: string;
  grade?: string;
  school_name?: string;
  home_address?: string;
  guardian_name?: string;
  guardian_phone?: string;
  relationship?: string;
}

const HEADER_ALIASES: Record<keyof StudentImportRow, string[]> = {
  full_name: ["nome", "nome do aluno", "aluno", "nome completo", "crianca", "nome da crianca"],
  grade: ["classe", "turma", "ano", "classe/turma"],
  school_name: ["escola", "colegio", "nome da escola"],
  home_address: ["morada", "endereco", "residencia", "bairro", "zona"],
  guardian_name: ["encarregado", "nome do encarregado", "pai/mae", "responsavel", "encarregado de educacao"],
  guardian_phone: ["telefone", "telemovel", "contacto", "telefone do encarregado", "numero", "whatsapp"],
  relationship: ["parentesco", "relacao", "grau de parentesco"],
};

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Converte linhas de uma folha (1.ª linha = cabeçalhos) em alunos. Devolve também colunas reconhecidas. */
export function parseStudentSheet(rows: unknown[][]): { students: StudentImportRow[]; recognized: string[]; missingName: boolean } {
  const [header = [], ...body] = rows;
  const map = new Map<number, keyof StudentImportRow>();
  header.forEach((h, i) => {
    const key = (Object.keys(HEADER_ALIASES) as (keyof StudentImportRow)[]).find((k) =>
      HEADER_ALIASES[k].includes(normalize(String(h ?? ""))),
    );
    if (key && ![...map.values()].includes(key)) map.set(i, key);
  });
  const students = body
    .map((row) => {
      const s: Partial<StudentImportRow> = {};
      map.forEach((key, i) => {
        const v = row[i];
        if (v !== null && v !== undefined && String(v).trim() !== "") s[key] = String(v).trim();
      });
      return s as StudentImportRow;
    })
    .filter((s) => s.full_name);
  return { students, recognized: [...map.values()], missingName: ![...map.values()].includes("full_name") };
}

/** CSV simples (separador , ou ;) com aspas. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
