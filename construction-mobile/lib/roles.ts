import type { DemoUser } from './users'

/** Workers order without seeing prices; approvers see amounts when approving. */
export function showPricesForUser(user: Pick<DemoUser, 'role'>): boolean {
  return user.role === 'approver'
}
