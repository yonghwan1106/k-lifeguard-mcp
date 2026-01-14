/**
 * K-LifeGuard MCP Server - Landing Page HTML
 */

export const LANDING_HTML = `<!DOCTYPE html>
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

    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 0 24px;
      position: relative;
      z-index: 1;
    }

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

  <nav class="nav">
    <div class="nav-inner">
      <a href="/" class="nav-logo">
        <div class="nav-logo-icon">+</div>
        <span>K-LifeGuard</span>
      </a>
      <div class="nav-status">
        <div class="status-dot"></div>
        <span>MCP Server Online</span>
      </div>
    </div>
  </nav>

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

      <div class="ecg-container">
        <div class="ecg-line">
          <svg class="ecg-svg" viewBox="0 0 1200 80" preserveAspectRatio="none">
            <path class="ecg-path" d="M0,40 L50,40 L60,40 L70,35 L80,45 L90,40 L150,40 L160,40 L170,20 L180,70 L190,10 L200,60 L210,40 L270,40 L280,40 L290,35 L300,45 L310,40 L370,40 L380,40 L390,20 L400,70 L410,10 L420,60 L430,40 L490,40 L500,40 L510,35 L520,45 L530,40 L600,40 L610,40 L620,35 L630,45 L640,40 L700,40 L710,40 L720,20 L730,70 L740,10 L750,60 L760,40 L820,40 L830,40 L840,35 L850,45 L860,40 L920,40 L930,40 L940,20 L950,70 L960,10 L970,60 L980,40 L1040,40 L1050,40 L1060,35 L1070,45 L1080,40 L1140,40 L1150,40 L1160,20 L1170,70 L1180,10 L1190,60 L1200,40" />
          </svg>
        </div>
      </div>

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
