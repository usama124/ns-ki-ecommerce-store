import { LoginForm } from '@/components/forms/LoginForm'
import { RenderParams } from '@/components/RenderParams'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export default async function Login() {
  return (
    <div className="container">
      <div className="max-w-xl mx-auto my-12">
        <RenderParams />
        <h1 className="mb-4 text-[1.8rem]">Log in</h1>
        <p className="mb-8">{`Manage your N's KI customer account and view past orders.`}</p>
        <LoginForm />
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Login or create an account to get started.',
  openGraph: {
    title: 'Login',
    url: '/login',
  },
  title: 'Login',
}
