import { Suspense } from 'react'
import { ReviewDetail } from '@/components/reviews/review-detail'

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="flex-1 bg-background flex flex-col">
      <div className="container py-8 max-w-5xl">
        <Suspense fallback={<div>Loading review...</div>}>
          <ReviewDetail reviewId={id} />
        </Suspense>
      </div>
    </div>
  )
}
