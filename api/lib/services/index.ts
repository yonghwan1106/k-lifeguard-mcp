/**
 * K-LifeGuard MCP Server - Services Index
 */

export {
  fetchEmergencyHospitals,
  fetchRealTimeBedInfo,
  fetchPharmacies
} from './nemcApi';

export {
  fetchKakaoNaviETA,
  fetchETAForHospitals,
  generateKakaoNaviDeepLink
} from './kakaoNaviApi';

export {
  createSession,
  getSession,
  getLatestSession,
  getSessionByIdOrLatest,
  updateSession,
  markGuardiansNotified,
  deleteSession,
  clearAllSessions,
  getSessionCount,
  getAllActiveSessions
} from './sessionManager';
