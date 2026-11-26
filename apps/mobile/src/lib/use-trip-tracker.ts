import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export type TrackerState = "off" | "starting" | "on" | "denied" | "error";

/**
 * Envia a posição da viatura enquanto a viagem está em curso:
 * a cada ~10 s ou 30 m, o que acontecer primeiro.
 * (Em segundo plano — ecrã desligado — será adicionado com uma development build.)
 */
export function useTripTracker(tripId: string | undefined, vehicleId: string | undefined, active: boolean) {
  const [state, setState] = useState<TrackerState>("off");
  const [last, setLast] = useState<Location.LocationObject | null>(null);
  const lastRef = useRef<Location.LocationObject | null>(null);

  useEffect(() => {
    if (!active || !tripId || !vehicleId) {
      setState("off");
      return;
    }
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      setState("starting");
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setState("denied");
        return;
      }
      try {
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 30 },
          async (loc) => {
            if (cancelled) return;
            lastRef.current = loc;
            setLast(loc);
            setState("on");
            await supabase.from("vehicle_positions").insert({
              trip_id: tripId,
              vehicle_id: vehicleId,
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              speed_kmh: loc.coords.speed != null && loc.coords.speed >= 0 ? loc.coords.speed * 3.6 : null,
              heading: loc.coords.heading,
              accuracy_m: loc.coords.accuracy,
            });
          },
        );
      } catch {
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [tripId, vehicleId, active]);

  /** Coordenadas atuais para registar recolhas/entregas. */
  const coords = () => (lastRef.current ? { p_lat: lastRef.current.coords.latitude, p_lng: lastRef.current.coords.longitude } : {});
  return { state, last, coords };
}
