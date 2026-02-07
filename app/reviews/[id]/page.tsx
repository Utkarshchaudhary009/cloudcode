import { Suspense } from 'react'
import { ReviewDetail } from '@/components/reviews/review-detail'

export default function ReviewDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="container py-8 max-w-5xl">
      <Suspense fallback={<div>Loading review...</div>}>
        <ReviewDetail reviewId={params.id} />
      </Suspense>
    </div>
  )
}
