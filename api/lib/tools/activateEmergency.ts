/**
 * K-LifeGuard MCP Server - Activate Emergency Tool
 * 응급 모드 활성화 도구
 */

import { createSession, markGuardiansNotified } from '../services/sessionManager';
import { generateKakaoNaviDeepLink } from '../services/kakaoNaviApi';

export interface ActivateEmergencyInput {
  hospital_id: string;
  hospital_name: string;
  eta_minutes: number;
  user_latitude: number;
  user_longitude: number;
  symptoms: string;
  notify_guardians?: boolean;
}

export interface ActivateEmergencyResult {
  success: boolean;
  session: {
    id: string;
    hospital_id: string;
    hospital_name: string;
    eta_minutes: number;
    activated_at: string;
    status: string;
  };
  navigation: {
    kakao_navi_link: string;
    instruction: string;
  };
  guardian_notification: {
    sent: boolean;
    message: string;
    template: {
      type: string;
      content: string;
    };
  } | null;
  monitoring: {
    bed_check_interval: string;
    message: string;
  };
  emergency_tips: string[];
}

export async function handleActivateEmergency(args: ActivateEmergencyInput): Promise<ActivateEmergencyResult> {
  const {
    hospital_id,
    hospital_name,
    eta_minutes,
    user_latitude,
    user_longitude,
    symptoms,
    notify_guardians = true
  } = args;

  // 세션 생성
  const session = createSession(
    hospital_id,
    hospital_name,
    eta_minutes,
    user_latitude,
    user_longitude,
    symptoms
  );

  // 카카오톡 알림 (실제 구현 시 카카오톡 API 연동 필요)
  let notificationResult = null;
  if (notify_guardians) {
    // 실제로는 카카오톡 메시지 API를 호출
    notificationResult = {
      sent: true,
      message: '보호자 알림이 발송되었습니다. (시뮬레이션)',
      template: {
        type: 'location',
        content: `[응급상황 알림]\n환자가 ${hospital_name}(으)로 이동 중입니다.\n예상 도착: ${eta_minutes}분\n증상: ${symptoms}`
      }
    };
    markGuardiansNotified(session.sessionId);
  }

  // 카카오 내비 딥링크 생성
  const kakaoNaviLink = generateKakaoNaviDeepLink(user_latitude, user_longitude);

  return {
    success: true,
    session: {
      id: session.sessionId,
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
