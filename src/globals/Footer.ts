import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { link } from '@/fields/link'
import { revalidateFooter } from '@/hooks/revalidateFooter'

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
    update: adminOnly,
  },
  hooks: {
    afterChange: [revalidateFooter],
  },
  fields: [
    {
      name: 'tagline',
      type: 'text',
      label: 'Brand Tagline',
    },
    {
      name: 'columns',
      type: 'array',
      label: 'Footer Columns',
      maxRows: 4,
      fields: [
        {
          name: 'heading',
          type: 'text',
          required: true,
        },
        {
          name: 'links',
          type: 'array',
          maxRows: 10,
          fields: [
            link({
              appearances: false,
            }),
          ],
        },
      ],
    },
    {
      name: 'socialLinks',
      type: 'group',
      label: 'Social Media Links',
      fields: [
        {
          name: 'instagram',
          type: 'text',
          label: 'Instagram URL',
        },
        {
          name: 'facebook',
          type: 'text',
          label: 'Facebook URL',
        },
        {
          name: 'tiktok',
          type: 'text',
          label: 'TikTok URL',
        },
        {
          name: 'youtube',
          type: 'text',
          label: 'YouTube URL',
        },
        {
          name: 'whatsapp',
          type: 'text',
          label: 'WhatsApp Number (with country code, e.g. 923001234567)',
        },
      ],
    },
    {
      name: 'paymentNote',
      type: 'text',
      label: 'Payment Methods Note',
      admin: { readOnly: true, description: 'Legacy note retained for compatibility. The visible payment strip is generated automatically from Site Settings → Enabled Payment Methods.' },
      defaultValue: 'We accept Bank / Raast Transfer & EasyPaisa',
    },
    {
      name: 'copyrightText',
      type: 'text',
      label: 'Copyright Text',
      defaultValue: "N's KI. All rights reserved.",
    },
    // Legacy navItems kept for backward compat (not displayed in new footer)
    {
      name: 'navItems',
      type: 'array',
      label: 'Quick Links (legacy)',
      admin: {
        description: 'Kept for backward compatibility. Use Columns above instead.',
      },
      maxRows: 6,
      fields: [
        link({
          appearances: false,
        }),
      ],
    },
  ],
}
