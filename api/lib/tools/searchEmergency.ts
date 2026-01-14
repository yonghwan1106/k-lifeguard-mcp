/**
 * K-LifeGuard MCP Server - Search Emergency Tool
 * 응급의료기관 검색 도구
 */

import type { Hospital, HospitalRecommendation } from '../types';
import { fetchEmergencyHospitals, fetchRealTimeBedInfo } from '../services/nemcApi';
import { fetchETAForHospitals } from '../services/kakaoNaviApi';
import { getSymptomMapping, calculateHospitalScore, getEquipmentName } from '../utils';

export interface SearchEmergencyInput {
  latitude: number;
  longitude: number;
  symptoms: string;
  radius_km?: number;
}

export interface SearchEmergencyResult {
  success: boolean;
  message?: string;
  suggestions?: string[];
  search_info?: {
    location: { latitude: number; longitude: number };
    symptoms: string;
    radius_km: number;
    analyzed_symptoms: {
      matched_keywords: string[];
      recommended_departments: string[];
      required_equipment: string[];
    } | null;
    total_found: number;
    timestamp: string;
  };
  recommendations?: HospitalRecommendation[];
  scoring_explanation?: {
    formula: string;
    weights: {
      bed_availability: string;
      distance: string;
      traffic_eta: string;
      specialty_match: string;
    };
  };
}

export async function handleSearchEmergency(args: SearchEmergencyInput): Promise<SearchEmergencyResult> {
  const { latitude, longitude, symptoms, radius_km = 10 } = args;

  // 1. 응급실 목록 조회
  const hospitals = await fetchEmergencyHospitals(latitude, longitude, radius_km);

  if (hospitals.length === 0) {
    return {
      success: false,
      message: `반경 ${radius_km}km 내 응급의료기관을 찾을 수 없습니다.`,
      suggestions: ['검색 반경을 늘려보세요.', '다른 위치에서 다시 검색해보세요.']
    };
  }

  // 2. 실시간 병상 정보 조회
  const hpids = hospitals.map(h => h.hpid);
  const bedInfoMap = await fetchRealTimeBedInfo(hpids);

  // 3. 병상 정보 병합
  hospitals.forEach(h => {
    const bedInfo = bedInfoMap.get(h.hpid);
    if (bedInfo) {
      Object.assign(h, bedInfo);
    }
  });

  // 4. 카카오 Navi ETA 조회
  await fetchETAForHospitals(latitude, longitude, hospitals);

  // 5. 증상 매핑
  const symptomMapping = getSymptomMapping(symptoms);

  // 6. 스코어링
  hospitals.forEach(h => {
    const { score, breakdown } = calculateHospitalScore(h, h.etaMinutes || null, symptomMapping);
    h.score = score;
    h.scoreBreakdown = breakdown;
  });

  // 7. 점수순 정렬
  hospitals.sort((a, b) => (b.score || 0) - (a.score || 0));

  // 8. 상위 5개 결과 반환
  const topHospitals: HospitalRecommendation[] = hospitals.slice(0, 5).map((h, idx) => ({
    rank: idx + 1,
    hospital_id: h.hpid,
    name: h.dutyName,
    address: h.dutyAddr,
    emergency_tel: h.dutyTel3 || h.dutyTel1,
    distance_km: Math.round((h.distance || 0) * 10) / 10,
    eta_minutes: h.etaMinutes || null,
    available_beds: {
      emergency: h.hvec || 0,
      operation: h.hvoc || 0,
      general: h.hvgc || 0,
      total: (h.hvec || 0) + (h.hvoc || 0) + (h.hvgc || 0)
    },
    equipment: {
      ct: h.hvctayn === 'Y',
      mri: h.hvmriayn === 'Y',
      angio: h.hvangioayn === 'Y',
      ventilator: h.hvventiayn === 'Y'
    },
    score: h.score,
    score_breakdown: h.scoreBreakdown,
    coordinates: {
      latitude: h.wgs84Lat,
      longitude: h.wgs84Lon
    }
  }));

  const analyzedSymptoms = symptomMapping ? {
    matched_keywords: symptomMapping.keywords.filter(k => symptoms.toLowerCase().includes(k)),
    recommended_departments: symptomMapping.departments,
    required_equipment: symptomMapping.equipment.map(eq => getEquipmentName(eq))
  } : null;

  return {
    success: true,
    search_info: {
      location: { latitude, longitude },
      symptoms,
      radius_km,
      analyzed_symptoms: analyzedSymptoms,
      total_found: hospitals.length,
      timestamp: new Date().toISOString()
    },
    recommendations: topHospitals,
    scoring_explanation: {
      formula: '(병상×0.4) + (거리×0.3) + (교통×0.2) + (전문성×0.1)',
      weights: {
        bed_availability: '40%',
        distance: '30%',
        traffic_eta: '20%',
        specialty_match: '10%'
      }
    }
  };
}
