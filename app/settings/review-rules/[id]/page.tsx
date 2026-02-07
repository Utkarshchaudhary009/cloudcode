import { Suspense } from 'react'
import { ReviewRuleForm } from '@/components/review-rules/review-rule-form'

export default function EditReviewRulePage({ params }: { params: { id: string } }) {
  return (
    <div className="container py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Edit Review Rule</h1>
        <p className="text-muted-foreground">Modify your code review rule configuration</p>
      </div>
      <Suspense fallback={<div>Loading rule...</div>}>
        <ReviewRuleForm ruleId={params.id} onSuccess={() => (window.location.href = '/settings/review-rules')} />
      </Suspense>
    </div>
  )
}
