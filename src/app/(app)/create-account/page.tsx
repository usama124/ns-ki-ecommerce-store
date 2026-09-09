import type { Metadata } from 'next'
import { RenderParams } from '@/components/RenderParams'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'
import { CreateAccountForm } from '@/components/forms/CreateAccountForm'

export const dynamic = 'force-dynamic'

export default async function CreateAccount() {
  return (
    <div className="container py-16">
      <h1 className="text-xl mb-4">Create Account</h1>
      <RenderParams />
      <CreateAccountForm />
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Create an account or log in to your existing account.',
  openGraph: mergeOpenGraph({
    title: 'Account',
    url: '/account',
  }),
  title: 'Account',
}
