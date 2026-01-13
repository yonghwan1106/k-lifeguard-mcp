import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// Type Definitions
// ============================================================================

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface Hospital {
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
  scoreBreakdown?: {
    bedScore: number;
    distanceScore: number;
    trafficScore: number;
    specialtyScore: number;
  };
}

interface Pharmacy {
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

interface EmergencySession {
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

interface KakaoNaviResponse {
  routes: Array<{
    summary: {
      duration: number;
      distance: number;
    };
  }>;
}

// ============================================================================
// Constants
// ============================================================================

const DATA_GO_KR_API_KEY = process.env.DATA_GO_KR_API_KEY || '';
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || '';

const NEMC_BASE_URL = 'http://apis.data.go.kr/B552657';

// 시도 코드 매핑
const SIDO_CODES: Record<string, string> = {
  '서울': '11', '부산': '21', '대구': '22', '인천': '23',
  '광주': '24', '대전': '25', '울산': '26', '세종': '29',
  '경기': '31', '강원': '32', '충북': '33', '충남': '34',
  '전북': '35', '전남': '36', '경북': '37', '경남': '38', '제주': '39'
};

// 증상-진료과 매핑
interface SymptomMapping {
  keywords: string[];
  departments: string[];
  equipment: string[];
}

const SYMPTOM_MAPPINGS: SymptomMapping[] = [
  {
    keywords: ['가슴통증', '가슴', '심장', '흉통', '심근경색', '협심증'],
    departments: ['심장내과', '응급의학과', '순환기내과'],
    equipment: ['hvangioayn'] // 심혈관조영실
  },
  {
    keywords: ['뇌졸중', '마비', '어지러움', '두통', '뇌출혈', '뇌경색'],
    departments: ['신경외과', '신경과'],
    equipment: ['hvctayn', 'hvmriayn'] // CT, MRI
  },
  {
    keywords: ['소아', '아이', '어린이', '아기', '신생아', '소아고열'],
    departments: ['소아청소년과', '소아외과'],
    equipment: []
  },
  {
    keywords: ['골절', '외상', '사고', '교통사고', '다발성외상'],
    departments: ['정형외과', '외과', '응급의학과'],
    equipment: ['hvventiayn'] // 인공호흡기
  },
  {
    keywords: ['호흡곤란', '호흡', '기침', '폐렴', '천식'],
    departments: ['호흡기내과', '응급의학과'],
    equipment: ['hvventiayn']
  },
  {
    keywords: ['화상', '열상', '찰과상'],
    departments: ['외과', '성형외과'],
    equipment: []
  },
  {
    keywords: ['복통', '배', '소화', '구토', '설사'],
    departments: ['소화기내과', '외과'],
    equipment: []
  },
  {
    keywords: ['출혈', '피', '대량출혈'],
    departments: ['외과', '응급의학과'],
    equipment: []
  }
];

// 인메모리 세션 저장소
const emergencySessions: Map<string, EmergencySession> = new Map();

// ============================================================================
// MCP Tools Definition
// ============================================================================

const TOOLS: MCPTool[] = [
  {
    name: 'lifeguard_search_emergency',
    description: '증상과 위치 기반 최적 응급의료기관 추천. 병상 가용성, 거리, 실시간 교통, 전문성을 복합 스코어링하여 최적의 병원을 추천합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: '현재 위치 위도 (예: 37.5665)' },
        longitude: { type: 'number', description: '현재 위치 경도 (예: 126.9780)' },
        symptoms: { type: 'string', description: '증상 설명 (예: 가슴통증, 소아고열, 뇌졸중 의심)' },
        radius_km: { type: 'number', description: '검색 반경 km (기본값: 10)' }
      },
      required: ['latitude', 'longitude', 'symptoms']
    }
  },
  {
    name: 'lifeguard_activate_emergency',
    description: '응급 모드를 활성화합니다. 선택한 병원으로 이동을 시작하고, 보호자에게 카카오톡 알림을 발송하며, 실시간 병상 모니터링을 시작합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        hospital_id: { type: 'string', description: '병원 HPID' },
        hospital_name: { type: 'string', description: '병원명' },
        eta_minutes: { type: 'number', description: '예상 도착 시간 (분)' },
        user_latitude: { type: 'number', description: '사용자 위치 위도' },
        user_longitude: { type: 'number', description: '사용자 위치 경도' },
        symptoms: { type: 'string', description: '증상' },
        notify_guardians: { type: 'boolean', description: '보호자 알림 여부 (기본값: true)' }
      },
      required: ['hospital_id', 'hospital_name', 'eta_minutes', 'user_latitude', 'user_longitude', 'symptoms']
    }
  },
  {
    name: 'lifeguard_get_status',
    description: '현재 응급 모드 상태를 조회합니다. 활성화된 응급 세션이 있으면 목적지 병원의 실시간 병상 정보도 함께 조회합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: '세션 ID (없으면 최근 세션 조회)' }
      },
      required: []
    }
  },
  {
    name: 'lifeguard_find_pharmacy',
    description: '주변 약국을 검색합니다. 야간/휴일 운영 약국을 필터링할 수 있습니다.',
    inputSchema: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: '현재 위치 위도' },
        longitude: { type: 'number', description: '현재 위치 경도' },
        filter: {
          type: 'string',
          description: '필터 옵션: all(전체), night(야간운영), holiday(휴일운영)',
          enum: ['all', 'night', 'holiday']
        },
        radius_km: { type: 'number', description: '검색 반경 km (기본값: 3)' }
      },
      required: ['latitude', 'longitude']
    }
  }
];

