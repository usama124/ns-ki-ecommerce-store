'use client'

import type { PayloadAdminBarProps } from '@payloadcms/admin-bar'

import { useAuth } from '@/providers/Auth'
import dynamic from 'next/dynamic'
import { useSelectedLayoutSegments } from 'next/navigation'
import React from 'react'

const PayloadAdminBar = dynamic(() => import('@payloadcms/admin-bar').then((mod) => mod.PayloadAdminBar), { ssr: false })

const collectionLabels = {
  pages: {
    plural: 'Pages',
    singular: 'Page',
  },
  posts: {
    plural: 'Posts',
    singular: 'Post',
  },
  projects: {
    plural: 'Projects',
    singular: 'Project',
  },
}

const Title: React.FC = () => <span>Dashboard</span>

export const AdminBar: React.FC<{
  adminBarProps?: PayloadAdminBarProps
}> = (props) => {
  const { adminBarProps } = props || {}
  const segments = useSelectedLayoutSegments()
  const { user } = useAuth()
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - todo fix, not sure why this is erroring
  const collection = collectionLabels?.[segments?.[1]] ? segments?.[1] : 'pages'

  // Reuse the storefront auth lookup. Guests do not mount a second auth client
  // or download the admin toolbar bundle.
  if (!user?.roles?.includes('admin')) return null

  return (
    <div className="py-2 bg-black text-white">
      <div className="container">
        <PayloadAdminBar
          {...adminBarProps}
          adminPath="/store-admin"
          className="py-2 text-white"
          classNames={{
            controls: 'font-medium text-white',
            logo: 'text-white',
            user: 'text-white',
          }}
          cmsURL={process.env.NEXT_PUBLIC_SERVER_URL}
          collectionLabels={{
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - todo fix, not sure why this is erroring
            plural: collectionLabels[collection]?.plural || 'Pages',
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - todo fix, not sure why this is erroring
            singular: collectionLabels[collection]?.singular || 'Page',
          }}
          logo={<Title />}
          style={{
            backgroundColor: 'transparent',
            padding: 0,
            position: 'relative',
            zIndex: 'unset',
          }}
        />
      </div>
    </div>
  )
}
