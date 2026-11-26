import MapView, { Marker } from "react-native-maps";
import { View } from "react-native";
import { colors, radius } from "@/lib/theme";
import { LUANDA, type VehicleMapProps } from "./vehicle-map.types";

export function VehicleMap({ vehicle, vehicleLabel, home, school, height = 260 }: VehicleMapProps) {
  const center = vehicle ?? home ?? (school?.lat != null ? school : null) ?? LUANDA;
  return (
    <View style={{ height, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
      <MapView
        style={{ flex: 1 }}
        region={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        accessibilityLabel="Mapa da viagem">
        {vehicle && <Marker coordinate={{ latitude: vehicle.lat, longitude: vehicle.lng }} title={vehicleLabel} pinColor={colors.brand} />}
        {home && <Marker coordinate={{ latitude: home.lat, longitude: home.lng }} title="Casa" pinColor={colors.inkSoft} />}
        {school && school.lat != null && <Marker coordinate={{ latitude: school.lat, longitude: school.lng }} title={school.name} pinColor={colors.green} />}
      </MapView>
    </View>
  );
}
