import type { BoardingStatus } from "@kandokids/shared";
import { colors } from "./theme";

const timeFmt = new Intl.DateTimeFormat("pt-AO", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Luanda" });

export function hhmm(iso: string | null | undefined): string {
  return iso ? timeFmt.format(new Date(iso)) : "";
}

/** Data de hoje em Luanda (AAAA-MM-DD). */
export function luandaDate(offsetDays = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda" }).format(new Date(Date.now() + offsetDays * 864e5));
}

export function minutesAgo(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora mesmo";
  if (m === 1) return "há 1 minuto";
  if (m < 60) return `há ${m} minutos`;
  return `às ${hhmm(iso)}`;
}

export const STATUS_STYLE: Record<BoardingStatus, { bg: string; fg: string }> = {
  expected: { bg: colors.amberSoft, fg: "#92400E" },
  on_board: { bg: colors.greenSoft, fg: colors.green },
  delivered: { bg: "#E0E7FF", fg: colors.inkSoft },
  absent: { bg: "#F1F5F9", fg: colors.muted },
  no_show: { bg: colors.redSoft, fg: colors.red },
  transferred: { bg: "#F1F5F9", fg: colors.muted },
};
