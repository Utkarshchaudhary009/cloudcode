'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ReviewScoreBadge } from './review-score-badge'
import { ReviewFindingCard } from './review-finding-card'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2, FileText, ExternalLink } from 'lucide-react'

interface ReviewDetailProps {
  reviewId: string
}

export function ReviewDetail({ reviewId }: ReviewDetailProps) {
  const router = useRouter()
  const [review, setReview] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReview()
  }, [reviewId])

  const fetchReview = async () => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}`)
      if (!response.ok) throw new Error('Review not found')
      const data = await response.json()
      setReview(data.review)
    } catch (error) {
      console.error('Error fetching review:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFindingsBySeverity = () => {
    if (!review?.findings) return {}
    return {
      error: review.findings.filter((f: any) => f.severity === 'error'),
      warning: review.findings.filter((f: any) => f.severity === 'warning'),
      info: review.findings.filter((f: any) => f.severity === 'info'),
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  if (!review) {
    return <div className="flex items-center justify-center h-64">Review not found</div>
  }

  const findingsBySeverity = getFindingsBySeverity()

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Reviews
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-xl">{review.prTitle}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <ExternalLink className="h-3 w-3" />
                {review.repoUrl}
                <FileText className="h-3 w-3" />
                PR #{review.prNumber}
                <Badge variant={review.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                  {review.status.replace('_', ' ')}
                </Badge>
              </CardDescription>
            </div>
            {review.status === 'completed' && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                {review.score !== null && <ReviewScoreBadge score={review.score} />}
              </div>
            )}
            {review.status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
            {review.status === 'in_progress' && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
          </div>
        </CardHeader>
        {review.summary && (
          <CardContent>
            <h3 className="font-semibold mb-2">Summary</h3>
            <p className="text-sm text-muted-foreground">{review.summary}</p>
          </CardContent>
        )}
      </Card>

      {findingsBySeverity.error && findingsBySeverity.error.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Errors ({findingsBySeverity.error.length})
          </h2>
          <div className="grid gap-4">
            {findingsBySeverity.error.map((finding: any, i: number) => (
              <ReviewFindingCard key={i} finding={finding} />
            ))}
          </div>
        </div>
      )}

      {findingsBySeverity.warning && findingsBySeverity.warning.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Warnings ({findingsBySeverity.warning.length})</h2>
          <div className="grid gap-4">
            {findingsBySeverity.warning.map((finding: any, i: number) => (
              <ReviewFindingCard key={i} finding={finding} />
            ))}
          </div>
        </div>
      )}

      {findingsBySeverity.info && findingsBySeverity.info.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Suggestions ({findingsBySeverity.info.length})</h2>
          <div className="grid gap-4">
            {findingsBySeverity.info.map((finding: any, i: number) => (
              <ReviewFindingCard key={i} finding={finding} />
            ))}
          </div>
        </div>
      )}

      {review.status === 'completed' && !review.findings?.length && (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-semibold">No issues found</p>
            <p className="text-sm text-muted-foreground">This PR passed all review criteria</p>
          </CardContent>
        </Card>
      )}

      {review.completedAt && (
        <p className="text-sm text-muted-foreground">
          Review completed at {new Date(review.completedAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}
