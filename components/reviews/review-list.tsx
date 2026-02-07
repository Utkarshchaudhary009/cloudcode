'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ReviewScoreBadge } from './review-score-badge'
import { ReviewFindingCard } from './review-finding-card'
import { useRouter } from 'next/navigation'
import { ExternalLink, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

export function ReviewList() {
  const router = useRouter()
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReviews()
  }, [])

  const fetchReviews = async () => {
    try {
      const response = await fetch('/api/reviews')
      const data = await response.json()
      setReviews(data.reviews || [])
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'in_progress':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default'
      case 'in_progress':
        return 'secondary'
      case 'error':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">PR Reviews</h1>
        <p className="text-muted-foreground">View all code review history</p>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No reviews yet</p>
            <p className="text-sm text-muted-foreground">
              Connect your GitHub repository to enable automatic PR reviews
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reviews.map((review) => (
            <Card
              key={review.id}
              className="cursor-pointer hover:shadow-md"
              onClick={() => router.push(`/reviews/${review.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-lg">{review.prTitle}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <ExternalLink className="h-3 w-3" />
                      {review.repoUrl} · PR #{review.prNumber}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(review.status)}
                    <Badge variant={getStatusColor(review.status)} className="capitalize">
                      {review.status.replace('_', ' ')}
                    </Badge>
                    {review.score !== null && <ReviewScoreBadge score={review.score} />}
                  </div>
                </div>
              </CardHeader>
              {review.summary && (
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{review.summary}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
