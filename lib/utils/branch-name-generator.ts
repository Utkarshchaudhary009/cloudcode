import { generateText } from 'ai'
import { customAlphabet } from 'nanoid'
import { getAIModel } from './ai-model-resolver'
import { type OpenCodeProviderId } from '@/lib/opencode/providers'

export interface BranchNameOptions {
  description: string
  repoName?: string
  context?: string
  provider?: OpenCodeProviderId
  apiKey?: string
  modelId?: string
}

export async function generateBranchName(options: BranchNameOptions): Promise<string> {
  const { description, repoName, context, provider = 'openai', apiKey, modelId } = options

  // Fallback check
  if (!apiKey && !process.env.AI_GATEWAY_API_KEY) {
    console.warn('No API key or AI_GATEWAY_API_KEY provided for branch name generation')
    // We don't have a task ID here, but we can return something generic that will be caught by the caller
    throw new Error('No API key available for branch name generation')
  }

  // Create the prompt for branch name generation
  const prompt = `Generate a concise, descriptive Git branch name for the following task:

Description: ${description}
${repoName ? `Repository: ${repoName}` : ''}
${context ? `Additional context: ${context}` : ''}

Requirements:
- Use lowercase letters, numbers, and hyphens only
- Keep it under 50 characters
- Be descriptive but concise
- Use conventional prefixes like feature/, fix/, chore/, docs/ when appropriate
- Make it readable and meaningful

Examples of good branch names:
- feature/user-authentication
- fix/memory-leak-in-parser
- chore/update-dependencies
- docs/api-documentation

Return ONLY the branch name, nothing else.`

  try {
    // Generate branch name using the resolved model
    const model = getAIModel(provider, apiKey, modelId)

    const result = await generateText({
      model,
      prompt,
      temperature: 0.3,
    })

    // Clean up the response (remove any extra whitespace or quotes)
    const baseBranchName = result.text.trim().replace(/^["']|["']$/g, '')

    // Generate a 6-character alphanumeric hash to avoid conflicts
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    const nanoid = customAlphabet(alphabet, 6)
    const hash = nanoid()
    const branchName = `${baseBranchName}-${hash}`

    // Validate the base branch name
    const branchNameRegex = /^[a-z0-9-\/]+$/
    if (!branchNameRegex.test(baseBranchName)) {
      // If AI failed to produce a valid branch name, use a sanitized version of the description
      const sanitized = baseBranchName.toLowerCase().replace(/[^a-z0-9]/g, '-')
      return `${sanitized.substring(0, 30)}-${hash}`
    }

    if (branchName.length > 50) {
      return `${baseBranchName.substring(0, 40)}-${hash}`
    }

    return branchName
  } catch (error) {
    console.error('Branch name generation error:', error)
    throw new Error(`Failed to generate branch name: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export function createFallbackBranchName(taskId: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  return `opencode/${timestamp}-${taskId.slice(0, 8)}`
}
