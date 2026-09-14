import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { InventoryViewClient } from './InventoryViewClient'

/**
 * Server-component wrapper registered in payload.config.ts admin.components.views.
 * Payload injects AdminViewServerProps (including initPageResult with visibleEntities,
 * req with i18n, payload, permissions, etc.).
 * We pass all required ServerProps to DefaultTemplate so the admin shell renders correctly,
 * then mount the interactive client component inside.
 */
export const InventoryView: React.FC<AdminViewServerProps> = ({ initPageResult }) => {
  const { req, visibleEntities, permissions } = initPageResult

  return (
    <DefaultTemplate
      i18n={req.i18n}
      payload={req.payload}
      visibleEntities={visibleEntities}
      permissions={permissions}
      user={req.user ?? undefined}
    >
      <InventoryViewClient />
    </DefaultTemplate>
  )
}