// ============================================================================
// XML Parsing Utilities
// ============================================================================

function extractXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractXmlValueWithCDATA(xml: string, tag: string): string | null {
  const cdataRegex = new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]*?)\\]\\]></${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  return extractXmlValue(xml, tag);
}

function extractAllItems(xml: string): string[] {
  const items: string[] = [];
  const regex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    items.push(match[1]);
  }
  return items;
}

// ============================================================================
// Distance & Scoring Utilities
// ============================================================================

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 지구 반경 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getSymptomMapping(symptoms: string): SymptomMapping | null {
  const lowered = symptoms.toLowerCase();
  for (const mapping of SYMPTOM_MAPPINGS) {
    if (mapping.keywords.some(k => lowered.includes(k))) {
      return mapping;
    }
  }
  return null;
}

function calculateHospitalScore(
  hospital: Hospital,
  etaMinutes: number | null,
  symptomMapping: SymptomMapping | null
): { score: number; breakdown: Hospital['scoreBreakdown'] } {
  // 병상 점수 (40%)
  const availableBeds = (hospital.hvec || 0) + (hospital.hvoc || 0) + (hospital.hvgc || 0);
  const bedScore = Math.min(availableBeds * 10, 100);

  // 거리 점수 (30%)
  const distanceScore = Math.max(100 - (hospital.distance || 0) * 5, 0);

  // 교통 점수 (20%)
  const trafficScore = etaMinutes !== null
    ? Math.max(100 - etaMinutes * 1.67, 0)
    : 50; // ETA 없으면 중간값

  // 전문성 점수 (10%)
  let specialtyScore = 50; // 기본값
  if (symptomMapping) {
    // 필요 장비 체크
    const hasEquipment = symptomMapping.equipment.length === 0 ||
      symptomMapping.equipment.some(eq => {
        const value = hospital[eq as keyof Hospital];
        return value === 'Y' || value === 'y';
      });
    if (hasEquipment) {
      specialtyScore = 100;
    }
  }

  const totalScore = (bedScore * 0.4) + (distanceScore * 0.3) + (trafficScore * 0.2) + (specialtyScore * 0.1);

  return {
    score: Math.round(totalScore * 10) / 10,
    breakdown: {
      bedScore: Math.round(bedScore),
      distanceScore: Math.round(distanceScore),
      trafficScore: Math.round(trafficScore),
      specialtyScore: Math.round(specialtyScore)
    }
  };
}

// ============================================================================
// NEMC API Functions
// ============================================================================

