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
  <title>K-LifeGuard | 지능형 응급 의료 코디네이터</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@300;400;500;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <style>
    :root {
      --emergency-red: #DC2626;
      --emergency-glow: #EF4444;
      --pulse-red: #F87171;
      --dark-bg: #0A0A0F;
      --dark-surface: #111118;
      --dark-card: #18181F;
      --text-primary: #FAFAFA;
      --text-secondary: #A1A1AA;
      --text-muted: #52525B;
      --accent-green: #22C55E;
      --accent-blue: #3B82F6;
      --glass-border: rgba(255, 255, 255, 0.08);
      --glass-bg: rgba(255, 255, 255, 0.03);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    html { scroll-behavior: smooth; }

    body {
      font-family: 'Noto Sans KR', -apple-system, sans-serif;
      background: var(--dark-bg);
      color: var(--text-primary);
      min-height: 100vh;
      overflow-x: hidden;
      line-height: 1.6;
    }

    /* 배경 그리드 패턴 */
    .bg-grid {
      position: fixed;
      inset: 0;
      background-image:
        linear-gradient(rgba(220, 38, 38, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(220, 38, 38, 0.03) 1px, transparent 1px);
      background-size: 50px 50px;
      pointer-events: none;
      z-index: 0;
    }

    /* 상단 응급 글로우 */
    .emergency-glow {
      position: fixed;
      top: -200px;
      left: 50%;
      transform: translateX(-50%);
      width: 800px;
      height: 400px;
      background: radial-gradient(ellipse, rgba(220, 38, 38, 0.15) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
      animation: glowPulse 4s ease-in-out infinite;
    }

    @keyframes glowPulse {
      0%, 100% { opacity: 0.5; transform: translateX(-50%) scale(1); }
      50% { opacity: 1; transform: translateX(-50%) scale(1.1); }
    }

    /* 컨테이너 */
    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 0 24px;
      position: relative;
      z-index: 1;
    }

    /* 네비게이션 바 */
    .nav {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      padding: 16px 24px;
      background: rgba(10, 10, 15, 0.8);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--glass-border);
    }

    .nav-inner {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .nav-logo {
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: 'Black Han Sans', sans-serif;
      font-size: 1.25rem;
      color: var(--text-primary);
      text-decoration: none;
    }

    .nav-logo-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--emergency-red), var(--pulse-red));
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 0 0 20px rgba(220, 38, 38, 0.4);
      animation: iconPulse 2s ease-in-out infinite;
    }

    @keyframes iconPulse {
      0%, 100% { box-shadow: 0 0 20px rgba(220, 38, 38, 0.4); }
      50% { box-shadow: 0 0 30px rgba(220, 38, 38, 0.6); }
    }

    .nav-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
      color: var(--accent-green);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background: var(--accent-green);
      border-radius: 50%;
      animation: statusBlink 2s ease-in-out infinite;
    }

    @keyframes statusBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* 히어로 섹션 */
    .hero {
      padding: 160px 0 100px;
      text-align: center;
      position: relative;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      padding: 8px 16px;
      border-radius: 100px;
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-bottom: 32px;
      animation: fadeInUp 0.8s ease-out;
    }

    .hero-badge-dot {
      width: 6px;
      height: 6px;
      background: var(--emergency-red);
      border-radius: 50%;
    }

    .hero-title {
      font-family: 'Black Han Sans', sans-serif;
      font-size: clamp(3rem, 8vw, 5.5rem);
      font-weight: 400;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
      animation: fadeInUp 0.8s ease-out 0.1s both;
    }

    .hero-title-gradient {
      background: linear-gradient(135deg, var(--text-primary) 0%, var(--emergency-red) 50%, var(--pulse-red) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .hero-subtitle {
      font-size: 1.25rem;
      color: var(--text-secondary);
      font-weight: 300;
      margin-bottom: 48px;
      animation: fadeInUp 0.8s ease-out 0.2s both;
    }

    /* ECG 심전도 라인 */
    .ecg-container {
      width: 100%;
      max-width: 600px;
      height: 80px;
      margin: 0 auto 48px;
      position: relative;
      overflow: hidden;
      animation: fadeInUp 0.8s ease-out 0.3s both;
    }

    .ecg-line {
      position: absolute;
      width: 200%;
      height: 100%;
      animation: ecgScroll 3s linear infinite;
    }

    @keyframes ecgScroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    .ecg-svg {
      width: 100%;
      height: 100%;
    }

    .ecg-path {
      fill: none;
      stroke: var(--emergency-red);
      stroke-width: 2;
      filter: drop-shadow(0 0 8px rgba(220, 38, 38, 0.6));
    }

    /* 스탯 카드 */
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      max-width: 600px;
      margin: 0 auto;
      animation: fadeInUp 0.8s ease-out 0.4s both;
    }

    .stat {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      padding: 20px;
      text-align: center;
      transition: all 0.3s ease;
    }

    .stat:hover {
      background: rgba(220, 38, 38, 0.05);
      border-color: rgba(220, 38, 38, 0.3);
      transform: translateY(-2px);
    }

    .stat-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.75rem;
      font-weight: 500;
      color: var(--emergency-red);
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* 피처 섹션 */
    .features {
      padding: 80px 0;
    }

    .section-header {
      text-align: center;
      margin-bottom: 60px;
    }

    .section-tag {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--emergency-red);
      margin-bottom: 16px;
    }

    .section-title {
      font-family: 'Black Han Sans', sans-serif;
      font-size: 2.5rem;
      font-weight: 400;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }

    @media (max-width: 768px) {
      .features-grid { grid-template-columns: 1fr; }
      .stats { grid-template-columns: 1fr; }
    }

    .feature-card {
      background: var(--dark-card);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      padding: 32px;
      position: relative;
      overflow: hidden;
      transition: all 0.4s ease;
    }

    .feature-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--emergency-red), transparent);
      opacity: 0;
      transition: opacity 0.4s ease;
    }

    .feature-card:hover {
      border-color: rgba(220, 38, 38, 0.3);
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }

    .feature-card:hover::before {
      opacity: 1;
    }

    .feature-icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(220, 38, 38, 0.05));
      border: 1px solid rgba(220, 38, 38, 0.2);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-bottom: 20px;
    }

    .feature-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 12px;
    }

    .feature-desc {
      color: var(--text-secondary);
      font-size: 0.9rem;
      line-height: 1.7;
    }

    /* 스코어링 섹션 */
    .scoring {
      padding: 80px 0;
    }

    .scoring-card {
      background: linear-gradient(135deg, var(--dark-card), var(--dark-surface));
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      padding: 48px;
      position: relative;
      overflow: hidden;
    }

    .scoring-card::after {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(220, 38, 38, 0.08) 0%, transparent 70%);
      pointer-events: none;
    }

    .scoring-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 32px;
    }

    .scoring-icon {
      width: 48px;
      height: 48px;
      background: var(--emergency-red);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }

    .scoring-title {
      font-family: 'Black Han Sans', sans-serif;
      font-size: 1.5rem;
    }

    .formula-box {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 32px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      color: var(--accent-green);
      text-align: center;
      letter-spacing: 0.02em;
    }

    .weights-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    @media (max-width: 768px) {
      .weights-grid { grid-template-columns: repeat(2, 1fr); }
    }

    .weight-item {
      text-align: center;
      padding: 20px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      border: 1px solid var(--glass-border);
    }

    .weight-bar {
      width: 100%;
      height: 4px;
      background: var(--dark-bg);
      border-radius: 2px;
      margin-bottom: 12px;
      overflow: hidden;
    }

    .weight-fill {
      height: 100%;
      background: var(--emergency-red);
      border-radius: 2px;
      transition: width 1s ease-out;
    }

    .weight-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.5rem;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .weight-label {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    /* 도구 섹션 */
    .tools {
      padding: 80px 0;
    }

    .tools-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .tool-item {
      background: var(--dark-card);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      padding: 24px 28px;
      display: flex;
      align-items: center;
      gap: 20px;
      transition: all 0.3s ease;
      cursor: default;
    }

    .tool-item:hover {
      border-color: var(--emergency-red);
      background: rgba(220, 38, 38, 0.03);
    }

    .tool-number {
      width: 32px;
      height: 32px;
      background: rgba(220, 38, 38, 0.1);
      border: 1px solid rgba(220, 38, 38, 0.3);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: var(--emergency-red);
      flex-shrink: 0;
    }

    .tool-content {
      flex: 1;
    }

    .tool-name {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.95rem;
      color: var(--accent-green);
      margin-bottom: 6px;
    }

    .tool-desc {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .tool-arrow {
      color: var(--text-muted);
      transition: transform 0.3s ease;
    }

    .tool-item:hover .tool-arrow {
      transform: translateX(4px);
      color: var(--emergency-red);
    }

    /* 푸터 */
    .footer {
      padding: 60px 0 40px;
      border-top: 1px solid var(--glass-border);
      text-align: center;
    }

    .footer-brand {
      font-family: 'Black Han Sans', sans-serif;
      font-size: 1.5rem;
      margin-bottom: 16px;
      color: var(--text-primary);
    }

    .footer-sources {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 24px;
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 24px;
    }

    .footer-link {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.85rem;
      transition: color 0.3s ease;
    }

    .footer-link:hover {
      color: var(--emergency-red);
    }

    .footer-copy {
      margin-top: 32px;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="emergency-glow"></div>

  <!-- 네비게이션 -->
  <nav class="nav">
    <div class="nav-inner">
      <a href="/" class="nav-logo">
        <div class="nav-logo-icon">+</div>
        <span>K-LifeGuard</span>
      </a>
      <div class="nav-status">
        <div class="status-dot"></div>
        <span>서버 정상 운영 중</span>
      </div>
    </div>
  </nav>

  <!-- 히어로 -->
  <section class="hero">
    <div class="container">
      <div class="hero-badge">
        <div class="hero-badge-dot"></div>
        <span>MCP Protocol v2024-11-05</span>
      </div>

      <h1 class="hero-title">
        <span class="hero-title-gradient">K-LifeGuard</span>
      </h1>
      <p class="hero-subtitle">지능형 응급 의료 코디네이터 MCP Server</p>

      <!-- ECG 심전도 -->
      <div class="ecg-container">
        <div class="ecg-line">
          <svg class="ecg-svg" viewBox="0 0 1200 80" preserveAspectRatio="none">
            <path class="ecg-path" d="M0,40 L50,40 L60,40 L70,35 L80,45 L90,40 L150,40 L160,40 L170,20 L180,70 L190,10 L200,60 L210,40 L270,40 L280,40 L290,35 L300,45 L310,40 L370,40 L380,40 L390,20 L400,70 L410,10 L420,60 L430,40 L490,40 L500,40 L510,35 L520,45 L530,40 L600,40 L610,40 L620,35 L630,45 L640,40 L700,40 L710,40 L720,20 L730,70 L740,10 L750,60 L760,40 L820,40 L830,40 L840,35 L850,45 L860,40 L920,40 L930,40 L940,20 L950,70 L960,10 L970,60 L980,40 L1040,40 L1050,40 L1060,35 L1070,45 L1080,40 L1140,40 L1150,40 L1160,20 L1170,70 L1180,10 L1190,60 L1200,40" />
          </svg>
        </div>
      </div>

      <!-- 스탯 -->
      <div class="stats">
        <div class="stat">
          <div class="stat-value">4</div>
          <div class="stat-label">MCP Tools</div>
        </div>
        <div class="stat">
          <div class="stat-value">&lt;3s</div>
          <div class="stat-label">Response</div>
        </div>
        <div class="stat">
          <div class="stat-value">24/7</div>
          <div class="stat-label">Available</div>
        </div>
      </div>
    </div>
  </section>

  <!-- 피처 -->
  <section class="features">
    <div class="container">
      <div class="section-header">
        <div class="section-tag">Core Features</div>
        <h2 class="section-title">응급 상황의 모든 것을 연결합니다</h2>
      </div>

      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">🏥</div>
          <h3 class="feature-title">스마트 병원 추천</h3>
          <p class="feature-desc">증상 분석 후 병상 가용성, 거리, 실시간 교통, 전문 장비를 복합 스코어링하여 최적의 응급의료기관을 추천합니다.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🗺️</div>
          <h3 class="feature-title">카카오내비 연동</h3>
          <p class="feature-desc">카카오 모빌리티 API를 통해 실시간 교통 상황을 반영한 정확한 도착 예정 시간(ETA)을 계산합니다.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">📱</div>
          <h3 class="feature-title">보호자 자동 알림</h3>
          <p class="feature-desc">응급 상황 발생 시 카카오톡을 통해 보호자에게 환자 위치와 이동 중인 병원 정보를 자동으로 전달합니다.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">💊</div>
          <h3 class="feature-title">약국 검색</h3>
          <p class="feature-desc">현재 시간 기준 영업 중인 약국, 야간 운영 약국, 휴일 운영 약국을 필터링하여 검색할 수 있습니다.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- 스코어링 알고리즘 -->
  <section class="scoring">
    <div class="container">
      <div class="scoring-card">
        <div class="scoring-header">
          <div class="scoring-icon">⚡</div>
          <h3 class="scoring-title">복합 스코어링 알고리즘</h3>
        </div>

        <div class="formula-box">
          Score = (병상 × 0.4) + (거리 × 0.3) + (교통 × 0.2) + (전문성 × 0.1)
        </div>

        <div class="weights-grid">
          <div class="weight-item">
            <div class="weight-bar"><div class="weight-fill" style="width: 40%"></div></div>
            <div class="weight-value">40%</div>
            <div class="weight-label">병상 가용성</div>
          </div>
          <div class="weight-item">
            <div class="weight-bar"><div class="weight-fill" style="width: 30%"></div></div>
            <div class="weight-value">30%</div>
            <div class="weight-label">거리</div>
          </div>
          <div class="weight-item">
            <div class="weight-bar"><div class="weight-fill" style="width: 20%"></div></div>
            <div class="weight-value">20%</div>
            <div class="weight-label">실시간 교통</div>
          </div>
          <div class="weight-item">
            <div class="weight-bar"><div class="weight-fill" style="width: 10%"></div></div>
            <div class="weight-value">10%</div>
            <div class="weight-label">전문 장비</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- MCP 도구 -->
  <section class="tools">
    <div class="container">
      <div class="section-header">
        <div class="section-tag">MCP Tools</div>
        <h2 class="section-title">사용 가능한 도구</h2>
      </div>

      <div class="tools-list">
        <div class="tool-item">
          <div class="tool-number">01</div>
          <div class="tool-content">
            <div class="tool-name">lifeguard_search_emergency</div>
            <div class="tool-desc">증상과 위치 기반 최적 응급의료기관 추천 (복합 스코어링)</div>
          </div>
          <div class="tool-arrow">→</div>
        </div>

        <div class="tool-item">
          <div class="tool-number">02</div>
          <div class="tool-content">
            <div class="tool-name">lifeguard_activate_emergency</div>
            <div class="tool-desc">응급 모드 활성화, 보호자 카카오톡 알림, 병상 모니터링 시작</div>
          </div>
          <div class="tool-arrow">→</div>
        </div>

        <div class="tool-item">
          <div class="tool-number">03</div>
          <div class="tool-content">
            <div class="tool-name">lifeguard_get_status</div>
            <div class="tool-desc">현재 응급 모드 상태 및 목적지 병원 실시간 병상 조회</div>
          </div>
          <div class="tool-arrow">→</div>
        </div>

        <div class="tool-item">
          <div class="tool-number">04</div>
          <div class="tool-content">
            <div class="tool-name">lifeguard_find_pharmacy</div>
            <div class="tool-desc">주변 약국 검색 (야간/휴일 운영 필터)</div>
          </div>
          <div class="tool-arrow">→</div>
        </div>
      </div>
    </div>
  </section>

  <!-- 푸터 -->
  <footer class="footer">
    <div class="container">
      <div class="footer-brand">K-LifeGuard</div>
      <p class="footer-sources">Data: 공공데이터포털 (NEMC) · 카카오 모빌리티</p>
      <div class="footer-links">
        <a href="https://github.com/yonghwan1106/k-lifeguard-mcp" target="_blank" class="footer-link">GitHub</a>
        <a href="/mcp" class="footer-link">API Health</a>
      </div>
      <p class="footer-copy">© 2025 K-LifeGuard. Built for emergencies.</p>
    </div>
  </footer>
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
