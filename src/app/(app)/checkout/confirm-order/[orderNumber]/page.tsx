import { CheckCircle2, ShoppingBag } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

type Args = {
  searchParams: Promise<{ orderId?: string; token?: string; receiptFailed?: string }>
  params: Promise<{
    orderNumber: string
  }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { orderNumber } = await params
  return {
    title: `Order Received ${orderNumber} | N's KI`,
    robots: { index: false, follow: false },
    description: "Thank you for your order with N's KI.",
  }
}

export default async function OrderConfirmationPage({ params, searchParams }: Args) {
  const { orderNumber } = await params
  const decodedOrderNumber = decodeURIComponent(orderNumber)
  const { orderId, token, receiptFailed } = await searchParams

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full text-center glass-card p-8 sm:p-12 shadow-lg rounded-xl">
        <CheckCircle2 className="h-16 w-16 text-emerald-600 dark:text-emerald-400 mx-auto mb-6 stroke-[1.5]" />

        <span className="text-xs uppercase tracking-[0.3em] font-semibold text-muted-foreground block mb-2">
          Order Received
        </span>

        <h1 className="font-serif text-3xl font-normal uppercase tracking-widest text-foreground mb-4">
          Thank You
        </h1>

        <div className="bg-[#BDBAB9]/25 dark:bg-[#03171E]/60 p-4 border border-border rounded-lg mb-6 font-mono text-sm font-bold text-foreground">
          {decodedOrderNumber}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-8">
          Your order has been received. For digital transfers, our team will verify the
          payment reference before processing. Follow your secure order link for status updates.
        </p>

        {receiptFailed === '1' && <p role="status" className="text-sm mb-4">Your order was placed, but the receipt could not be uploaded. Open Order Details below to retry without placing another order.</p>}
        <div className="flex flex-col gap-3">
          {orderId && token && <Link href={`/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`} className="w-full glass-button-primary py-3.5 text-xs font-semibold uppercase tracking-[0.2em] rounded-lg">View Order Details</Link>}
          <Link
            href="/shop"
            className="w-full glass-button-primary py-3.5 text-xs font-semibold uppercase tracking-[0.2em] rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <ShoppingBag className="h-4 w-4" />
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
