/**
 * K-LifeGuard MCP Server - Session Manager
 * 응급 세션 관리
 */

import type { EmergencySession } from '../types';

// 인메모리 세션 저장소
const emergencySessions: Map<string, EmergencySession> = new Map();

// ============================================================================
// 세션 생성
// ============================================================================

export function createSession(
  hospitalId: string,
  hospitalName: string,
  etaMinutes: number,
  userLatitude: number,
  userLongitude: number,
  symptoms: string
): EmergencySession {
  const sessionId = `ER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const session: EmergencySession = {
    sessionId,
    hospitalId,
    hospitalName,
    etaMinutes,
    activatedAt: new Date(),
    userLatitude,
    userLongitude,
    symptoms,
    guardiansNotified: false
  };

  emergencySessions.set(sessionId, session);
  return session;
}

// ============================================================================
// 세션 조회
// ============================================================================

export function getSession(sessionId: string): EmergencySession | undefined {
  return emergencySessions.get(sessionId);
}

export function getLatestSession(): EmergencySession | undefined {
  const sessions = Array.from(emergencySessions.values());
  return sessions.sort((a, b) =>
    b.activatedAt.getTime() - a.activatedAt.getTime()
  )[0];
}

export function getSessionByIdOrLatest(sessionId?: string): EmergencySession | undefined {
  if (sessionId) {
    return getSession(sessionId);
  }
  return getLatestSession();
}

// ============================================================================
// 세션 업데이트
// ============================================================================

export function updateSession(
  sessionId: string,
  updates: Partial<EmergencySession>
): EmergencySession | undefined {
  const session = emergencySessions.get(sessionId);
  if (session) {
    Object.assign(session, updates);
    return session;
  }
  return undefined;
}

export function markGuardiansNotified(sessionId: string): void {
  const session = emergencySessions.get(sessionId);
  if (session) {
    session.guardiansNotified = true;
  }
}

// ============================================================================
// 세션 삭제
// ============================================================================

export function deleteSession(sessionId: string): boolean {
  return emergencySessions.delete(sessionId);
}

export function clearAllSessions(): void {
  emergencySessions.clear();
}

// ============================================================================
// 세션 통계
// ============================================================================

export function getSessionCount(): number {
  return emergencySessions.size;
}

export function getAllActiveSessions(): EmergencySession[] {
  return Array.from(emergencySessions.values());
}
