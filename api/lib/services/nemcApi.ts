/**
 * K-LifeGuard MCP Server - NEMC API Service
 * 공공데이터포털 응급의료정보 API 클라이언트
 */

import type { Hospital, Pharmacy } from '../types';
import { DATA_GO_KR_API_KEY, NEMC_BASE_URL, API_TIMEOUT } from '../constants';
import {
  extractXmlValue,
  extractXmlValueWithCDATA,
  extractAllItems,
  calculateDistance,
  getSidoCodeFromCoords
} from '../utils';

// ============================================================================
// 응급의료기관 조회
// ============================================================================

export async function fetchEmergencyHospitals(
  latitude: number,
  longitude: number,
  radiusKm: number = 10
): Promise<Hospital[]> {
  const sidoCode = getSidoCodeFromCoords(latitude, longitude);

  let url = `${NEMC_BASE_URL}/ErmctInfoInqireService/getEgytListInfoInqire?serviceKey=${DATA_GO_KR_API_KEY}&WGS84_LON=${longitude}&WGS84_LAT=${latitude}&numOfRows=50&pageNo=1`;

  if (sidoCode) {
    url += `&STAGE1=${sidoCode}`;
  }

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
      signal: AbortSignal.timeout(API_TIMEOUT)
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

    // 거리 계산
    hospitals.forEach(h => {
      h.distance = calculateDistance(latitude, longitude, h.wgs84Lat, h.wgs84Lon);
    });

    // 반경 필터링 및 정렬
    return hospitals
      .filter(h => (h.distance || 0) <= radiusKm)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  } catch (error) {
    console.error('응급실 목록 조회 실패:', error);
    return [];
  }
}

// ============================================================================
// 실시간 병상 정보 조회
// ============================================================================

export async function fetchRealTimeBedInfo(hpids: string[]): Promise<Map<string, Partial<Hospital>>> {
  const bedInfoMap = new Map<string, Partial<Hospital>>();

  // 배치로 조회 (최대 10개씩)
  const batches: string[][] = [];
  for (let i = 0; i < hpids.length; i += 10) {
    batches.push(hpids.slice(i, i + 10));
  }

  for (const batch of batches) {
    const promises = batch.map(async (hpid) => {
      const url = `${NEMC_BASE_URL}/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${DATA_GO_KR_API_KEY}&HPID=${hpid}&numOfRows=1&pageNo=1`;

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

// ============================================================================
// 약국 조회
// ============================================================================

export async function fetchPharmacies(
  latitude: number,
  longitude: number,
  radiusKm: number = 3
): Promise<Pharmacy[]> {
  const url = `${NEMC_BASE_URL}/ErmctInsttInfoInqireService/getParmacyListInfoInqire?serviceKey=${DATA_GO_KR_API_KEY}&WGS84_LON=${longitude}&WGS84_LAT=${latitude}&numOfRows=50&pageNo=1`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
      signal: AbortSignal.timeout(API_TIMEOUT)
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
      dutyTime5c: extractXmlValue(item, 'dutyTime5c') || undefined,
      dutyTime6s: extractXmlValue(item, 'dutyTime6s') || undefined,
      dutyTime6c: extractXmlValue(item, 'dutyTime6c') || undefined,
      dutyTime7s: extractXmlValue(item, 'dutyTime7s') || undefined,
      dutyTime7c: extractXmlValue(item, 'dutyTime7c') || undefined,
      dutyTime8s: extractXmlValue(item, 'dutyTime8s') || undefined,
      dutyTime8c: extractXmlValue(item, 'dutyTime8c') || undefined
    })).filter(p => p.dutyName && p.wgs84Lat && p.wgs84Lon);

    // 거리 계산
    pharmacies.forEach(p => {
      p.distance = calculateDistance(latitude, longitude, p.wgs84Lat, p.wgs84Lon);
    });

    // 반경 필터링 및 정렬
    return pharmacies
      .filter(p => (p.distance || 0) <= radiusKm)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  } catch (error) {
    console.error('약국 목록 조회 실패:', error);
    return [];
  }
}
