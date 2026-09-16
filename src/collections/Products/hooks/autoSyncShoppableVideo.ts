import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

export const autoSyncShoppableVideo: CollectionAfterChangeHook = async ({
  doc,
  req,
}) => {
  try {
    const videoMediaId =
      typeof doc?.productVideo === 'object' && doc.productVideo !== null
        ? doc.productVideo.id
        : doc?.productVideo

    const posterMediaId = doc?.images?.[0]?.image
      ? typeof doc.images[0].image === 'object' && doc.images[0].image !== null
        ? doc.images[0].image.id
        : doc.images[0].image
      : null

    const isPublished = doc?._status === 'published' || doc?.status === 'published'
    const hasVideo = Boolean(videoMediaId)

    const homepage = await req.payload.findGlobal({
      slug: 'homepage',
      depth: 0,
    })

    const currentReels = Array.isArray(homepage?.shoppableVideos)
      ? [...homepage.shoppableVideos]
      : []

    const existingIndex = currentReels.findIndex((item: any) => {
      const linkedId =
        typeof item?.linkedProduct === 'object' && item.linkedProduct !== null
          ? item.linkedProduct.id
          : item?.linkedProduct
      return String(linkedId) === String(doc.id)
    })

    let modified = false

    if (isPublished && hasVideo) {
      if (existingIndex > -1) {
        currentReels[existingIndex] = {
          ...currentReels[existingIndex],
          title: doc.title,
          video: videoMediaId,
          poster: posterMediaId || currentReels[existingIndex].poster,
          linkedProduct: doc.id,
        }
        modified = true
      } else {
        currentReels.unshift({
          title: doc.title,
          video: videoMediaId,
          poster: posterMediaId,
          linkedProduct: doc.id,
        })
        modified = true
      }
    } else {
      if (existingIndex > -1) {
        currentReels.splice(existingIndex, 1)
        modified = true
      }
    }

    if (modified) {
      await req.payload.updateGlobal({
        slug: 'homepage',
        data: {
          shoppableVideos: currentReels,
        },
      })
    }
  } catch (error) {
    req.payload.logger.error({
      msg: '[autoSyncShoppableVideo] Error syncing product video to homepage global',
      err: error,
    })
  }
}

export const removeShoppableVideoOnDelete: CollectionAfterDeleteHook = async ({
  id,
  req,
}) => {
  try {
    const homepage = await req.payload.findGlobal({
      slug: 'homepage',
      depth: 0,
    })

    if (!Array.isArray(homepage?.shoppableVideos)) return

    const initialLength = homepage.shoppableVideos.length
    const updatedReels = homepage.shoppableVideos.filter((item: any) => {
      const linkedId =
        typeof item?.linkedProduct === 'object' && item.linkedProduct !== null
          ? item.linkedProduct.id
          : item?.linkedProduct
      return String(linkedId) !== String(id)
    })

    if (updatedReels.length !== initialLength) {
      await req.payload.updateGlobal({
        slug: 'homepage',
        data: {
          shoppableVideos: updatedReels,
        },
      })
    }
  } catch (error) {
    req.payload.logger.error({
      msg: '[removeShoppableVideoOnDelete] Error removing product video from homepage global',
      err: error,
    })
  }
}

