export { StatusChip } from '@/components/Status'

export const NEXT_CONTRACT_STATUS: Record<string, string[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['active', 'cancelled'],
  active: ['completed', 'expired', 'cancelled'],
}
