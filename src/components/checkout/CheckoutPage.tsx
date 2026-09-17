'use client'

import { useCart } from '@/providers/Cart'
import { formatPKR } from '@/utilities/formatPKR'
import { calculateShipping, getShippingLabel, MAJOR_CITIES } from '@/utilities/shipping'
import {
    ArrowRight,
    Check,
    Copy,
    CreditCard,
    QrCode,
    ShieldCheck,
    Truck,
    Upload,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { toast } from 'sonner'

export function CheckoutPage({ siteSettings }: { siteSettings?: any }) {
  const { items, subtotal, clearCart } = useCart()
  const router = useRouter()

  // Form State
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    city: 'Lahore',
    province: 'Punjab',
    address: '',
  })

  const [paymentMethod, setPaymentMethod] = useState<
    'cod' | 'bank_transfer' | 'jazzcash' | 'easypaisa'
  >('cod')
  const [transactionId, setTransactionId] = useState('')
  const [screenshotMediaId, setScreenshotMediaId] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [transferMode, setTransferMode] = useState<'details' | 'qr'>('details')
  const [uploading, setUploading] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Account details defaults (matching Pakistani banking standards or site settings)
  const bankDetails = siteSettings?.paymentDetails?.bankTransfer || {
    bankName: 'Meezan Bank',
    accountTitle: "N's KI LUXURY FASHION",
    accountNumber: 'PK00MEZN0001020304050607',
    raastId: '03001234567',
  }
  const jazzcashDetails = siteSettings?.paymentDetails?.jazzcash || {
    mobileNumber: '03001234567',
    accountName: "N's KI CLOTHING",
  }
  const easypaisaDetails = siteSettings?.paymentDetails?.easypaisa || {
    mobileNumber: '03001234567',
    accountName: "N's KI CLOTHING",
  }

  // Shipping & COD calculation
  const codFeeFromAdmin = siteSettings?.shipping?.codFee ?? 250
  const shippingFee = calculateShipping(customer.city, subtotal)
  const codFee = paymentMethod === 'cod' ? codFeeFromAdmin : 0
  const totalAmount = subtotal + shippingFee + codFee

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(label)
    toast.success(`Copied ${label} to clipboard`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Screenshot File Upload to Payload Media
  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('alt', `Payment proof from ${customer.name || 'customer'}`)

    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error('Upload failed')
      }

      const data = await res.json()
      setScreenshotMediaId(data.doc?.id || data.id)
      toast.success('Screenshot proof uploaded successfully!')
    } catch (err) {
      toast.error('Failed to upload screenshot. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (items.length === 0) {
      setErrorMessage('Your shopping bag is empty.')
      return
    }

    if (paymentMethod !== 'cod' && !transactionId && !screenshotMediaId) {
      setErrorMessage('Please enter TRX ID or upload screenshot proof for digital transfer.')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer,
          items,
          paymentMethod,
          paymentProof:
            paymentMethod !== 'cod'
              ? {
                  transactionId: transactionId || undefined,
                  screenshot: screenshotMediaId || undefined,
                }
              : undefined,
          subtotal,
          shippingFee,
          codFee,
          totalAmount,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order.')
      }

      clearCart()
      toast.success('Order placed successfully!')
      router.push(`/checkout/confirm-order/${encodeURIComponent(data.orderNumber)}`)
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while placing order.')
      toast.error(err.message || 'Order submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-3xl font-normal uppercase tracking-widest text-foreground mb-4">
          Your Shopping Bag is Empty
        </h1>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-8">
          Add luxury Pakistani apparel to your cart before proceeding to checkout.
        </p>
        <Link
          href="/shop"
          className="inline-block glass-button-primary px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] rounded-lg transition-all"
        >
          Explore Collection
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="font-serif text-3xl font-normal uppercase tracking-[0.15em] text-foreground text-center mb-10">
          Checkout & Payment
        </h1>

        {errorMessage && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-medium uppercase tracking-wider rounded-lg">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Delivery & Payment Details */}
          <div className="lg:col-span-7 flex flex-col gap-10">
            {/* Section 1: Customer Info */}
            <div className="glass-card p-6 sm:p-8 rounded-xl shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground mb-6 flex items-center gap-2 border-b pb-3 border-border">
                <Truck className="h-4 w-4 text-secondary" />
                1. Delivery Address (Pakistan)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest font-semibold text-foreground mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    placeholder="e.g. Fatima Khan"
                    className="w-full px-3 py-2.5 text-xs border border-border focus:border-[#648698] focus:outline-hidden bg-[#BDBAB9]/25 dark:bg-[#03171E]/60 text-foreground rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-widest font-semibold text-foreground mb-1">
                    Phone Number (+92) *
                  </label>
                  <input
                    type="text"
                    required
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    placeholder="e.g. 03001234567"
                    className="w-full px-3 py-2.5 text-xs border border-border focus:border-[#648698] focus:outline-hidden bg-[#BDBAB9]/25 dark:bg-[#03171E]/60 text-foreground rounded-lg"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] uppercase tracking-widest font-semibold text-foreground mb-1">
                    Email Address (For Order Receipts)
                  </label>
                  <input
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                    placeholder="fatima@example.com"
                    className="w-full px-3 py-2.5 text-xs border border-border focus:border-[#648698] focus:outline-hidden bg-[#BDBAB9]/25 dark:bg-[#03171E]/60 text-foreground rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-widest font-semibold text-foreground mb-1">
                    City *
                  </label>
                  <select
                    value={customer.city}
                    onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                    className="w-full px-3 py-2.5 text-xs border border-border focus:border-[#648698] focus:outline-hidden bg-[#BDBAB9]/25 dark:bg-[#03171E]/60 text-foreground cursor-pointer rounded-lg"
                  >
                    {MAJOR_CITIES.map((c) => (
                      <option
                        key={c}
                        value={c}
                        className="bg-[#eae7e6] text-[#03171e] dark:bg-[#03171e] dark:text-[#f0f3f4]"
                      >
                        {c} (Major City — Rs. 250 Shipping)
                      </option>
                    ))}
                    <option
                      value="Other"
                      className="bg-[#eae7e6] text-[#03171e] dark:bg-[#03171e] dark:text-[#f0f3f4]"
                    >
                      Other City (Secondary — Rs. 350 Shipping)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-widest font-semibold text-foreground mb-1">
                    Province *
                  </label>
                  <select
                    value={customer.province}
                    onChange={(e) => setCustomer({ ...customer, province: e.target.value })}
                    className="w-full px-3 py-2.5 text-xs border border-border focus:border-[#648698] focus:outline-hidden bg-[#BDBAB9]/25 dark:bg-[#03171E]/60 text-foreground cursor-pointer rounded-lg"
                  >
                    <option
                      value="Punjab"
                      className="bg-[#eae7e6] text-[#03171e] dark:bg-[#03171e] dark:text-[#f0f3f4]"
                    >
                      Punjab
                    </option>
                    <option
                      value="Sindh"
                      className="bg-[#eae7e6] text-[#03171e] dark:bg-[#03171e] dark:text-[#f0f3f4]"
                    >
                      Sindh
                    </option>
                    <option
                      value="Khyber Pakhtunkhwa"
                      className="bg-[#eae7e6] text-[#03171e] dark:bg-[#03171e] dark:text-[#f0f3f4]"
                    >
                      Khyber Pakhtunkhwa
                    </option>
                    <option
                      value="Balochistan"
                      className="bg-[#eae7e6] text-[#03171e] dark:bg-[#03171e] dark:text-[#f0f3f4]"
                    >
                      Balochistan
                    </option>
                    <option
                      value="Islamabad Capital Territory"
                      className="bg-[#eae7e6] text-[#03171e] dark:bg-[#03171e] dark:text-[#f0f3f4]"
                    >
                      Islamabad Capital Territory
                    </option>
                    <option
                      value="Azad Kashmir"
                      className="bg-[#eae7e6] text-[#03171e] dark:bg-[#03171e] dark:text-[#f0f3f4]"
                    >
                      Azad Kashmir
                    </option>
                    <option
                      value="Gilgit-Baltistan"
                      className="bg-[#eae7e6] text-[#03171e] dark:bg-[#03171e] dark:text-[#f0f3f4]"
                    >
                      Gilgit-Baltistan
                    </option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] uppercase tracking-widest font-semibold text-foreground mb-1">
                    Street Address / House # / Area *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={customer.address}
                    onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                    placeholder="House No, Street, Sector/Block, LandMark"
                    className="w-full px-3 py-2.5 text-xs border border-border focus:border-[#648698] focus:outline-hidden bg-[#BDBAB9]/25 dark:bg-[#03171E]/60 text-foreground rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Payment Method Selector */}
            <div className="glass-card p-6 sm:p-8 rounded-xl shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground mb-6 flex items-center gap-2 border-b pb-3 border-border">
                <CreditCard className="h-4 w-4 text-secondary" />
                2. Select Payment Method
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {[
                  {
                    id: 'cod',
                    title: 'Cash on Delivery',
                    desc:
                      codFeeFromAdmin > 0
                        ? `Pay cash upon delivery (+ ${formatPKR(codFeeFromAdmin)} COD fee)`
                        : 'Pay cash when package arrives',
                  },
                  {
                    id: 'bank_transfer',
                    title: 'Bank / Raast Transfer',
                    desc: 'Direct transfer to Meezan Bank',
                  },
                  {
                    id: 'jazzcash',
                    title: 'JazzCash Wallet',
                    desc: 'Transfer via JazzCash mobile',
                  },
                  {
                    id: 'easypaisa',
                    title: 'EasyPaisa Wallet',
                    desc: 'Transfer via EasyPaisa mobile',
                  },
                ].map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id as any)}
                    className={`p-4 text-left border-2 transition-all rounded-lg flex flex-col justify-between ${
                      paymentMethod === method.id
                        ? 'border-[#03171e] dark:border-[#648698] bg-[#648698]/20 shadow-xs'
                        : 'border-border bg-[#BDBAB9]/20 dark:bg-[#03171E]/40 hover:border-[#648698]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        {method.title}
                      </span>
                      <div
                        className={`h-4 w-4 rounded-full border flex items-center justify-center transition-colors ${
                          paymentMethod === method.id
                            ? 'border-[#03171e] dark:border-[#648698] bg-[#03171e] dark:bg-[#648698]'
                            : 'border-border'
                        }`}
                      >
                        {paymentMethod === method.id && (
                          <Check className="h-3 w-3 text-[#bdbab9] dark:text-[#03171e]" />
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {method.desc}
                    </span>
                  </button>
                ))}
              </div>

              {/* Digital Transfer Details Panel */}
              {paymentMethod !== 'cod' && (
                <div className="bg-[#BDBAB9]/20 dark:bg-[#03171E]/60 border-2 border-border p-6 rounded-xl mt-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                      {paymentMethod === 'bank_transfer'
                        ? 'Meezan Bank & Raast Transfer'
                        : paymentMethod === 'jazzcash'
                          ? 'JazzCash Wallet Transfer'
                          : 'EasyPaisa Wallet Transfer'}
                    </h3>

                    {/* Mode Toggle: Account Details vs Scan QR Code */}
                    <div className="flex items-center gap-1.5 bg-[#BDBAB9]/30 dark:bg-[#03171E] p-1 rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => setTransferMode('details')}
                        className={`px-3 py-1 text-[11px] uppercase tracking-wider font-bold rounded-md transition-all ${
                          transferMode === 'details'
                            ? 'glass-button-primary shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Account Details
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransferMode('qr')}
                        className={`px-3 py-1 text-[11px] uppercase tracking-wider font-bold rounded-md transition-all flex items-center gap-1.5 ${
                          transferMode === 'qr'
                            ? 'glass-button-primary shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <QrCode className="h-3.5 w-3.5 text-secondary" />
                        Scan QR Code
                      </button>
                    </div>
                  </div>

                  {/* View 1: Manual Account Details */}
                  {transferMode === 'details' && (
                    <>
                      {paymentMethod === 'bank_transfer' && (
                        <div className="space-y-2 text-xs font-mono mb-6">
                          <div className="flex justify-between items-center bg-[#BDBAB9]/30 dark:bg-[#03171E]/60 p-2.5 rounded-lg border border-border">
                            <span className="font-semibold text-foreground">
                              Bank: {bankDetails.bankName}
                            </span>
                          </div>
                          <div className="flex justify-between items-center bg-[#BDBAB9]/30 dark:bg-[#03171E]/60 p-2.5 rounded-lg border border-border">
                            <span className="font-semibold text-foreground">
                              Title: {bankDetails.accountTitle}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(bankDetails.accountTitle, 'Account Title')
                              }
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy Title"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex justify-between items-center bg-[#BDBAB9]/30 dark:bg-[#03171E]/60 p-2.5 rounded-lg border border-border">
                            <span className="font-semibold text-foreground">
                              IBAN: {bankDetails.accountNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(bankDetails.accountNumber, 'IBAN')}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy IBAN"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex justify-between items-center bg-[#BDBAB9]/30 dark:bg-[#03171E]/60 p-2.5 rounded-lg border border-border">
                            <span className="font-semibold text-foreground">
                              Raast ID: {bankDetails.raastId}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(bankDetails.raastId, 'Raast ID')}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy Raast ID"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {paymentMethod === 'jazzcash' && (
                        <div className="space-y-2 text-xs font-mono mb-6">
                          <div className="flex justify-between items-center bg-[#BDBAB9]/30 dark:bg-[#03171E]/60 p-2.5 rounded-lg border border-border">
                            <span className="font-semibold text-foreground">
                              JazzCash Mobile: {jazzcashDetails.mobileNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(jazzcashDetails.mobileNumber, 'Mobile Number')
                              }
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy Mobile Number"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex justify-between items-center bg-[#BDBAB9]/30 dark:bg-[#03171E]/60 p-2.5 rounded-lg border border-border">
                            <span className="font-semibold text-foreground">
                              Account Title: {jazzcashDetails.accountName}
                            </span>
                          </div>
                        </div>
                      )}

                      {paymentMethod === 'easypaisa' && (
                        <div className="space-y-2 text-xs font-mono mb-6">
                          <div className="flex justify-between items-center bg-[#BDBAB9]/30 dark:bg-[#03171E]/60 p-2.5 rounded-lg border border-border">
                            <span className="font-semibold text-foreground">
                              EasyPaisa Mobile: {easypaisaDetails.mobileNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(easypaisaDetails.mobileNumber, 'Mobile Number')
                              }
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy Mobile Number"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex justify-between items-center bg-[#BDBAB9]/30 dark:bg-[#03171E]/60 p-2.5 rounded-lg border border-border">
                            <span className="font-semibold text-foreground">
                              Account Title: {easypaisaDetails.accountName}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* View 2: QR Code Scanner */}
                  {transferMode === 'qr' && (
                    <div className="flex flex-col items-center justify-center p-5 bg-[#BDBAB9]/25 dark:bg-[#03171E]/60 border border-border rounded-xl text-center mb-6">
                      <div className="bg-white p-3 rounded-xl border border-stone-300 shadow-md mb-3">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                            paymentMethod === 'bank_transfer'
                              ? bankDetails.raastId
                              : paymentMethod === 'jazzcash'
                                ? jazzcashDetails.mobileNumber
                                : easypaisaDetails.mobileNumber,
                          )}`}
                          alt="Payment QR Code"
                          className="w-44 h-44 object-contain"
                        />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                        Scan to Transfer via{' '}
                        {paymentMethod === 'bank_transfer'
                          ? 'Raast / Banking App'
                          : paymentMethod === 'jazzcash'
                            ? 'JazzCash App'
                            : 'EasyPaisa App'}
                      </span>
                      <p className="text-xs font-mono font-semibold text-foreground">
                        {paymentMethod === 'bank_transfer'
                          ? `Raast ID: ${bankDetails.raastId}`
                          : paymentMethod === 'jazzcash'
                            ? `JazzCash: ${jazzcashDetails.mobileNumber}`
                            : `EasyPaisa: ${easypaisaDetails.mobileNumber}`}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-medium mt-1">
                        Title:{' '}
                        {paymentMethod === 'bank_transfer'
                          ? bankDetails.accountTitle
                          : paymentMethod === 'jazzcash'
                            ? jazzcashDetails.accountName
                            : easypaisaDetails.accountName}
                      </p>
                    </div>
                  )}

                  {/* Proof Inputs */}
                  <div className="space-y-5 pt-4 border-t border-border">
                    <div>
                      <label className="block text-xs uppercase tracking-widest font-bold text-foreground mb-1.5">
                        Transaction / Reference ID (TRX ID)
                      </label>
                      <input
                        type="text"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="e.g. 0192837465"
                        className="w-full px-4 py-3 text-sm font-mono font-bold border border-border focus:border-[#648698] focus:outline-hidden bg-[#BDBAB9]/25 dark:bg-[#03171E]/60 text-foreground placeholder:text-muted-foreground rounded-lg shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-widest font-bold text-foreground mb-2">
                        Upload Transfer Screenshot Proof
                      </label>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <label className="cursor-pointer inline-flex items-center gap-2 glass-button-primary px-5 py-3 rounded-lg text-xs uppercase tracking-widest font-bold transition-all shadow-sm">
                          <Upload className="h-4 w-4 text-secondary flex-shrink-0" />
                          <span className="font-bold">
                            {uploading ? 'Uploading Proof...' : 'Choose Screenshot File'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                setSelectedFileName(e.target.files[0].name)
                              }
                              handleScreenshotUpload(e)
                            }}
                            className="hidden"
                          />
                        </label>

                        {selectedFileName && (
                          <div className="flex items-center gap-2 text-xs font-semibold text-foreground bg-[#BDBAB9]/30 dark:bg-[#03171E]/60 px-3.5 py-2.5 rounded-lg border border-border">
                            <span className="truncate max-w-[200px]">{selectedFileName}</span>
                            {screenshotMediaId ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <Check className="h-4 w-4" /> Uploaded
                              </span>
                            ) : uploading ? (
                              <span className="text-amber-600 dark:text-amber-400 font-bold animate-pulse">
                                Uploading...
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-5">
            <div className="glass-card p-6 sm:p-8 sticky top-28 rounded-xl shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground mb-6 border-b pb-3 border-border">
                Order Summary ({items.length} items)
              </h2>

              <div className="max-h-80 overflow-y-auto space-y-4 mb-6 pr-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-4 border-b border-border/60 pb-3">
                    <div className="relative w-14 h-18 bg-[#648698]/20 rounded-md overflow-hidden flex-shrink-0">
                      {item.imageUrl && (
                        <Image src={item.imageUrl} alt={item.title} fill className="object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold uppercase tracking-wider truncate text-foreground">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-widest">
                        Size: {item.variantSize} × {item.quantity}
                      </p>
                      <p className="text-xs font-semibold text-foreground mt-1">
                        {formatPKR(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 text-xs border-t pt-4 border-border">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-semibold text-foreground">{formatPKR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping Fee ({customer.city})</span>
                  <span className="font-semibold text-foreground">
                    {getShippingLabel(shippingFee)}
                  </span>
                </div>
                {paymentMethod === 'cod' && codFee > 0 && (
                  <div className="flex justify-between text-amber-800 dark:text-amber-300 font-semibold bg-amber-500/15 p-2 rounded border border-amber-500/30">
                    <span>Cash on Delivery (COD) Fee</span>
                    <span>+{formatPKR(codFee)}</span>
                  </div>
                )}
                {subtotal >= 15000 && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                    ✓ You unlocked FREE Shipping nationwide!
                  </p>
                )}
                <div className="flex justify-between text-sm font-bold text-foreground border-t pt-3 border-border">
                  <span className="uppercase tracking-widest">Total Amount</span>
                  <span>{formatPKR(totalAmount)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-8 glass-button-primary py-4 text-xs font-bold uppercase tracking-[0.25em] rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  'Processing Order...'
                ) : (
                  <>
                    Complete Order <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="mt-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                100% Genuine Pakistani Fashion & Secure Verification
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
