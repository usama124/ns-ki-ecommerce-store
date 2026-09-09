import { CheckCircle2, ShoppingBag } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

type Args = {
  params: Promise<{
    orderNumber: string
  }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { orderNumber } = await params
  return {
    title: `Order Confirmed ${orderNumber} | N's KI`,
    description: "Thank you for your order with N's KI.",
  }
}

export default async function OrderConfirmationPage({ params }: Args) {
  const { orderNumber } = await params
  const decodedOrderNumber = decodeURIComponent(orderNumber)

  return (
    <div className="bg-white min-h-[70vh] flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full text-center border border-gray-100 p-8 sm:p-12 shadow-sm rounded-xs">
        <CheckCircle2 className="h-16 w-16 text-green-700 mx-auto mb-6 stroke-[1.5]" />

        <span className="text-xs uppercase tracking-[0.3em] font-semibold text-gray-500 block mb-2">
          Order Received
        </span>

        <h1 className="font-serif text-3xl font-normal uppercase tracking-widest text-black mb-4">
          Thank You
        </h1>

        <div className="bg-neutral-50 p-4 border border-gray-200 mb-6 font-mono text-sm font-bold text-black">
          {decodedOrderNumber}
        </div>

        <p className="text-xs text-gray-600 leading-relaxed mb-8">
          Your order has been logged into Payload CMS with status{' '}
          <strong className="text-black">Pending Verification</strong>. Our team will review your
          order details and contact you shortly on WhatsApp / Phone.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/shop"
            className="w-full bg-black text-white py-3.5 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingBag className="h-4 w-4" />
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
