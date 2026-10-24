import { getSalePriceDetails } from '@/utilities/getSalePrice'
import { privateJSON, readJSON, RequestError, requestError, requireAdmin } from '@/utilities/apiSecurity'

export async function GET(req: Request) {
  try {
    const { payload, user, overrideAccess } = await requireAdmin(req)

    let saleSettings: any = null
    try {
      saleSettings = await payload.findGlobal({
        slug: 'sale-settings' as any,
        user,
        overrideAccess,
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
        user,
        overrideAccess,
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
          user,
          overrideAccess,
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

    return privateJSON({
      saleSettings,
      categories,
      activeProducts,
      isLive,
    })
  } catch (error) {
    return requestError(error)
  }
}

export async function POST(req: Request) {
  try {
    const { payload, user, overrideAccess } = await requireAdmin(req)
    const body = await readJSON(req)
    if (body.discountPercentage !== undefined && (typeof body.discountPercentage !== 'number' || !Number.isFinite(body.discountPercentage) || body.discountPercentage < 1 || body.discountPercentage > 99)) {
      throw new RequestError('Discount must be between 1 and 99 percent.')
    }
    if (body.targetedCategories !== undefined && (!Array.isArray(body.targetedCategories) || body.targetedCategories.length > 100)) throw new RequestError('Invalid target categories.')

    if (body.action === 'end_immediately') {
      const updated = await payload.updateGlobal({
        slug: 'sale-settings' as any,
        user,
        overrideAccess,
        data: {
          isActive: false,
        } as any,
      })
      return privateJSON({
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
      user,
      overrideAccess,
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

    return privateJSON({ success: true, saleSettings: updated })
  } catch (error) {
    return requestError(error)
  }
}
