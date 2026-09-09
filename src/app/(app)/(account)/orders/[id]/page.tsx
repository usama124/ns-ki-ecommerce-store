import type { Order } from '@/payload-types'
import type { Metadata } from 'next'

import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/utilities/formatDateTime'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeftIcon } from 'lucide-react'
import { ProductItem } from '@/components/ProductItem'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { OrderStatus } from '@/components/OrderStatus'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function OrderPage({ params }: PageProps) {
  const payload = await getPayload({ config: configPromise })
  const { id } = await params

  let order: Order | null = null

  try {
    const orderResult = await payload.findByID({
      collection: 'orders',
      id,
      depth: 2,
      overrideAccess: true,
    })

    if (orderResult) {
      order = orderResult
    }
  } catch (error) {
    console.error(error)
  }

  if (!order) {
    notFound()
  }

  const amount = order.totalAmount || order.subtotal || 0

  return (
    <div className="container py-8">
      <div className="flex gap-8 justify-between items-center mb-6">
        <Button asChild variant="ghost">
          <Link href="/shop">
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Back to Shop
          </Link>
        </Button>

        <h1 className="text-sm uppercase font-mono px-2 bg-primary/10 rounded tracking-[0.07em]">
          <span>{order.orderNumber || `#${order.id}`}</span>
        </h1>
      </div>

      <div className="bg-card border rounded-lg px-6 py-6 flex flex-col gap-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between border-b pb-6">
          <div>
            <p className="font-mono uppercase text-primary/50 mb-1 text-xs">Order Date</p>
            <p className="text-base font-semibold">
              <time dateTime={order.createdAt}>
                {formatDateTime({ date: order.createdAt, format: 'MMMM dd, yyyy' })}
              </time>
            </p>
          </div>

          <div>
            <p className="font-mono uppercase text-primary/50 mb-1 text-xs">Payment Method</p>
            <p className="text-base font-semibold uppercase">{order.paymentMethod}</p>
          </div>

          <div>
            <p className="font-mono uppercase text-primary/50 mb-1 text-xs">Total Amount</p>
            <Price className="text-base font-semibold" amount={amount} />
          </div>

          {order.status && (
            <div>
              <p className="font-mono uppercase text-primary/50 mb-1 text-xs">Status</p>
              <OrderStatus className="text-sm" status={order.status} />
            </div>
          )}
        </div>

        {/* Customer Information */}
        {order.customer && (
          <div className="border-b pb-6">
            <h2 className="font-mono text-primary/50 mb-3 uppercase text-xs">Delivery Details</h2>
            <div className="text-sm space-y-1">
              <p className="font-bold">{order.customer.name}</p>
              <p>{order.customer.phone}</p>
              {order.customer.email && <p>{order.customer.email}</p>}
              <p>{order.customer.address}, {order.customer.city}, {order.customer.province}</p>
            </div>
          </div>
        )}

        {/* Order Items */}
        {order.items && (
          <div>
            <h2 className="font-mono text-primary/50 mb-4 uppercase text-xs">Order Items</h2>
            <ul className="flex flex-col gap-6">
              {order.items.map((item, index) => {
                if (!item.product || typeof item.product !== 'object') {
                  return <div key={index}>Product details unavailable.</div>
                }

                return (
                  <li key={index}>
                    <ProductItem
                      product={item.product}
                      quantity={item.quantity}
                      variantSize={item.variantSize}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params

  return {
    description: `Order details for order ${id}.`,
    openGraph: mergeOpenGraph({
      title: `Order ${id}`,
      url: `/orders/${id}`,
    }),
    title: `Order ${id}`,
  }
}
