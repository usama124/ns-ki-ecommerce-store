import type { Access } from 'payload'
import { checkRole } from './utilities'

export const orderOwner: Access = ({ req: { user } }) => {
  if (checkRole(['admin'], user)) return true
  if (!user) return false
  // Delivery email is editable/unverified and is not an ownership credential.
  return { customerAccount: { equals: user.id } }
}
