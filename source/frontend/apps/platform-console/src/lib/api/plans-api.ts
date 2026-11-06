import { apiRequest } from './client'
import {
  PLANS_ENDPOINTS,
  type CommercialPlanDetailDto,
  type CommercialPlanListItemDto,
  type CommercialPlanMutationResult,
  type PlanChangeLogDto,
  type PlatformPagedResult,
  type SetDefaultPlanRequest,
  type UpdatePlanCapsRequest,
  type UpdatePlanFeaturesRequest,
  type UpdatePlanMetadataRequest,
  type UpdatePlanPricingRequest,
  type UpdatePlanSalesStatusRequest,
} from './types'

export function fetchCommercialPlans() {
  return apiRequest<CommercialPlanListItemDto[]>({
    method: 'GET',
    url: PLANS_ENDPOINTS.list,
  })
}

export function fetchCommercialPlan(tier: string) {
  return apiRequest<CommercialPlanDetailDto>({
    method: 'GET',
    url: PLANS_ENDPOINTS.detail(tier),
  })
}

export function fetchPlanHistory(tier: string, page = 1, pageSize = 20) {
  return apiRequest<PlatformPagedResult<PlanChangeLogDto>>({
    method: 'GET',
    url: PLANS_ENDPOINTS.history(tier),
    params: { page, pageSize },
  })
}

export function updatePlanMetadata(tier: string, body: UpdatePlanMetadataRequest) {
  return apiRequest<CommercialPlanMutationResult>({
    method: 'PUT',
    url: PLANS_ENDPOINTS.metadata(tier),
    data: body,
  })
}

export function updatePlanPricing(tier: string, body: UpdatePlanPricingRequest) {
  return apiRequest<CommercialPlanMutationResult>({
    method: 'PUT',
    url: PLANS_ENDPOINTS.pricing(tier),
    data: body,
  })
}

export function updatePlanCaps(tier: string, body: UpdatePlanCapsRequest) {
  return apiRequest<CommercialPlanMutationResult>({
    method: 'PUT',
    url: PLANS_ENDPOINTS.caps(tier),
    data: body,
  })
}

export function updatePlanFeatures(tier: string, body: UpdatePlanFeaturesRequest) {
  return apiRequest<CommercialPlanMutationResult>({
    method: 'PUT',
    url: PLANS_ENDPOINTS.features(tier),
    data: body,
  })
}

export function updatePlanSalesStatus(tier: string, body: UpdatePlanSalesStatusRequest) {
  return apiRequest<CommercialPlanMutationResult>({
    method: 'POST',
    url: PLANS_ENDPOINTS.salesStatus(tier),
    data: body,
  })
}

export function setDefaultPlan(tier: string, body: SetDefaultPlanRequest) {
  return apiRequest<CommercialPlanMutationResult>({
    method: 'POST',
    url: PLANS_ENDPOINTS.setDefault(tier),
    data: body,
  })
}
