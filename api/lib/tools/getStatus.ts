/**
 * K-LifeGuard MCP Server - Get Status Tool
 * 응급 세션 상태 조회 도구
 */

import { getSessionByIdOrLatest } from '../services/sessionManager';
import { fetchRealTimeBedInfo } from '../services/nemcApi';

export interface GetStatusInput {
  session_id?: string;
}

export interface GetStatusResult {
  success: boolean;
  active_emergency: boolean;
  message?: string;
  tip?: string;
  session?: {
    id: string;
    hospital_id: string;
    hospital_name: string;
    symptoms: string;
    activated_at: string;
    elapsed_minutes: number;
    original_eta: number;
    remaining_eta: number;
    guardians_notified: boolean;
  };
  realtime_bed_status?: {
    emergency_beds?: number;
    operation_beds?: number;
    general_beds?: number;
    icu_beds?: number;
    last_updated?: string;
    message?: string;
  };
  actions?: {
    cancel: string;
    change_hospital: string;
  };
}

export async function handleGetStatus(args: GetStatusInput): Promise<GetStatusResult> {
  const { session_id } = args;

  const session = getSessionByIdOrLatest(session_id);

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
