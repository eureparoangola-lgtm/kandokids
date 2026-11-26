import type { BoardingStatus, FeatureKey, TripDirection, TripStatus } from "@kandokids/shared";

export interface Vehicle { id: string; plate: string; nickname: string | null; color?: string | null }

export interface ChildTrip {
  trip_id: string;
  trip_student_id: string;
  direction: TripDirection;
  trip_status: TripStatus;
  status: BoardingStatus;
  picked_up_at: string | null;
  delivered_at: string | null;
  handed_to_name: string | null;
  handover_method: string | null;
  started_at: string | null;
  ended_at: string | null;
  scheduled_time: string | null;
  can_track: boolean;
  vehicle: Vehicle;
  assistant: { full_name: string; phone: string | null } | null;
}

export interface Child {
  student_id: string;
  full_name: string;
  first_name: string;
  grade: string | null;
  photo_url: string | null;
  home_lat: number | null;
  home_lng: number | null;
  school_name: string | null;
  company_id: string;
  company_name: string;
  company_phone: string | null;
  company_suspended: boolean;
  has_pin: boolean;
  absent_today: boolean;
  absent_tomorrow: boolean;
  features: Record<FeatureKey, boolean>;
  trips: ChildTrip[];
}

export interface LivePosition {
  trip_id: string;
  status: TripStatus;
  position: { lat: number; lng: number; speed_kmh: number | null; heading: number | null; recorded_at: string } | null;
  school: { name: string; lat: number | null; lng: number | null } | null;
}

export interface CrewTrip {
  trip_id: string;
  direction: TripDirection;
  status: TripStatus;
  route_name: string | null;
  scheduled_time: string | null;
  vehicle: Vehicle;
  total: number;
  on_board: number;
  delivered: number;
  absent: number;
}

export interface ManifestStudent {
  trip_student_id: string;
  student_id: string;
  full_name: string;
  grade: string | null;
  home_address: string | null;
  home_lat: number | null;
  home_lng: number | null;
  medical_notes: string | null;
  status: BoardingStatus;
  picked_up_at: string | null;
  delivered_at: string | null;
  has_pin: boolean;
  guardians: { full_name: string; phone: string | null; relationship: string | null }[];
  authorized_adults: { id: string; full_name: string; relationship: string | null; id_document: string | null }[];
}

export interface Manifest {
  trip_id: string;
  direction: TripDirection;
  status: TripStatus;
  started_at: string | null;
  ended_at: string | null;
  route_name: string | null;
  vehicle: Vehicle;
  school: { name: string; lat: number | null; lng: number | null } | null;
  features: Record<
    "pickup_pin" | "authorized_adults" | "qr_checkin" | "empty_vehicle_check" | "sos_button" | "incident_broadcast" | "dropoff_photo" | "vehicle_chat",
    boolean
  >;
  students: ManifestStudent[];
}