async function fetchEmergencyHospitals(
  latitude: number,
  longitude: number,
  radiusKm: number = 10
): Promise<Hospital[]> {
  const sidoCode = await getSidoCodeFromCoords(latitude, longitude);

  const params = new URLSearchParams({
    serviceKey: DATA_GO_KR_API_KEY,
    WGS84_LON: longitude.toString(),
    WGS84_LAT: latitude.toString(),
    numOfRows: '50',
    pageNo: '1'
  });

  if (sidoCode) {
    params.append('STAGE1', sidoCode);
  }

  const url = `${NEMC_BASE_URL}/ErmctInfoInqireService/getEgytListInfoInqire?${params}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
      signal: AbortSignal.timeout(10000)
    });
    const xml = await response.text();
    const items = extractAllItems(xml);

    const hospitals: Hospital[] = items.map(item => ({
      hpid: extractXmlValue(item, 'hpid') || '',
      dutyName: extractXmlValueWithCDATA(item, 'dutyName') || extractXmlValue(item, 'dutyName') || '',
      dutyAddr: extractXmlValueWithCDATA(item, 'dutyAddr') || extractXmlValue(item, 'dutyAddr') || '',
      dutyTel1: extractXmlValue(item, 'dutyTel1') || '',
      dutyTel3: extractXmlValue(item, 'dutyTel3') || undefined,
      wgs84Lat: parseFloat(extractXmlValue(item, 'wgs84Lat') || '0'),
      wgs84Lon: parseFloat(extractXmlValue(item, 'wgs84Lon') || '0'),
      dgidIdName: extractXmlValue(item, 'dgidIdName') || undefined,
      dutyEryn: extractXmlValue(item, 'dutyEryn') || undefined
    })).filter(h => h.hpid && h.wgs84Lat && h.wgs84Lon);

    // 거리 계산 및 반경 필터링
    hospitals.forEach(h => {
      h.distance = calculateDistance(latitude, longitude, h.wgs84Lat, h.wgs84Lon);
    });

    return hospitals
      .filter(h => (h.distance || 0) <= radiusKm)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  } catch (error) {
    console.error('응급실 목록 조회 실패:', error);
    return [];
  }
}

async function fetchRealTimeBedInfo(hpids: string[]): Promise<Map<string, Partial<Hospital>>> {
  const bedInfoMap = new Map<string, Partial<Hospital>>();

  // 배치로 조회 (최대 10개씩)
  const batches = [];
  for (let i = 0; i < hpids.length; i += 10) {
    batches.push(hpids.slice(i, i + 10));
  }

  for (const batch of batches) {
    const promises = batch.map(async (hpid) => {
      const params = new URLSearchParams({
        serviceKey: DATA_GO_KR_API_KEY,
        HPID: hpid,
        numOfRows: '1',
        pageNo: '1'
      });

      const url = `${NEMC_BASE_URL}/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?${params}`;

      try {
        const response = await fetch(url, {
          headers: { 'Accept': 'application/xml' },
          signal: AbortSignal.timeout(5000)
        });
        const xml = await response.text();
        const items = extractAllItems(xml);

        if (items.length > 0) {
          const item = items[0];
          bedInfoMap.set(hpid, {
            hvec: parseInt(extractXmlValue(item, 'hvec') || '0'),
            hvoc: parseInt(extractXmlValue(item, 'hvoc') || '0'),
            hvcc: parseInt(extractXmlValue(item, 'hvcc') || '0'),
            hvncc: parseInt(extractXmlValue(item, 'hvncc') || '0'),
            hvgc: parseInt(extractXmlValue(item, 'hvgc') || '0'),
            hvicc: parseInt(extractXmlValue(item, 'hvicc') || '0'),
            hvctayn: extractXmlValue(item, 'hvctayn') || undefined,
            hvmriayn: extractXmlValue(item, 'hvmriayn') || undefined,
            hvangioayn: extractXmlValue(item, 'hvangioayn') || undefined,
            hvventiayn: extractXmlValue(item, 'hvventiayn') || undefined,
            hvamyn: extractXmlValue(item, 'hvamyn') || undefined
          });
        }
      } catch {
        // 개별 병원 조회 실패는 무시
      }
    });

    await Promise.all(promises);
  }

  return bedInfoMap;
}

async function fetchPharmacies(
  latitude: number,
  longitude: number,
  radiusKm: number = 3
): Promise<Pharmacy[]> {
  const params = new URLSearchParams({
    serviceKey: DATA_GO_KR_API_KEY,
    WGS84_LON: longitude.toString(),
    WGS84_LAT: latitude.toString(),
    numOfRows: '50',
    pageNo: '1'
  });

  const url = `${NEMC_BASE_URL}/ErmctInsttInfoInqireService/getParmacyListInfoInqire?${params}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
      signal: AbortSignal.timeout(10000)
    });
    const xml = await response.text();
    const items = extractAllItems(xml);

    const pharmacies: Pharmacy[] = items.map(item => ({
      dutyName: extractXmlValueWithCDATA(item, 'dutyName') || extractXmlValue(item, 'dutyName') || '',
      dutyAddr: extractXmlValueWithCDATA(item, 'dutyAddr') || extractXmlValue(item, 'dutyAddr') || '',
      dutyTel1: extractXmlValue(item, 'dutyTel1') || '',
      wgs84Lat: parseFloat(extractXmlValue(item, 'wgs84Lat') || '0'),
      wgs84Lon: parseFloat(extractXmlValue(item, 'wgs84Lon') || '0'),
      dutyTime1s: extractXmlValue(item, 'dutyTime1s') || undefined,
      dutyTime1c: extractXmlValue(item, 'dutyTime1c') || undefined,
      dutyTime2s: extractXmlValue(item, 'dutyTime2s') || undefined,
      dutyTime2c: extractXmlValue(item, 'dutyTime2c') || undefined,
      dutyTime3s: extractXmlValue(item, 'dutyTime3s') || undefined,
      dutyTime3c: extractXmlValue(item, 'dutyTime3c') || undefined,
      dutyTime4s: extractXmlValue(item, 'dutyTime4s') || undefined,
      dutyTime4c: extractXmlValue(item, 'dutyTime4c') || undefined,
      dutyTime5s: extractXmlValue(item, 'dutyTime5s') || undefined,
      dutyTime5c: extractXmlValue(item, 'dutyTime5s') || undefined,
      dutyTime6s: extractXmlValue(item, 'dutyTime6s') || undefined,
      dutyTime6c: extractXmlValue(item, 'dutyTime6c') || undefined,
      dutyTime7s: extractXmlValue(item, 'dutyTime7s') || undefined,
      dutyTime7c: extractXmlValue(item, 'dutyTime7c') || undefined,
      dutyTime8s: extractXmlValue(item, 'dutyTime8s') || undefined,
      dutyTime8c: extractXmlValue(item, 'dutyTime8c') || undefined
    })).filter(p => p.dutyName && p.wgs84Lat && p.wgs84Lon);

    pharmacies.forEach(p => {
      p.distance = calculateDistance(latitude, longitude, p.wgs84Lat, p.wgs84Lon);
    });

    return pharmacies
      .filter(p => (p.distance || 0) <= radiusKm)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  } catch (error) {
    console.error('약국 목록 조회 실패:', error);
    return [];
  }
}

