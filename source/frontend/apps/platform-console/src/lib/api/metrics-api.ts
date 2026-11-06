import { apiRequest } from './client'
import {
  METRICS_ENDPOINTS,
  type ChurnMetricsDto,
  type ConversionMetricsDto,
  type MrrMovementDto,
  type MrrSnapshotDto,
  type TierDistributionDto,
} from './types'

export function fetchMrr(asOf?: string) {
  return apiRequest<MrrSnapshotDto>({
    method: 'GET',
    url: METRICS_ENDPOINTS.mrr,
    params: asOf ? { asOf } : undefined,
  })
}

export function fetchMrrMovement(from: string, to: string) {
  return apiRequest<MrrMovementDto>({
    method: 'GET',
    url: METRICS_ENDPOINTS.movement,
    params: { from, to },
  })
}

export function fetchChurnMetrics(from: string, to: string) {
  return apiRequest<ChurnMetricsDto>({
    method: 'GET',
    url: METRICS_ENDPOINTS.churn,
    params: { from, to },
  })
}

export function fetchConversionMetrics(from: string, to: string) {
  return apiRequest<ConversionMetricsDto>({
    method: 'GET',
    url: METRICS_ENDPOINTS.conversion,
    params: { from, to },
  })
}

export function fetchTierDistribution(asOf?: string) {
  return apiRequest<TierDistributionDto>({
    method: 'GET',
    url: METRICS_ENDPOINTS.tierDistribution,
    params: asOf ? { asOf } : undefined,
  })
}
