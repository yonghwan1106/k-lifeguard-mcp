/**
 * K-LifeGuard MCP Server - Type Definitions
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface Hospital {
  hpid: string;
  dutyName: string;
  dutyAddr: string;
  dutyTel1: string;
  dutyTel3?: string;
  wgs84Lat: number;
  wgs84Lon: number;
  dgidIdName?: string;
  dutyEryn?: string;
  hvec?: number;
  hvoc?: number;
  hvcc?: number;
  hvncc?: number;
  hvgc?: number;
  hvicc?: number;
  hvctayn?: string;
  hvmriayn?: string;
  hvangioayn?: string;
  hvventiayn?: string;
  hvamyn?: string;
  distance?: number;
  etaMinutes?: number;
  score?: number;
  scoreBreakdown?: ScoreBreakdown;
}

export interface ScoreBreakdown {
  bedScore: number;
  distanceScore: number;
  trafficScore: number;
  specialtyScore: number;
}

export interface Pharmacy {
  dutyName: string;
  dutyAddr: string;
  dutyTel1: string;
  wgs84Lat: number;
  wgs84Lon: number;
  dutyTime1s?: string;
  dutyTime1c?: string;
  dutyTime2s?: string;
  dutyTime2c?: string;
  dutyTime3s?: string;
  dutyTime3c?: string;
  dutyTime4s?: string;
  dutyTime4c?: string;
  dutyTime5s?: string;
  dutyTime5c?: string;
  dutyTime6s?: string;
  dutyTime6c?: string;
  dutyTime7s?: string;
  dutyTime7c?: string;
  dutyTime8s?: string;
  dutyTime8c?: string;
  distance?: number;
}

export interface EmergencySession {
  sessionId: string;
  hospitalId: string;
  hospitalName: string;
  etaMinutes: number;
  activatedAt: Date;
  userLatitude: number;
  userLongitude: number;
  symptoms: string;
  guardiansNotified: boolean;
}

export interface SymptomMapping {
  keywords: string[];
  departments: string[];
  equipment: string[];
}

export interface KakaoNaviResponse {
  routes: Array<{
    summary: {
      duration: number;
      distance: number;
    };
  }>;
}

export interface MCPRequest {
  jsonrpc: string;
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface HospitalRecommendation {
  rank: number;
  hospital_id: string;
  name: string;
  address: string;
  emergency_tel: string;
  distance_km: number;
  eta_minutes: number | null;
  available_beds: {
    emergency: number;
    operation: number;
    general: number;
    total: number;
  };
  equipment: {
    ct: boolean;
    mri: boolean;
    angio: boolean;
    ventilator: boolean;
  };
  score?: number;
  score_breakdown?: ScoreBreakdown;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface PharmacyResult {
  rank: number;
  name: string;
  address: string;
  tel: string;
  distance_km: number;
  today_hours: {
    open: string;
    close: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
}
