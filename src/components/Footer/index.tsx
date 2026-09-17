import type { Footer } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { LogoIcon } from '@/components/icons/logo'
import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'

// Social icon SVGs (inline, no extra dep)
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.514c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

// COD icon
function CodBadge() {
  return (
    <span className="flex items-center gap-1 rounded border border-[#648698]/40 bg-[#03171E]/50 text-[#CBCCC7] px-2.5 py-1 text-xs font-semibold tracking-wide uppercase backdrop-blur-xs">
      COD
    </span>
  )
}

// Generic payment badge
function PayBadge({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1 rounded border border-[#648698]/40 bg-[#03171E]/50 text-[#CBCCC7] px-2.5 py-1 text-xs font-semibold tracking-wide backdrop-blur-xs">
      {label}
    </span>
  )
}

export async function Footer() {
  const footer: Footer = await getCachedGlobal('footer', 1)()
  const currentYear = new Date().getFullYear()

  const social = footer.socialLinks || {}
  const columns = footer.columns || []

  // Hardcoded fallback columns if DB is empty
  const defaultColumns = [
    {
      heading: 'Shop',
      links: [
        { url: '/shop', label: 'All Products' },
        { url: '/shop/unstitched', label: 'Unstitched' },
        { url: '/shop/ready-to-wear', label: 'Ready To Wear' },
        { url: '/shop/luxury-lawn', label: 'Luxury Lawn' },
        { url: '/shop/chiffon-formals', label: 'Chiffon Formals' },
        { url: '/shop/sale', label: 'Sale' },
      ],
    },
    {
      heading: 'Customer Service',
      links: [
        { url: '/find-order', label: 'Track Your Order' },
        { url: '/checkout', label: 'Checkout' },
        { url: '/login', label: 'Login' },
        { url: '/create-account', label: 'Create Account' },
        { url: '/forgot-password', label: 'Forgot Password' },
      ],
    },
    {
      heading: 'Contact Us',
      links: [
        { url: 'https://wa.me/923001234567', label: 'WhatsApp' },
        { url: 'mailto:info@nski.pk', label: 'Email Us' },
      ],
    },
  ]

  const displayColumns = columns.length > 0 ? columns : defaultColumns

  return (
    <footer className="bg-[#03171E] text-[#CBCCC7] border-t border-[#648698]/30">
      {/* Main footer grid */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-3">
              <LogoIcon width={40} height={40} className="object-contain filter drop-shadow-sm" />
              <span className="text-2xl font-bold tracking-[0.2em] text-[#CBCCC7] uppercase font-serif">
                N's KI
              </span>
            </Link>
            {footer.tagline && (
              <p className="text-sm leading-relaxed text-[#648698]">{footer.tagline}</p>
            )}

            {/* Social links */}
            <div className="flex items-center gap-3 mt-2">
              {(social as any).instagram && (
                <a
                  href={(social as any).instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="text-[#648698] hover:text-white transition-colors"
                >
                  <InstagramIcon />
                </a>
              )}
              {(social as any).facebook && (
                <a
                  href={(social as any).facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="text-[#648698] hover:text-white transition-colors"
                >
                  <FacebookIcon />
                </a>
              )}
              {(social as any).tiktok && (
                <a
                  href={(social as any).tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok"
                  className="text-[#648698] hover:text-white transition-colors"
                >
                  <TikTokIcon />
                </a>
              )}
              {(social as any).youtube && (
                <a
                  href={(social as any).youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="text-[#648698] hover:text-white transition-colors"
                >
                  <YouTubeIcon />
                </a>
              )}
              {(social as any).whatsapp && (
                <a
                  href={`https://wa.me/${(social as any).whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="text-[#648698] hover:text-white transition-colors"
                >
                  <WhatsAppIcon />
                </a>
              )}
              {/* Default socials when nothing configured */}
              {!(social as any).instagram &&
                !(social as any).facebook &&
                !(social as any).tiktok && (
                  <>
                    <a
                      href="https://instagram.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      className="text-[#648698] hover:text-white transition-colors"
                    >
                      <InstagramIcon />
                    </a>
                    <a
                      href="https://facebook.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook"
                      className="text-[#648698] hover:text-white transition-colors"
                    >
                      <FacebookIcon />
                    </a>
                    <a
                      href="https://tiktok.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="TikTok"
                      className="text-[#648698] hover:text-white transition-colors"
                    >
                      <TikTokIcon />
                    </a>
                  </>
                )}
            </div>
          </div>

          {/* Dynamic nav columns from Payload or fallback */}
          {columns.length > 0
            ? columns.map((col: any, idx: number) => (
                <div key={col.id ?? idx} className="flex flex-col gap-3">
                  <h3 className="text-xs font-bold tracking-widest uppercase text-[#CBCCC7]">
                    {col.heading}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {(col.links || []).map((item: any) => (
                      <li key={item.id}>
                        <CMSLink
                          appearance="link"
                          {...item.link}
                          className="text-sm text-[#648698] hover:text-white transition-colors"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            : defaultColumns.map((col, idx) => (
                <div key={idx} className="flex flex-col gap-3">
                  <h3 className="text-xs font-bold tracking-widest uppercase text-[#CBCCC7]">
                    {col.heading}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {col.links.map((item, i) => (
                      <li key={i}>
                        <Link
                          href={item.url}
                          className="text-sm text-[#648698] hover:text-white transition-colors"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
        </div>
      </div>

      {/* Payment methods strip */}
      <div className="border-t border-[#648698]/20 bg-[#07242e]/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[#648698]">
              {footer.paymentNote ||
                'We accept Cash on Delivery, Bank Transfer, JazzCash & EasyPaisa'}
            </p>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <CodBadge />
              <PayBadge label="Bank Transfer" />
              <PayBadge label="JazzCash" />
              <PayBadge label="EasyPaisa" />
            </div>
          </div>
        </div>
      </div>

      {/* Copyright bar */}
      <div className="border-t border-[#648698]/20 bg-[#021015]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#648698]">
            <p>
              &copy; {currentYear} {footer.copyrightText || "N's KI. All rights reserved."}
            </p>
            <div className="flex items-center gap-4">
              <span>Designed in Pakistan 🇵🇰</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
