'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { PrivateReceipt } from '@/components/orders/PrivateReceipt'

export function OrderReceipt() {
  const { id } = useDocumentInfo()
  return id ? (
    <PrivateReceipt orderId={id} readOnly />
  ) : (
    <p>Save the order before viewing receipts.</p>
  )
}
