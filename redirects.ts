import type { NextConfig } from 'next'

export const redirects: NextConfig['redirects'] = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header' as const,
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  const adminRedirect = {
    source: '/admin',
    destination: '/store-admin',
    permanent: false,
  }

  const adminSubpathRedirect = {
    source: '/admin/:path*',
    destination: '/store-admin/:path*',
    permanent: false,
  }

  return [internetExplorerRedirect, adminRedirect, adminSubpathRedirect]
}
