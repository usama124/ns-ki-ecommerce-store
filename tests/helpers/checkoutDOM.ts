import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined
export function cleanup() {
  if (root) act(() => root!.unmount())
  root = undefined
  document.body.replaceChildren()
}
export function render(node: ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  const rerender = (next: ReactNode) => act(() => root!.render(next))
  rerender(node)
  return { rerender }
}
function required(element: Element | null | undefined): HTMLElement {
  if (!element) throw new Error('Expected element not found')
  return element as HTMLElement
}
function byLabel(text: string) {
  const label = Array.from(document.querySelectorAll('label')).find(label => label.textContent === text)
  return label ? document.getElementById(label.htmlFor) : null
}
const byRole = (role: string) => document.querySelector(role === 'status' ? 'output, [role="status"]' : role === 'img' ? 'img' : `[role="${role}"]`)
export const screen = {
  getByLabelText: (text: string) => required(byLabel(text)),
  queryByLabelText: byLabel,
  getByText: (text: string) => required(Array.from(document.querySelectorAll('button')).find(button => button.textContent === text)),
  getByRole: (role: string) => required(byRole(role)),
  queryByRole: byRole,
  getByAltText: (text: string) => required(Array.from(document.querySelectorAll('img')).find(image => image.alt === text)),
}
export const fireEvent = {
  change(element: HTMLElement, event: { target: { value: string } }) {
    const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, event.target.value)
    act(() => {
      element.dispatchEvent(new Event(element instanceof HTMLInputElement ? 'input' : 'change', { bubbles: true }))
    })
  },
  click: (element: HTMLElement) => act(() => element.click()),
  error: (element: HTMLElement) => act(() => element.dispatchEvent(new Event('error'))),
}
