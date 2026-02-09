import { ReviewList } from '@/components/reviews/review-list'

export default function ReviewsPage() {
  return (
    <div className="flex-1 bg-background flex flex-col">
      <div className="container py-8">
        <ReviewList />
      </div>
    </div>
  )
}
