import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { checkRole } from '@/access/utilities'
import { ReportsClient } from './ReportsClient'

export function ReportsView({ initPageResult }: AdminViewServerProps) {
  const { req, visibleEntities, permissions } = initPageResult
  if (!checkRole(['admin'], req.user)) return <p role="alert">Administrator access is required.</p>
  return (
    <DefaultTemplate
      i18n={req.i18n}
      payload={req.payload}
      visibleEntities={visibleEntities}
      permissions={permissions}
      user={req.user ?? undefined}
    >
      <ReportsClient />
    </DefaultTemplate>
  )
}
