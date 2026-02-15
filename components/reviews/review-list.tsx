'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ReviewScoreBadge } from './review-score-badge'
import { useRouter } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { getStatusIcon, getStatusColor } from '@/lib/utils/review'

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
      console.error('Error fetching reviews')
    } finally {
      setLoading(false)
    }
  }

  const totalReviews = reviews.length
  const completedCount = reviews.filter((review) => review.status === 'completed').length
  const inProgressCount = reviews.filter((review) => review.status === 'in_progress').length
  const errorCount = reviews.filter((review) => review.status === 'error').length

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading reviews...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Reviews</h1>
            <p className="text-muted-foreground">Track automated PR reviews and outcomes.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/settings/review-rules">
              <Button variant="outline" size="sm">
                Review Rules
              </Button>
            </Link>
            <Link href="/settings/integrations">
              <Button size="sm">Connect GitHub</Button>
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total reviews</p>
              <p className="text-2xl font-semibold">{totalReviews}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-2xl font-semibold">{completedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">In progress</p>
              <p className="text-2xl font-semibold">{inProgressCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Needs attention</p>
              <p className="text-2xl font-semibold">{errorCount}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-muted-foreground">No reviews yet</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Connect the GitHub app to start automatic PR reviews. Once enabled, every pull request will surface
              findings and a summary here.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href="/settings/integrations">
                <Button size="sm">Connect GitHub</Button>
              </Link>
              <Link href="/settings/review-rules">
                <Button size="sm" variant="outline">
                  Configure rules
                </Button>
              </Link>
            </div>
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
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <CardTitle className="text-lg">{review.prTitle || 'Untitled review'}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2">
                      <ExternalLink className="h-3 w-3" />
                      <span className="text-xs">{review.repoUrl || 'Repository not set'}</span>
                      <Badge variant="outline" className="text-[10px]">
                        PR #{review.prNumber ?? '—'}
                      </Badge>
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusIcon(review.status)}
                    <Badge variant={getStatusColor(review.status)} className="capitalize">
                      {review.status?.replace('_', ' ') || 'queued'}
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
