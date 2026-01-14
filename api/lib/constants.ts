/**
 * K-LifeGuard MCP Server - Constants
 */

import type { SymptomMapping, MCPTool } from './types';

export const DATA_GO_KR_API_KEY = process.env.DATA_GO_KR_API_KEY || '';
export const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || '';

export const NEMC_BASE_URL = 'http://apis.data.go.kr/B552657';
export const KAKAO_NAVI_BASE_URL = 'https://apis-navi.kakaomobility.com/v1';

export const API_TIMEOUT = 10000;

// 시도 코드 매핑
export const SIDO_CODES: Record<string, string> = {
  '서울': '11', '부산': '21', '대구': '22', '인천': '23',
  '광주': '24', '대전': '25', '울산': '26', '세종': '29',
  '경기': '31', '강원': '32', '충북': '33', '충남': '34',
  '전북': '35', '전남': '36', '경북': '37', '경남': '38', '제주': '39'
};

// 증상-진료과 매핑
export const SYMPTOM_MAPPINGS: SymptomMapping[] = [
  {
    keywords: ['가슴통증', '가슴', '심장', '흉통', '심근경색', '협심증'],
    departments: ['심장내과', '응급의학과', '순환기내과'],
    equipment: ['hvangioayn']
  },
  {
    keywords: ['뇌졸중', '마비', '어지러움', '두통', '뇌출혈', '뇌경색'],
    departments: ['신경외과', '신경과'],
    equipment: ['hvctayn', 'hvmriayn']
  },
  {
    keywords: ['소아', '아이', '어린이', '아기', '신생아', '소아고열'],
    departments: ['소아청소년과', '소아외과'],
    equipment: []
  },
  {
    keywords: ['골절', '외상', '사고', '교통사고', '다발성외상'],
    departments: ['정형외과', '외과', '응급의학과'],
    equipment: ['hvventiayn']
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

// 스코어링 가중치
export const SCORING_WEIGHTS = {
  BED: 0.4,
  DISTANCE: 0.3,
  TRAFFIC: 0.2,
  SPECIALTY: 0.1
};

// MCP 도구 정의
export const TOOLS: MCPTool[] = [
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
