/**
 * Format a number as Pakistani Rupees
 * Example Output: Rs. 18,500
 */
export function formatPKR(amount: number | null | undefined): string {
  const numericAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0
  return `Rs. ${Math.round(numericAmount).toLocaleString('en-PK')}`
}