async function getSidoCodeFromCoords(latitude: number, longitude: number): Promise<string | null> {
  // 주요 도시 좌표 범위로 대략적인 시도 코드 판단
  if (latitude >= 37.4 && latitude <= 37.7 && longitude >= 126.7 && longitude <= 127.2) return '11'; // 서울
  if (latitude >= 37.2 && latitude <= 37.7 && longitude >= 126.6 && longitude <= 127.5) return '31'; // 경기
  if (latitude >= 35.0 && latitude <= 35.3 && longitude >= 128.8 && longitude <= 129.3) return '21'; // 부산
  if (latitude >= 35.7 && latitude <= 36.0 && longitude >= 128.4 && longitude <= 128.8) return '22'; // 대구
  if (latitude >= 37.3 && latitude <= 37.6 && longitude >= 126.5 && longitude <= 126.8) return '23'; // 인천
  if (latitude >= 36.2 && latitude <= 36.5 && longitude >= 127.2 && longitude <= 127.5) return '25'; // 대전
  return null;
}

// ============================================================================
// Kakao Navi API Functions
// ============================================================================

async function fetchKakaoNaviETA(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): Promise<number | null> {
  if (!KAKAO_REST_API_KEY) {
    return null;
  }

  const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${originLon},${originLat}&destination=${destLon},${destLat}&priority=RECOMMEND`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.error('카카오 Navi API 오류:', response.status);
      return null;
    }

    const data = await response.json() as KakaoNaviResponse;

    if (data.routes && data.routes.length > 0 && data.routes[0].summary) {
      return Math.round(data.routes[0].summary.duration / 60); // 초 -> 분
    }
    return null;
  } catch (error) {
    console.error('카카오 Navi API 호출 실패:', error);
    return null;
  }
}

async function fetchETAForHospitals(
  originLat: number,
  originLon: number,
  hospitals: Hospital[]
): Promise<void> {
  // 상위 10개 병원에 대해서만 ETA 조회 (API 호출 최적화)
  const topHospitals = hospitals.slice(0, 10);

  const promises = topHospitals.map(async (hospital) => {
    const eta = await fetchKakaoNaviETA(originLat, originLon, hospital.wgs84Lat, hospital.wgs84Lon);
    hospital.etaMinutes = eta || undefined;
  });

  await Promise.all(promises);
}

// ============================================================================
// Tool Implementations
// ============================================================================

async function handleSearchEmergency(args: {
  latitude: number;
  longitude: number;
  symptoms: string;
  radius_km?: number;
}): Promise<unknown> {
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
  const topHospitals = hospitals.slice(0, 5).map(h => ({
    rank: hospitals.indexOf(h) + 1,
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
    required_equipment: symptomMapping.equipment.map(eq => {
      if (eq === 'hvctayn') return 'CT';
      if (eq === 'hvmriayn') return 'MRI';
      if (eq === 'hvangioayn') return '심혈관조영실';
      if (eq === 'hvventiayn') return '인공호흡기';
      return eq;
    })
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

async function handleActivateEmergency(args: {
  hospital_id: string;
  hospital_name: string;
  eta_minutes: number;
  user_latitude: number;
  user_longitude: number;
  symptoms: string;
  notify_guardians?: boolean;
}): Promise<unknown> {
  const {
    hospital_id,
    hospital_name,
    eta_minutes,
    user_latitude,
    user_longitude,
    symptoms,
    notify_guardians = true
  } = args;

  // 세션 ID 생성
  const sessionId = `ER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // 세션 저장
  const session: EmergencySession = {
    sessionId,
    hospitalId: hospital_id,
    hospitalName: hospital_name,
    etaMinutes: eta_minutes,
    activatedAt: new Date(),
    userLatitude: user_latitude,
    userLongitude: user_longitude,
    symptoms,
    guardiansNotified: false
  };

  emergencySessions.set(sessionId, session);

  // 카카오톡 알림 (실제 구현 시 카카오톡 API 연동 필요)
  let notificationResult = null;
  if (notify_guardians) {
    // 실제로는 카카오톡 메시지 API를 호출
    // 여기서는 시뮬레이션
    notificationResult = {
      sent: true,
      message: '보호자 알림이 발송되었습니다. (시뮬레이션)',
      template: {
        type: 'location',
        content: `[응급상황 알림]\n환자가 ${hospital_name}(으)로 이동 중입니다.\n예상 도착: ${eta_minutes}분\n증상: ${symptoms}`
      }
    };
    session.guardiansNotified = true;
  }

  // 카카오 내비 딥링크 생성
  const kakaoNaviLink = `kakaomap://route?sp=${user_latitude},${user_longitude}&ep=,&by=CAR`;

  return {
    success: true,
    session: {
      id: sessionId,
      hospital_id,
      hospital_name,
      eta_minutes,
      activated_at: session.activatedAt.toISOString(),
      status: 'ACTIVE'
    },
    navigation: {
      kakao_navi_link: kakaoNaviLink,
      instruction: '카카오내비 앱이 설치되어 있다면 위 링크로 바로 길안내를 시작할 수 있습니다.'
    },
    guardian_notification: notificationResult,
    monitoring: {
      bed_check_interval: '5분',
      message: '병상 상황이 변동되면 알려드립니다.'
    },
    emergency_tips: [
      '안전벨트를 착용하세요.',
      '응급실 도착 시 증상을 명확히 전달하세요.',
      '신분증과 보험증을 준비하세요.'
    ]
  };
}

