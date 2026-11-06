export { api, apiRequest, apiRaw, setUnauthorizedHandler } from './client'
export { platformLogin, platformMfaSetup } from './auth-api'
export {
  fetchTenants,
  fetchTenantDetail,
  fetchSubscriptionChanges,
  fetchTenantInvoices,
  fetchTenantStatusCounts,
  provisionTenant,
  TENANT_STATUSES,
} from './tenants-api'
export type { TenantStatusCounts } from './tenants-api'
export {
  forceSuspendTenant,
  forceReactivateTenant,
  extendTrialTenant,
  applyCoupon,
  upsertFeatureOverride,
  deleteFeatureOverride,
  impersonateTenant,
  changeTenantTier,
  cancelTenantSubscription,
  undoCancelTenantSubscription,
  convertTrialTenant,
  restartPaidTenant,
  startTrialTenant,
} from './tenant-actions-api'
export { fetchRiskQueue, assignRiskQueue, recordRiskQueueOutcome } from './risk-queue-api'
export {
  fetchMrr,
  fetchMrrMovement,
  fetchChurnMetrics,
  fetchConversionMetrics,
  fetchTierDistribution,
} from './metrics-api'
export { fetchUsageSummary } from './usage-api'
export { fetchAuditLog } from './audit-api'
export { fetchPlatformUsers,
  createPlatformUser,
  disablePlatformUser,
  reactivatePlatformUser,
  changePlatformUserRole,
} from './platform-users-api'
export {
  fetchLocalLicenses,
  fetchLocalLicenseDetail,
  issueLocalLicense,
  suspendLocalLicense,
  revokeLocalLicense,
  reactivateLocalLicense,
  authorizeLocalLicenseTransfer,
} from './local-licenses-api'
export {
  fetchCustomers,
  fetchCustomer,
  fetchCustomerProfile,
  createCustomer,
  updateCustomer,
  initiateOwnerPasswordReset,
  fetchContracts,
  fetchContract,
  createContract,
  changeContractStatus,
  fetchCustomerPayments,
  recordCustomerPayment,
  fetchCatalogProducts,
  createCatalogProduct,
  updateCatalogProduct,
  fetchSupportTickets,
  fetchSupportTicket,
  createSupportTicket,
  updateSupportTicket,
  fetchDeskFeedback,
  fetchDeskFeedbackItem,
  updateDeskFeedback,
  fetchLocalSalesContractTerms,
  updateLocalSalesContractTerms,
  fetchIssuedSalesContracts,
  previewSalesContract,
  issueSalesContract,
  fetchIssuedSalesContractHtml,
  reprintSalesContract,
} from './customers-api'
export {
  fetchCommercialPlans,
  fetchCommercialPlan,
  fetchPlanHistory,
  updatePlanMetadata,
  updatePlanPricing,
  updatePlanCaps,
  updatePlanFeatures,
  updatePlanSalesStatus,
  setDefaultPlan,
} from './plans-api'
export {
  fetchTenantStaff,
  createTenantStaff,
  disableTenantStaff,
  reactivateTenantStaff,
  changeTenantStaffRole,
  resetTenantStaffPassword,
} from './tenant-staff-api'
export {
  fetchLocalOwnerRecoveries,
  fetchLocalOwnerRecovery,
  importLocalOwnerRecoveryChallenge,
  approveLocalOwnerRecovery,
  rejectLocalOwnerRecovery,
  revokeLocalOwnerRecovery,
} from './local-owner-recovery-api'
export { getAccessToken, setAccessToken, clearAccessToken } from './token'
export { ApiClientError, parsePlatformError } from './errors'
export * from './types'
