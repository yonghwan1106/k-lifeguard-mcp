/**
 * K-LifeGuard MCP Server - Find Pharmacy Tool
 * 약국 검색 도구
 */

import type { Pharmacy, PharmacyResult } from '../types';
import { fetchPharmacies } from '../services/nemcApi';
import { formatTime } from '../utils';

export interface FindPharmacyInput {
  latitude: number;
  longitude: number;
  filter?: 'all' | 'night' | 'holiday';
  radius_km?: number;
}

export interface FindPharmacyResult {
  success: boolean;
  message?: string;
  suggestions?: string[];
  search_info?: {
    location: { latitude: number; longitude: number };
    filter: string;
    radius_km: number;
    total_found: number;
    timestamp: string;
  };
  pharmacies?: PharmacyResult[];
}

export async function handleFindPharmacy(args: FindPharmacyInput): Promise<FindPharmacyResult> {
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

  const results: PharmacyResult[] = filteredPharmacies.slice(0, 10).map((p, idx) => {
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
        open: formatTime(p[openKey] as string | undefined),
        close: formatTime(p[closeKey] as string | undefined)
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
