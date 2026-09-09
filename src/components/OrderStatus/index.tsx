import { cn } from '@/utilities/cn'

type Props = {
  status: string
  className?: string
}

export const OrderStatus: React.FC<Props> = ({ status, className }) => {
  return (
    <div
      className={cn(
        'text-xs tracking-widest font-mono uppercase py-0.5 px-2.5 rounded w-fit',
        className,
        {
          'bg-yellow-100 text-yellow-800': status === 'pending_verification',
          'bg-blue-100 text-blue-800': status === 'confirmed' || status === 'processing',
          'bg-purple-100 text-purple-800': status === 'shipped',
          'bg-green-100 text-green-800': status === 'delivered',
          'bg-red-100 text-red-800': status === 'cancelled',
        },
      )}
    >
      {status?.replace('_', ' ')}
    </div>
  )
}
