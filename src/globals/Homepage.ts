import type { GlobalConfig } from 'payload'
import { adminOnly } from '@/access/adminOnly'

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  access: {
    read: () => true,
    update: adminOnly,
  },
  admin: {
    group: 'Content',
  },
  label: 'Homepage',
  fields: [
    {
      name: 'heroSlider',
      type: 'array',
      label: 'Hero Banner Slides',
      admin: {
        description: 'Add slides for the homepage hero banner.',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'mediaType',
          type: 'select',
          defaultValue: 'image',
          options: [
            { label: 'Image', value: 'image' },
            { label: 'Video', value: 'video' },
          ],
        },
        {
          name: 'desktopMedia',
          type: 'upload',
          relationTo: 'media',
          label: 'Desktop Image/Video',
          required: true,
        },
        {
          name: 'mobileMedia',
          type: 'upload',
          relationTo: 'media',
          label: 'Mobile Image/Video (optional, uses desktop if blank)',
        },
        {
          name: 'heading',
          type: 'text',
          label: 'Slide Heading',
        },
        {
          name: 'subheading',
          type: 'text',
          label: 'Slide Subheading',
        },
        {
          name: 'ctaLabel',
          type: 'text',
          label: 'CTA Button Label',
          defaultValue: 'Shop Now',
        },
        {
          name: 'ctaLink',
          type: 'text',
          label: 'CTA Button Link',
          defaultValue: '/shop',
        },
      ],
    },
    {
      name: 'shoppableVideos',
      type: 'array',
      label: 'Shop by Video Reels',
      admin: {
        description: '9:16 vertical video reels for the shoppable video section.',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Reel Title',
        },
        {
          name: 'video',
          type: 'upload',
          relationTo: 'media',
          label: 'Video File (MP4, 9:16)',
          required: true,
        },
        {
          name: 'poster',
          type: 'upload',
          relationTo: 'media',
          label: 'Poster/Thumbnail Image',
        },
        {
          name: 'linkedProduct',
          type: 'relationship',
          relationTo: 'products',
          label: 'Linked Product',
        },
      ],
    },
    {
      name: 'featuredSectionTitle',
      type: 'text',
      label: 'Featured Products Section Title',
      defaultValue: 'Featured Collection',
    },
  ],
}
