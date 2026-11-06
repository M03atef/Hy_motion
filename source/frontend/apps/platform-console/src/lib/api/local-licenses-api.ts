import { apiRequest } from './client'
import {
  LOCAL_LICENSE_ENDPOINTS,
  type IssueLocalLicenseRequest,
  type IssueLocalLicenseResult,
  type LocalLicenseActionRequest,
  type LocalLicenseDetailDto,
  type LocalLicenseListItemDto,
  type LocalLicenseTransferRequest,
} from './types'

/** PlatformCustomerAccess — Sales/Support/Ops/Admin can read. Mutations stay extra-gated. */
export function fetchLocalLicenses() {
  return apiRequest<LocalLicenseListItemDto[]>({
    method: 'GET',
    url: LOCAL_LICENSE_ENDPOINTS.list,
  })
}

export function fetchLocalLicenseDetail(id: string) {
  return apiRequest<LocalLicenseDetailDto>({
    method: 'GET',
    url: LOCAL_LICENSE_ENDPOINTS.detail(id),
  })
}

/** PlatformOpsOrAbove — the only way a production license is ever created. */
export function issueLocalLicense(body: IssueLocalLicenseRequest) {
  return apiRequest<IssueLocalLicenseResult>({
    method: 'POST',
    url: LOCAL_LICENSE_ENDPOINTS.issue,
    data: body,
  })
}

/** PlatformOpsOrAbove. */
export function suspendLocalLicense(id: string, body: LocalLicenseActionRequest) {
  return apiRequest<void>({
    method: 'POST',
    url: LOCAL_LICENSE_ENDPOINTS.suspend(id),
    data: body,
  })
}

/** PlatformAdminOnly. */
export function revokeLocalLicense(id: string, body: LocalLicenseActionRequest) {
  return apiRequest<void>({
    method: 'POST',
    url: LOCAL_LICENSE_ENDPOINTS.revoke(id),
    data: body,
  })
}

/** PlatformAdminOnly. Revoked/Suspended -> Active is its own reason-required action. */
export function reactivateLocalLicense(id: string, body: LocalLicenseActionRequest) {
  return apiRequest<void>({
    method: 'POST',
    url: LOCAL_LICENSE_ENDPOINTS.reactivate(id),
    data: body,
  })
}

/** PlatformOpsOrAbove. The authorized PC-replacement workflow. */
export function authorizeLocalLicenseTransfer(id: string, body: LocalLicenseTransferRequest) {
  return apiRequest<void>({
    method: 'POST',
    url: LOCAL_LICENSE_ENDPOINTS.authorizeTransfer(id),
    data: body,
  })
}
