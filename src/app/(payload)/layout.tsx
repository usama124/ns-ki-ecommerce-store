/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import '@payloadcms/next/css'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import type { ServerFunctionClient } from 'payload'
import React from 'react'

import { importMap } from './admin/importMap.js'
import './custom.scss'

type Args = {
  children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

// NOTE: Payload's RootLayout does not expose a bodyProps prop in this version.
// The hydration warning on <body> (cz-shortcut-listen="true") is injected by browser
// extensions like Grammarly and cannot be suppressed here. suppressHydrationWarning
// on <html> via htmlProps is the best available fix for the current Payload CMS version.
const Layout = ({ children }: Args) => (
  <RootLayout
    config={config}
    htmlProps={{ suppressHydrationWarning: true }}
    importMap={importMap}
    serverFunction={serverFunction}
  >
    {children}
  </RootLayout>
)

export default Layout
