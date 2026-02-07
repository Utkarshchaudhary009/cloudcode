'use client'

import { ReviewRuleForm } from '@/components/review-rules/review-rule-form'
import { useRouter } from 'next/navigation'

export default function NewReviewRulePage() {
  const router = useRouter()

  return (
    <div className="container py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Review Rule</h1>
        <p className="text-muted-foreground">Define a custom rule for automated code reviews</p>
      </div>
      <ReviewRuleForm onSuccess={() => router.push('/settings/review-rules')} />
    </div>
  )
}
