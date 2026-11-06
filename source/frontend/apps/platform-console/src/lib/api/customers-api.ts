import { apiRequest } from './client'
import {
  CUSTOMER_ENDPOINTS,
  type ChangeContractStatusRequest,
  type CreatePlatformContractRequest,
  type CreateSupportTicketRequest,
  type DeskFeedbackDto,
  type InitiateOwnerPasswordResetRequest,
  type InitiateOwnerPasswordResetResult,
  type PlatformCatalogProductDto,
  type PlatformContractDto,
  type PlatformCustomerDetailDto,
  type PlatformCustomerListItemDto,
  type PlatformCustomerPaymentDto,
  type PlatformCustomerProfileDto,
  type PlatformSupportTicketDto,
  type RecordCustomerPaymentRequest,
  type UpdateDeskFeedbackRequest,
  type UpdateSupportTicketRequest,
  type UpsertCatalogProductRequest,
  type UpsertPlatformCustomerRequest,
  type LocalSalesContractDocumentDto,
  type LocalSalesContractHtmlDto,
  type LocalSalesContractTermsDto,
  type UpsertLocalSalesContractTermsRequest,
} from './types'

export function fetchCustomers(status?: string) {
  return apiRequest<PlatformCustomerListItemDto[]>({
    method: 'GET',
    url: CUSTOMER_ENDPOINTS.list,
    params: status ? { status } : undefined,
  })
}

export function fetchCustomer(id: string) {
  return apiRequest<PlatformCustomerDetailDto>({ method: 'GET', url: CUSTOMER_ENDPOINTS.detail(id) })
}

export function fetchCustomerProfile(id: string) {
  return apiRequest<PlatformCustomerProfileDto>({ method: 'GET', url: CUSTOMER_ENDPOINTS.profile(id) })
}

export function createCustomer(body: UpsertPlatformCustomerRequest) {
  return apiRequest<PlatformCustomerDetailDto>({ method: 'POST', url: CUSTOMER_ENDPOINTS.list, data: body })
}

export function updateCustomer(id: string, body: UpsertPlatformCustomerRequest) {
  return apiRequest<PlatformCustomerDetailDto>({ method: 'PUT', url: CUSTOMER_ENDPOINTS.detail(id), data: body })
}

export function initiateOwnerPasswordReset(id: string, body: InitiateOwnerPasswordResetRequest) {
  return apiRequest<InitiateOwnerPasswordResetResult>({
    method: 'POST',
    url: CUSTOMER_ENDPOINTS.passwordReset(id),
    data: body,
  })
}

export function fetchContracts(customerId?: string) {
  return apiRequest<PlatformContractDto[]>({
    method: 'GET',
    url: CUSTOMER_ENDPOINTS.contracts,
    params: customerId ? { customerId } : undefined,
  })
}

export function fetchContract(id: string) {
  return apiRequest<PlatformContractDto>({ method: 'GET', url: CUSTOMER_ENDPOINTS.contract(id) })
}

export function createContract(body: CreatePlatformContractRequest) {
  return apiRequest<PlatformContractDto>({ method: 'POST', url: CUSTOMER_ENDPOINTS.contracts, data: body })
}

export function changeContractStatus(id: string, body: ChangeContractStatusRequest) {
  return apiRequest<PlatformContractDto>({ method: 'POST', url: CUSTOMER_ENDPOINTS.contractStatus(id), data: body })
}

export function fetchCustomerPayments(customerId?: string, contractId?: string) {
  return apiRequest<PlatformCustomerPaymentDto[]>({
    method: 'GET',
    url: CUSTOMER_ENDPOINTS.payments,
    params: { customerId, contractId },
  })
}

export function recordCustomerPayment(body: RecordCustomerPaymentRequest) {
  return apiRequest<PlatformCustomerPaymentDto>({ method: 'POST', url: CUSTOMER_ENDPOINTS.payments, data: body })
}

export function fetchCatalogProducts(includeInactive = false) {
  return apiRequest<PlatformCatalogProductDto[]>({
    method: 'GET',
    url: CUSTOMER_ENDPOINTS.catalog,
    params: { includeInactive },
  })
}

