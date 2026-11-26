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
  suggested_price_kz: number | null;
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