async function handleGetStatus(args: { session_id?: string }): Promise<unknown> {
  const { session_id } = args;

  let session: EmergencySession | undefined;

  if (session_id) {
    session = emergencySessions.get(session_id);
  } else {
    // 가장 최근 세션 찾기
    const sessions = Array.from(emergencySessions.values());
    session = sessions.sort((a, b) =>
      b.activatedAt.getTime() - a.activatedAt.getTime()
    )[0];
  }

  if (!session) {
    return {
      success: true,
      active_emergency: false,
      message: '활성화된 응급 세션이 없습니다.',
      tip: '응급 상황 발생 시 lifeguard_search_emergency로 먼저 병원을 검색하세요.'
    };
  }

  // 실시간 병상 정보 조회
  const bedInfoMap = await fetchRealTimeBedInfo([session.hospitalId]);
  const bedInfo = bedInfoMap.get(session.hospitalId);

  const elapsedMinutes = Math.round((Date.now() - session.activatedAt.getTime()) / 60000);
  const remainingEta = Math.max(session.etaMinutes - elapsedMinutes, 0);

  return {
    success: true,
    active_emergency: true,
    session: {
      id: session.sessionId,
      hospital_id: session.hospitalId,
      hospital_name: session.hospitalName,
      symptoms: session.symptoms,
      activated_at: session.activatedAt.toISOString(),
      elapsed_minutes: elapsedMinutes,
      original_eta: session.etaMinutes,
      remaining_eta: remainingEta,
      guardians_notified: session.guardiansNotified
    },
    realtime_bed_status: bedInfo ? {
      emergency_beds: bedInfo.hvec || 0,
      operation_beds: bedInfo.hvoc || 0,
      general_beds: bedInfo.hvgc || 0,
      icu_beds: bedInfo.hvicc || 0,
      last_updated: new Date().toISOString()
    } : {
      message: '병상 정보를 가져올 수 없습니다.'
    },
    actions: {
      cancel: '세션을 취소하려면 새로운 검색을 시작하세요.',
      change_hospital: 'lifeguard_search_emergency로 다른 병원을 검색할 수 있습니다.'
    }
  };
}

