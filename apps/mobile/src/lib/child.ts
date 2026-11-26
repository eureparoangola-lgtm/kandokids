import { hhmm } from "./format";
import type { Child, ChildTrip } from "./types";

/** A viagem mais relevante agora: em curso → por iniciar → a última. */
export function currentTrip(child: Child): ChildTrip | null {
  const t = child.trips;
  return t.find((x) => x.trip_status === "in_progress") ?? t.find((x) => x.trip_status === "scheduled") ?? t[t.length - 1] ?? null;
}

/** Frase curta sobre onde está a criança. */
export function statusSentence(child: Child, trip: ChildTrip | null): string {
  if (child.absent_today) return `${child.first_name} não vai hoje.`;
  if (!trip) return "Sem viagens hoje.";
  const v = trip.vehicle.nickname ?? trip.vehicle.plate;
  switch (trip.status) {
    case "on_board":
      return `${child.first_name} está na viatura ${v} desde as ${hhmm(trip.picked_up_at)}.`;
    case "delivered":
      return trip.direction === "to_school"
        ? `${child.first_name} chegou à escola às ${hhmm(trip.delivered_at)}.`
        : `${child.first_name} chegou a casa às ${hhmm(trip.delivered_at)}.`;
    case "expected":
      return trip.trip_status === "in_progress"
        ? `A viatura ${v} está a caminho.`
        : `Vai na viatura ${v}${trip.scheduled_time ? ` às ${trip.scheduled_time.slice(0, 5)}` : ""}.`;
    case "absent":
      return `${child.first_name} não vai nesta viagem.`;
    case "no_show":
      return `${child.first_name} não foi recolhido(a).`;
    default:
      return "";
  }
}
