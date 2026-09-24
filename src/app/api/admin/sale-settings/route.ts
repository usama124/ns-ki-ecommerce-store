import { getSalePriceDetails } from '@/utilities/getSalePrice'
import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function GET() {
  try {
    const payload = await getPayload({ config })

    let saleSettings: any = null
    try {
      saleSettings = await payload.findGlobal({
        slug: 'sale-settings' as any,
        depth: 2,
      })
    } catch (dbErr: any) {
      console.warn(
        'sale-settings global table not yet pushed/initialized in DB:',
        dbErr?.message || dbErr,
      )
      saleSettings = {
        isActive: false,
        title: 'Flash Sale',
        startDate: null,
        endDate: null,
        discountPercentage: 20,
        targetedCategories: [],
        announcementText: '',
        enablePopup: true,
      }
    }

    let categories: any[] = []
    try {
      const categoriesRes = await payload.find({
        collection: 'categories',
        limit: 100,
        depth: 1,
      })
      categories = categoriesRes.docs.map((c: any) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parent: c.parent ? (typeof c.parent === 'object' ? c.parent.name : c.parent) : null,
      }))
    } catch (e: any) {
      console.warn('Could not fetch categories:', e?.message || e)
    }

    // Calculate targeted active products
    let activeProducts: any[] = []
    if (saleSettings && saleSettings.isActive) {
      try {
        const productsRes = await payload.find({
          collection: 'products',
          limit: 200,
          depth: 2,
        })

        activeProducts = productsRes.docs
          .map((p: any) => {
            const pricing = getSalePriceDetails(p, saleSettings)
            return {
              id: p.id,
              title: p.title,
              slug: p.slug,
              primaryCategory:
                typeof p.primaryCategory === 'object' ? p.primaryCategory?.name : 'General',
              image:
                p.images?.[0]?.image && typeof p.images[0].image === 'object'
                  ? p.images[0].image?.url
                  : null,
              basePricePKR: p.basePricePKR,
              effectivePrice: pricing.effectivePrice,
              isOnSale: pricing.isOnSale,
              discountPercentage: pricing.discountPercentage,
            }
          })
          .filter((p: any) => p.isOnSale)
      } catch (e: any) {
        console.warn('Could not calculate active products:', e?.message || e)
      }
    }

    const now = Date.now()
    const start = saleSettings?.startDate ? new Date(saleSettings.startDate).getTime() : 0
    const end = saleSettings?.endDate ? new Date(saleSettings.endDate).getTime() : Infinity
    const isLive = Boolean(saleSettings?.isActive && now >= start && now <= end)

    return NextResponse.json({
      saleSettings,
      categories,
      activeProducts,
      isLive,
    })
  } catch (error: any) {
    console.error('Error fetching sale settings:', error)
    return NextResponse.json(
      {
        saleSettings: {
          isActive: false,
          title: 'Flash Sale',
          discountPercentage: 20,
          targetedCategories: [],
          announcementText: '',
          enablePopup: true,
        },
        categories: [],
        activeProducts: [],
        isLive: false,
        error: error.message || 'Database initializing',
      },
      { status: 200 },
    )
  }
}

export async function POST(req: Request) {
  try {
    const payload = await getPayload({ config })
    const body = await req.json()

    if (body.action === 'end_immediately') {
      const updated = await payload.updateGlobal({
        slug: 'sale-settings' as any,
        data: {
          isActive: false,
        } as any,
      })
      return NextResponse.json({
        success: true,
        message: 'Sale ended immediately',
        saleSettings: updated,
      })
    }

    const {
      isActive,
      title,
      startDate,
      endDate,
      discountPercentage,
      targetedCategories,
      announcementText,
      enablePopup,
    } = body

    const updated = await payload.updateGlobal({
      slug: 'sale-settings' as any,
      data: {
        isActive: Boolean(isActive),
        title: title || 'Flash Sale',
        startDate: startDate || null,
        endDate: endDate || null,
        discountPercentage: Number(discountPercentage) || 20,
        targetedCategories: Array.isArray(targetedCategories) ? targetedCategories : [],
        announcementText: announcementText || '',
        enablePopup: Boolean(enablePopup),
      } as any,
    })

    return NextResponse.json({ success: true, saleSettings: updated })
  } catch (error: any) {
    console.error('Error updating sale settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update sale settings' },
      { status: 500 },
    )
  }
}