export function createCatalogProduct(body: UpsertCatalogProductRequest) {
  return apiRequest<PlatformCatalogProductDto>({ method: 'POST', url: CUSTOMER_ENDPOINTS.catalog, data: body })
}

export function updateCatalogProduct(id: string, body: UpsertCatalogProductRequest) {
  return apiRequest<PlatformCatalogProductDto>({ method: 'PUT', url: CUSTOMER_ENDPOINTS.catalogItem(id), data: body })
}

export function fetchSupportTickets(customerId?: string, status?: string) {
  return apiRequest<PlatformSupportTicketDto[]>({
    method: 'GET',
    url: CUSTOMER_ENDPOINTS.tickets,
    params: { customerId, status },
  })
}

export function fetchSupportTicket(id: string) {
  return apiRequest<PlatformSupportTicketDto>({ method: 'GET', url: CUSTOMER_ENDPOINTS.ticket(id) })
}

export function createSupportTicket(body: CreateSupportTicketRequest) {
  return apiRequest<PlatformSupportTicketDto>({ method: 'POST', url: CUSTOMER_ENDPOINTS.tickets, data: body })
}

export function updateSupportTicket(id: string, body: UpdateSupportTicketRequest) {
  return apiRequest<PlatformSupportTicketDto>({ method: 'PATCH', url: CUSTOMER_ENDPOINTS.ticket(id), data: body })
}

export function fetchDeskFeedback(params?: {
  customerId?: string
  tenantId?: string
  category?: string
  status?: string
  from?: string
  to?: string
}) {
  return apiRequest<DeskFeedbackDto[]>({
    method: 'GET',
    url: CUSTOMER_ENDPOINTS.deskFeedback,
    params,
  })
}

export function fetchDeskFeedbackItem(id: string) {
  return apiRequest<DeskFeedbackDto>({ method: 'GET', url: CUSTOMER_ENDPOINTS.deskFeedbackItem(id) })
}

export function updateDeskFeedback(id: string, body: UpdateDeskFeedbackRequest) {
  return apiRequest<DeskFeedbackDto>({ method: 'PATCH', url: CUSTOMER_ENDPOINTS.deskFeedbackItem(id), data: body })
}

export function fetchLocalSalesContractTerms() {
  return apiRequest<LocalSalesContractTermsDto>({
    method: 'GET',
    url: CUSTOMER_ENDPOINTS.salesContractTerms,
  })
}

export function updateLocalSalesContractTerms(body: UpsertLocalSalesContractTermsRequest) {
  return apiRequest<LocalSalesContractTermsDto>({
    method: 'PUT',
    url: CUSTOMER_ENDPOINTS.salesContractTerms,
    data: body,
  })
}

export function fetchIssuedSalesContracts(customerId?: string, contractId?: string) {
  return apiRequest<LocalSalesContractDocumentDto[]>({
    method: 'GET',
    url: CUSTOMER_ENDPOINTS.salesContracts,
    params: { customerId, contractId },
  })
}

export function previewSalesContract(contractId: string, language: 'en' | 'ar') {
  return apiRequest<LocalSalesContractHtmlDto>({
    method: 'GET',
    url: CUSTOMER_ENDPOINTS.salesContractPreview(contractId),
    params: { language },
  })
}

export function issueSalesContract(contractId: string, language: 'en' | 'ar') {
  return apiRequest<LocalSalesContractHtmlDto>({
    method: 'POST',
    url: CUSTOMER_ENDPOINTS.salesContract(contractId),
    data: { language },
  })
}

export function fetchIssuedSalesContractHtml(contractId: string) {
  return apiRequest<LocalSalesContractHtmlDto>({
    method: 'GET',
    url: CUSTOMER_ENDPOINTS.salesContractHtml(contractId),
  })
}

export function reprintSalesContract(contractId: string) {
  return apiRequest<LocalSalesContractHtmlDto>({
    method: 'POST',
    url: CUSTOMER_ENDPOINTS.salesContractReprint(contractId),
  })
}
