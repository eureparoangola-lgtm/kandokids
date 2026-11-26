export interface Point { lat: number; lng: number }

export interface VehicleMapProps {
  vehicle: Point | null;
  vehicleLabel: string;
  home?: Point | null;
  school?: (Point & { name: string }) | null;
  height?: number;
}

export const LUANDA: Point = { lat: -8.8383, lng: 13.2344 };
