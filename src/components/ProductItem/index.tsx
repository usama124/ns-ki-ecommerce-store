import { Media } from '@/components/Media'
import { Price } from '@/components/Price'
import { Media as MediaType, Product } from '@/payload-types'
import Link from 'next/link'

type Props = {
  product: Product
  style?: 'compact' | 'default'
  variantSize?: string
  quantity?: number
}

export const ProductItem: React.FC<Props> = ({
  product,
  style = 'default',
  quantity,
  variantSize,
}) => {
  const { title } = product

  const firstImage =
    product.images?.[0]?.image && typeof product.images[0].image !== 'string'
      ? (product.images[0].image as MediaType)
      : undefined

  const itemPrice = product.basePricePKR
  const itemURL = `/products/${product.slug}`

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-stretch justify-stretch h-20 w-20 p-2 rounded-lg border">
        <div className="relative w-full h-full">
          {firstImage && (
            <Media className="" fill imgClassName="rounded-lg object-cover" resource={firstImage} />
          )}
        </div>
      </div>
      <div className="flex grow justify-between items-center">
        <div className="flex flex-col gap-1">
          <p className="font-medium text-lg">
            <Link href={itemURL}>{title}</Link>
          </p>
          {variantSize && (
            <p className="text-sm font-mono text-primary/50 tracking-widest">
              Size: {variantSize}
            </p>
          )}
          {quantity && (
            <div>
              {'x'}
              {quantity}
            </div>
          )}
        </div>

        {itemPrice && quantity && (
          <div className="text-right">
            <p className="font-medium text-lg">Subtotal</p>
            <Price
              className="font-mono text-primary/50 text-sm"
              amount={itemPrice * quantity}
            />
          </div>
        )}
      </div>
    </div>
  )
}
