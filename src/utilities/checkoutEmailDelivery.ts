import type { Payload } from 'payload'
import { after } from 'next/server'
import { dispatchOrderEmails } from './orderOutbox'

/** Call only AFTER checkout commits. No timer, scheduler or detached promise. */
export function sendCheckoutEmails(payload: Payload, orderId: string | number) {
  try {
    // Next/Vercel keeps this invocation alive after returning checkout success.
    // Both the admin alert and customer acknowledgement are already durable.
    after(async () => {
      try {
        await dispatchOrderEmails(payload, 2, orderId)
      } catch {
        // Configuration/DB failures leave jobs queued. Never expose PII/secrets
        // or turn a committed order into a checkout failure.
        console.warn('[order-email] Automatic delivery unavailable; check admin email queue.')
      }
    })
  } catch {
    console.warn('[order-email] Automatic delivery could not start; check admin email queue.')
  }
}
