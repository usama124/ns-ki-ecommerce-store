import { Banner } from '@payloadcms/ui'
import React from 'react'

import './index.scss'

const baseClass = 'before-dashboard'

export const BeforeDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to N's KI Payload Admin Dashboard!</h4>
      </Banner>
      Here&apos;s what you can do:
      <ul className={`${baseClass}__instructions`}>
        <li>
          {
            'Manage luxury categories, products, variants (with auto-SKUs), hero banners, shoppable video reels, and customer orders.'
          }
        </li>
        <li>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">Visit Storefront</a>
          {' to view your live Pakistani fashion website.'}
        </li>
      </ul>
    </div>
  )
}
