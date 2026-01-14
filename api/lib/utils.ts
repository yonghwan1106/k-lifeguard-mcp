/**
 * K-LifeGuard MCP Server - Utility Functions
 */

import { SYMPTOM_MAPPINGS, SCORING_WEIGHTS } from './constants';
import type { Hospital, SymptomMapping } from './types';

// ============================================================================
// XML Parsing
// ============================================================================

export function extractXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

export function extractXmlValueWithCDATA(xml: string, tag: string): string | null {
  const cdataRegex = new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]*?)\\]\\]></${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();
  return extractXmlValue(xml, tag);
}

export function extractAllItems(xml: string): string[] {
  const items: string[] = [];
  const regex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    items.push(match[1]);
  }
  return items;
}

// ============================================================================
// Distance & Coordinates
// ============================================================================

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getSidoCodeFromCoords(latitude: number, longitude: number): string | null {
  if (latitude >= 37.4 && latitude <= 37.7 && longitude >= 126.7 && longitude <= 127.2) return '11';
  if (latitude >= 37.2 && latitude <= 37.7 && longitude >= 126.6 && longitude <= 127.5) return '31';
  if (latitude >= 35.0 && latitude <= 35.3 && longitude >= 128.8 && longitude <= 129.3) return '21';
  if (latitude >= 35.7 && latitude <= 36.0 && longitude >= 128.4 && longitude <= 128.8) return '22';
  if (latitude >= 37.3 && latitude <= 37.6 && longitude >= 126.5 && longitude <= 126.8) return '23';
  if (latitude >= 36.2 && latitude <= 36.5 && longitude >= 127.2 && longitude <= 127.5) return '25';
  return null;
}

// ============================================================================
// Symptom Analysis
// ============================================================================

export function getSymptomMapping(symptoms: string): SymptomMapping | null {
  const lowered = symptoms.toLowerCase();
  for (const mapping of SYMPTOM_MAPPINGS) {
    if (mapping.keywords.some(k => lowered.includes(k))) {
      return mapping;
    }
  }
  return null;
}

export function getEquipmentName(code: string): string {
  const names: Record<string, string> = {
    hvctayn: 'CT',
    hvmriayn: 'MRI',
    hvangioayn: '심혈관조영실',
    hvventiayn: '인공호흡기'
  };
  return names[code] || code;
}

// ============================================================================
// Hospital Scoring
// ============================================================================

export function calculateHospitalScore(
  hospital: Hospital,
  etaMinutes: number | null,
  symptomMapping: SymptomMapping | null
): { score: number; breakdown: Hospital['scoreBreakdown'] } {
  const availableBeds = (hospital.hvec || 0) + (hospital.hvoc || 0) + (hospital.hvgc || 0);
  const bedScore = Math.min(availableBeds * 10, 100);
  const distanceScore = Math.max(100 - (hospital.distance || 0) * 5, 0);
  const trafficScore = etaMinutes !== null ? Math.max(100 - etaMinutes * 1.67, 0) : 50;

  let specialtyScore = 50;
  if (symptomMapping) {
    const hasEquipment = symptomMapping.equipment.length === 0 ||
      symptomMapping.equipment.some(eq => {
        const value = hospital[eq as keyof Hospital];
        return value === 'Y' || value === 'y';
      });
    if (hasEquipment) specialtyScore = 100;
  }

  const totalScore =
    (bedScore * SCORING_WEIGHTS.BED) +
    (distanceScore * SCORING_WEIGHTS.DISTANCE) +
    (trafficScore * SCORING_WEIGHTS.TRAFFIC) +
    (specialtyScore * SCORING_WEIGHTS.SPECIALTY);

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
// Formatting
// ============================================================================

export function roundToDecimal(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function formatTime(time: string | undefined): string {
  if (!time) return '정보없음';
  if (time.length === 4) {
    return `${time.slice(0, 2)}:${time.slice(2, 4)}`;
  }
  return time;
}
