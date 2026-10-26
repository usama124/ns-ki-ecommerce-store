import { ValidationError, type CollectionBeforeValidateHook } from 'payload'
import { isStorefrontPaymentMethod, unavailablePaymentMessage } from './storefrontPayments'

// Also protects generic REST/GraphQL creation, not just the custom checkout route.
// Unchanged payment methods on existing orders remain valid for fulfillment/history.
export const validateOrderPaymentMethod: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data
  const changing =
    Object.hasOwn(data, 'paymentMethod') && data.paymentMethod !== originalDoc?.paymentMethod
  if (operation !== 'create' && !changing) return data
  let settings
  try {
    settings = await req.payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: false,
      req,
    })
  } catch {
    throw new ValidationError({
      errors: [
        {
          path: 'paymentMethod',
          message: 'Payment options are temporarily unavailable. Please try again.',
        },
      ],
    })
  }
  if (!isStorefrontPaymentMethod(data.paymentMethod, settings)) {
    throw new ValidationError({
      errors: [{ path: 'paymentMethod', message: unavailablePaymentMessage }],
    })
  }
  return data
}
