import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { SaleDashboardClient } from './SaleDashboardClient'

export const SaleDashboardView: React.FC<AdminViewServerProps> = ({ initPageResult }) => {
  const { req, visibleEntities, permissions } = initPageResult

  return (
    <DefaultTemplate
      i18n={req.i18n}
      payload={req.payload}
      visibleEntities={visibleEntities}
      permissions={permissions}
      user={req.user ?? undefined}
    >
      <SaleDashboardClient />
    </DefaultTemplate>
  )
}

