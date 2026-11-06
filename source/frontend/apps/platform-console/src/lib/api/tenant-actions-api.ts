import { apiRequest } from './client'
import {
  SUBSCRIPTION_ENDPOINTS,
  TENANT_ENDPOINTS,
  type CancelSubscriptionRequest,
  type ChangeTierRequest,
  type ConvertTrialRequest,
  type CreateCouponRequest,
  type ExtendTrialRequest,
  type FeatureOverrideDto,
  type ForceReactivateRequest,
  type ForceSuspendRequest,
  type ImpersonateRequest,
  type ImpersonationResponse,
  type PlatformActionResult,
  type RestartPaidRequest,
  type StartTrialRequest,
  type SubscriptionMutationResult,
  type SubscriptionStatusDto,
  type UpsertFeatureOverrideRequest,
} from './types'

export function forceSuspendTenant(tenantId: string, body: ForceSuspendRequest) {
  return apiRequest<SubscriptionStatusDto>({
    method: 'POST',
    url: TENANT_ENDPOINTS.forceSuspend(tenantId),
    data: body,
  })
}

export function forceReactivateTenant(tenantId: string, body: ForceReactivateRequest) {
  return apiRequest<SubscriptionStatusDto>({
    method: 'POST',
    url: TENANT_ENDPOINTS.forceReactivate(tenantId),
    data: body,
  })
}

export function extendTrialTenant(tenantId: string, body: ExtendTrialRequest) {
  return apiRequest<SubscriptionStatusDto>({
    method: 'POST',
    url: TENANT_ENDPOINTS.extendTrial(tenantId),
    data: body,
  })
}

export function applyCoupon(tenantId: string, body: CreateCouponRequest) {
  return apiRequest<PlatformActionResult>({
    method: 'POST',
    url: TENANT_ENDPOINTS.coupon(tenantId),
    data: body,
  })
}

export function upsertFeatureOverride(tenantId: string, body: UpsertFeatureOverrideRequest) {
  return apiRequest<FeatureOverrideDto>({
    method: 'POST',
    url: TENANT_ENDPOINTS.featureOverrides(tenantId),
    data: body,
  })
}

export function deleteFeatureOverride(tenantId: string, overrideId: string) {
  return apiRequest<PlatformActionResult>({
    method: 'DELETE',
    url: TENANT_ENDPOINTS.featureOverride(tenantId, overrideId),
  })
}

export function impersonateTenant(tenantId: string, body: ImpersonateRequest) {
  return apiRequest<ImpersonationResponse>({
    method: 'POST',
    url: TENANT_ENDPOINTS.impersonate(tenantId),
    data: body,
  })
}

/** PlatformAdminOnly on the backend — stricter than the PlatformOpsOrAbove actions above. */
export function changeTenantTier(tenantId: string, body: ChangeTierRequest) {
  return apiRequest<SubscriptionMutationResult>({
    method: 'POST',
    url: SUBSCRIPTION_ENDPOINTS.changeTier(tenantId),
    data: body,
  })
}

/** PlatformAdminOnly on the backend. */
export function cancelTenantSubscription(tenantId: string, body: CancelSubscriptionRequest) {
  return apiRequest<SubscriptionMutationResult>({
    method: 'POST',
    url: SUBSCRIPTION_ENDPOINTS.cancel(tenantId),
    data: body,
  })
}

/** PlatformAdminOnly — clears CancelAtPeriodEnd on a live subscription. */
export function undoCancelTenantSubscription(tenantId: string, body: { reason: string }) {
  return apiRequest<SubscriptionMutationResult>({
    method: 'POST',
    url: SUBSCRIPTION_ENDPOINTS.undoCancel(tenantId),
    data: body,
  })
}

/** PlatformOpsOrAbove — sales-assisted trial → active (no payment collection). */
export function convertTrialTenant(tenantId: string, body: ConvertTrialRequest) {
  return apiRequest<SubscriptionMutationResult>({
    method: 'POST',
    url: SUBSCRIPTION_ENDPOINTS.convertTrial(tenantId),
    data: body,
  })
}

/** PlatformOpsOrAbove — new active subscription after cancel (does not revive cancelled row). */
export function restartPaidTenant(tenantId: string, body: RestartPaidRequest) {
  return apiRequest<SubscriptionMutationResult>({
    method: 'POST',
    url: SUBSCRIPTION_ENDPOINTS.restartPaid(tenantId),
    data: body,
  })
}

/** PlatformOpsOrAbove — start trial on tenant with no live subscription. */
export function startTrialTenant(tenantId: string, body: StartTrialRequest) {
  return apiRequest<SubscriptionStatusDto>({
    method: 'POST',
    url: TENANT_ENDPOINTS.startTrial(tenantId),
    data: body,
  })
}
