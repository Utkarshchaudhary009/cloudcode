import { db } from '@/lib/db/client'
import { fixRules } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import type { AnalysisResult, MatchedRule } from '../../types'

export async function findMatchingRule(subscriptionId: string, analysis: AnalysisResult): Promise<MatchedRule | null> {
  const rules = await db
    .select()
    .from(fixRules)
    .where(and(eq(fixRules.subscriptionId, subscriptionId), eq(fixRules.enabled, true)))

  for (const rule of rules) {
    try {
      const pattern = new RegExp(rule.errorPattern, 'i')
      if (pattern.test(analysis.errorMessage) || pattern.test(analysis.errorContext)) {
        return {
          id: rule.id,
          name: rule.name,
          skipFix: rule.skipFix ?? false,
          customPrompt: rule.customPrompt,
        }
      }
    } catch {
      // Invalid regex, skip
    }
  }

  return null
}
