import { apiRequest } from './client'
import {
  RISK_QUEUE_ENDPOINTS,
  type AssignRiskQueueRequest,
  type PlatformActionResult,
  type RecordRiskQueueOutcomeRequest,
  type RiskQueueItemDto,
  type RiskQueueOutcomeDto,
} from './types'

export function fetchRiskQueue(band?: string) {
  return apiRequest<RiskQueueItemDto[]>({
    method: 'GET',
    url: RISK_QUEUE_ENDPOINTS.list,
    params: band ? { band } : undefined,
  })
}

export function assignRiskQueue(tenantId: string, body: AssignRiskQueueRequest) {
  return apiRequest<PlatformActionResult>({
    method: 'POST',
    url: RISK_QUEUE_ENDPOINTS.assign(tenantId),
    data: body,
  })
}

export function recordRiskQueueOutcome(tenantId: string, body: RecordRiskQueueOutcomeRequest) {
  return apiRequest<RiskQueueOutcomeDto>({
    method: 'POST',
    url: RISK_QUEUE_ENDPOINTS.outcome(tenantId),
    data: body,
  })
}
