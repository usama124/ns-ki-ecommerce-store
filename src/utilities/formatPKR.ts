/**
 * Format a number as Pakistani Rupees
 * Output: Rs. 18,500.00
 */
export function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