async function handleFindPharmacy(args: {
  latitude: number;
  longitude: number;
  filter?: string;
  radius_km?: number;
}): Promise<unknown> {
  const { latitude, longitude, filter = 'all', radius_km = 3 } = args;

  const pharmacies = await fetchPharmacies(latitude, longitude, radius_km);

  if (pharmacies.length === 0) {
    return {
      success: false,
      message: `반경 ${radius_km}km 내 약국을 찾을 수 없습니다.`,
      suggestions: ['검색 반경을 늘려보세요.']
    };
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0=일, 1=월, ...
  const currentTime = now.getHours() * 100 + now.getMinutes(); // HHMM 형식

  // 필터링
  let filteredPharmacies = pharmacies;

  if (filter === 'night') {
    // 야간 운영 (20시 이후 영업)
    filteredPharmacies = pharmacies.filter(p => {
      const dayKey = `dutyTime${currentDay === 0 ? 7 : currentDay}c` as keyof Pharmacy;
      const closeTime = parseInt(p[dayKey] as string || '0');
      return closeTime >= 2200 || closeTime <= 200; // 22시 이후 또는 새벽 2시까지
    });
  } else if (filter === 'holiday') {
    // 휴일(일요일/공휴일) 운영
    filteredPharmacies = pharmacies.filter(p => {
      return p.dutyTime7s || p.dutyTime8s; // 일요일 또는 공휴일 시작시간이 있는 경우
    });
  }

  const results = filteredPharmacies.slice(0, 10).map((p, idx) => {
    const dayKey = currentDay === 0 ? 7 : currentDay;
    const openKey = `dutyTime${dayKey}s` as keyof Pharmacy;
    const closeKey = `dutyTime${dayKey}c` as keyof Pharmacy;

    return {
      rank: idx + 1,
      name: p.dutyName,
      address: p.dutyAddr,
      tel: p.dutyTel1,
      distance_km: Math.round((p.distance || 0) * 100) / 100,
      today_hours: {
        open: p[openKey] || '정보없음',
        close: p[closeKey] || '정보없음'
      },
      coordinates: {
        latitude: p.wgs84Lat,
        longitude: p.wgs84Lon
      }
    };
  });

  return {
    success: true,
    search_info: {
      location: { latitude, longitude },
      filter,
      radius_km,
      total_found: filteredPharmacies.length,
      timestamp: new Date().toISOString()
    },
    pharmacies: results
  };
}

// ============================================================================
// MCP Request Handler
// ============================================================================

interface MCPRequest {
  jsonrpc: string;
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

function handleMCPRequest(request: MCPRequest): unknown {
  const { method, params, id } = request;
  const protocolVersion = (params?.protocolVersion as string) || '2024-11-05';

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion,
          serverInfo: {
            name: 'k-lifeguard-mcp',
            version: '1.0.0',
            description: 'K-LifeGuard: 지능형 응급 의료 코디네이터'
          },
          capabilities: {
            tools: { listChanged: false },
          },
        },
      };

    case 'notifications/initialized':
      return { jsonrpc: '2.0', id, result: {} };

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      };

    case 'tools/call':
      return null; // 비동기 처리 필요

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      };
  }
}

