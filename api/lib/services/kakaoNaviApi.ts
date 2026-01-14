/**
 * K-LifeGuard MCP Server - Kakao Navi API Service
 * 카카오 모빌리티 내비게이션 API 클라이언트
 */

import type { Hospital, KakaoNaviResponse } from '../types';
import { KAKAO_REST_API_KEY, KAKAO_NAVI_BASE_URL } from '../constants';

// ============================================================================
// ETA 조회
// ============================================================================

export async function fetchKakaoNaviETA(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): Promise<number | null> {
  if (!KAKAO_REST_API_KEY) {
    return null;
  }

  const url = `${KAKAO_NAVI_BASE_URL}/directions?origin=${originLon},${originLat}&destination=${destLon},${destLat}&priority=RECOMMEND`;

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

// ============================================================================
// 병원 목록 ETA 일괄 조회
// ============================================================================

export async function fetchETAForHospitals(
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
// 카카오 내비 딥링크 생성
// ============================================================================

export function generateKakaoNaviDeepLink(
  userLatitude: number,
  userLongitude: number,
  destLatitude?: number,
  destLongitude?: number,
  destName?: string
): string {
  let link = `kakaomap://route?sp=${userLatitude},${userLongitude}&by=CAR`;

  if (destLatitude && destLongitude) {
    link += `&ep=${destLatitude},${destLongitude}`;
    if (destName) {
      link += `&ep_name=${encodeURIComponent(destName)}`;
    }
  }

  return link;
}
