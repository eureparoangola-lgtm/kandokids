import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { View } from "react-native";
import { colors, radius } from "@/lib/theme";
import { LUANDA, type Point, type VehicleMapProps } from "./vehicle-map.types";

const busIcon = L.divIcon({
  className: "",
  html: `<div style="width:36px;height:36px;border-radius:18px;background:${colors.brand};border:3px solid ${colors.ink};display:flex;align-items:center;justify-content:center;font-size:18px">🚌</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function Follow({ point }: { point: Point }) {
  const map = useMap();
  useEffect(() => {
    map.setView([point.lat, point.lng], map.getZoom(), { animate: true });
  }, [map, point.lat, point.lng]);
  return null;
}

export function VehicleMap({ vehicle, vehicleLabel, home, school, height = 260 }: VehicleMapProps) {
  const center = vehicle ?? home ?? (school?.lat != null ? school : null) ?? LUANDA;
  return (
    <View testID="vehicle-map" style={{ height, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
      <MapContainer center={[center.lat, center.lng]} zoom={14} style={{ height: "100%", width: "100%" }} attributionControl>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {vehicle && (
          <>
            <Marker position={[vehicle.lat, vehicle.lng]} icon={busIcon}>
              <Tooltip direction="top" offset={[0, -18]}>{vehicleLabel}</Tooltip>
            </Marker>
            <Follow point={vehicle} />
          </>
        )}
        {home && (
          <CircleMarker center={[home.lat, home.lng]} radius={8} pathOptions={{ color: colors.inkSoft, fillOpacity: 0.9 }}>
            <Tooltip>Casa</Tooltip>
          </CircleMarker>
        )}
        {school && school.lat != null && school.lng != null && (
          <CircleMarker center={[school.lat, school.lng]} radius={8} pathOptions={{ color: colors.green, fillOpacity: 0.9 }}>
            <Tooltip>{school.name}</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </View>
  );
}