async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  id: number | string | undefined
): Promise<unknown> {
  try {
    let result: unknown;

    switch (toolName) {
      case 'lifeguard_search_emergency':
        result = await handleSearchEmergency(args as Parameters<typeof handleSearchEmergency>[0]);
        break;
      case 'lifeguard_activate_emergency':
        result = await handleActivateEmergency(args as Parameters<typeof handleActivateEmergency>[0]);
        break;
      case 'lifeguard_get_status':
        result = await handleGetStatus(args as Parameters<typeof handleGetStatus>[0]);
        break;
      case 'lifeguard_find_pharmacy':
        result = await handleFindPharmacy(args as Parameters<typeof handleFindPharmacy>[0]);
        break;
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: `Unknown tool: ${toolName}`,
          },
        };
    }

    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      },
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    };
  }
}

// ============================================================================
// Landing Page HTML
// ============================================================================

const LANDING_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K-LifeGuard MCP Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #fff;
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 50px;
    }
    .logo {
      font-size: 64px;
      margin-bottom: 20px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    h1 {
      font-size: 2.5rem;
      background: linear-gradient(90deg, #e94560, #ff6b6b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    .subtitle {
      color: #a0a0a0;
      font-size: 1.1rem;
    }
    .badge {
      display: inline-block;
      background: rgba(233, 69, 96, 0.2);
      color: #e94560;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 0.9rem;
      margin-top: 15px;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .feature {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 25px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: transform 0.3s, border-color 0.3s;
    }
    .feature:hover {
      transform: translateY(-5px);
      border-color: #e94560;
    }
    .feature-icon { font-size: 2rem; margin-bottom: 15px; }
    .feature h3 { color: #fff; margin-bottom: 10px; }
    .feature p { color: #a0a0a0; font-size: 0.9rem; line-height: 1.6; }
    .tools {
      background: rgba(255, 255, 255, 0.03);
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 40px;
    }
    .tools h2 {
      color: #e94560;
      margin-bottom: 20px;
      font-size: 1.5rem;
    }
    .tool {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 15px;
      border-left: 3px solid #e94560;
    }
    .tool:last-child { margin-bottom: 0; }
    .tool-name {
      font-family: 'Courier New', monospace;
      color: #4ade80;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .tool-desc { color: #d0d0d0; font-size: 0.9rem; }
    .footer {
      text-align: center;
      color: #666;
      font-size: 0.85rem;
      padding-top: 30px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    .footer a { color: #e94560; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="logo">🚑</div>
      <h1>K-LifeGuard</h1>
      <p class="subtitle">지능형 응급 의료 코디네이터 MCP Server</p>
      <span class="badge">MCP Protocol v2024-11-05</span>
    </header>

    <section class="features">
      <div class="feature">
        <div class="feature-icon">🏥</div>
        <h3>스마트 병원 추천</h3>
        <p>증상 분석 → 병상 가용성, 거리, 실시간 교통, 전문성을 복합 스코어링하여 최적의 병원 추천</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🗺️</div>
        <h3>카카오내비 연동</h3>
        <p>카카오 모빌리티 API로 실시간 ETA 계산, 최적 경로 안내</p>
      </div>
      <div class="feature">
        <div class="feature-icon">📱</div>
        <h3>보호자 알림</h3>
        <p>응급 상황 발생 시 카카오톡으로 보호자에게 위치 및 상황 자동 알림</p>
      </div>
      <div class="feature">
        <div class="feature-icon">💊</div>
        <h3>약국 검색</h3>
        <p>야간/휴일 운영 약국 필터링 및 실시간 영업 정보 제공</p>
      </div>
    </section>

    <section class="tools">
      <h2>MCP Tools</h2>
      <div class="tool">
        <div class="tool-name">lifeguard_search_emergency</div>
        <div class="tool-desc">증상과 위치 기반 최적 응급의료기관 추천 (병상×거리×교통×전문성 스코어링)</div>
      </div>
      <div class="tool">
        <div class="tool-name">lifeguard_activate_emergency</div>
        <div class="tool-desc">응급 모드 활성화, 보호자 카카오톡 알림, 병상 모니터링 시작</div>
      </div>
      <div class="tool">
        <div class="tool-name">lifeguard_get_status</div>
        <div class="tool-desc">현재 응급 모드 상태 및 목적지 병원 실시간 병상 조회</div>
      </div>
      <div class="tool">
        <div class="tool-name">lifeguard_find_pharmacy</div>
        <div class="tool-desc">주변 약국 검색 (야간/휴일 운영 필터)</div>
      </div>
    </section>

    <footer class="footer">
      <p>Data Sources: 공공데이터포털 (NEMC), 카카오 모빌리티</p>
      <p style="margin-top: 10px;">
        <a href="https://github.com/yonghwan1106" target="_blank">GitHub</a>
      </p>
    </footer>
  </div>
</body>
</html>`;

// ============================================================================
// Vercel Handler
// ============================================================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse | void> {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, x-session-id, Accept');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;

  // GET / → 랜딩 페이지
  if (req.method === 'GET' && (path === '/' || path === '')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(LANDING_HTML);
  }

  // GET /health 또는 /mcp → JSON 상태
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      name: 'k-lifeguard-mcp',
      version: '1.0.0',
      description: 'K-LifeGuard: 지능형 응급 의료 코디네이터',
      tools: TOOLS.map(t => t.name),
    });
  }

  // DELETE → 세션 종료
  if (req.method === 'DELETE') {
    return res.status(200).json({ success: true, message: 'Session closed' });
  }

  // POST → MCP 요청 처리
  if (req.method === 'POST') {
    try {
      const mcpReq = req.body as MCPRequest;

      if (!mcpReq || !mcpReq.jsonrpc || !mcpReq.method) {
        return res.status(400).json({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32600, message: 'Invalid Request' },
        });
      }

      // tools/call은 비동기 처리
      if (mcpReq.method === 'tools/call') {
        const toolName = (mcpReq.params?.name as string) || '';
        const toolArgs = (mcpReq.params?.arguments as Record<string, unknown>) || {};
        const result = await handleToolCall(toolName, toolArgs, mcpReq.id);
        return res.status(200).json(result);
      }

      // 다른 MCP 메서드
      const response = handleMCPRequest(mcpReq);
      return res.status(200).json(response);
    } catch (error) {
      return res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
