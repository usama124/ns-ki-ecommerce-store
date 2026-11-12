// @vitest-environment node
import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

const css = postcss.parse(readFileSync('src/app/(app)/globals.css', 'utf8'))
function declarations(selector: string) {
  let result: Record<string, string> | undefined
  css.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return
    result = {}
    rule.walkDecls(decl => { result![decl.prop] = decl.value })
  })
  return result
}
describe('checkout saved-address autofill styling', () => {
  it('styles autofilled textareas identically to the other autofilled inputs', () => {
    expect(declarations('textarea:autofill')).toEqual(declarations('input:autofill'))
    expect(declarations('textarea:autofill')).toMatchObject({
      color: 'var(--foreground)', 'background-color': 'var(--background)',
      '-webkit-text-fill-color': 'var(--foreground)', 'caret-color': 'var(--foreground)',
    })
  })
  it.each(['', ':hover', ':focus', ':active'])('overrides the browser autofill background and text for textarea%s', state => {
    expect(declarations(`textarea:-webkit-autofill${state}`)).toEqual(declarations(`input:-webkit-autofill${state}`))
    expect(declarations(`textarea:-webkit-autofill${state}`)).toMatchObject({
      '-webkit-box-shadow': '0 0 0 1000px var(--background) inset',
      '-webkit-text-fill-color': 'var(--foreground)',
    })
  })
  it('keeps the checkout street-address field and native saved-address support', () => {
    const source = readFileSync('src/components/checkout/CheckoutPage.tsx', 'utf8')
    expect(source).toMatch(/<textarea\s+id="checkout-address"\s+autoComplete="street-address"/)
  })
})
