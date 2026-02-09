import { generateText } from 'ai'
import { getAIModel } from './ai-model-resolver'
import { type OpenCodeProviderId } from '@/lib/opencode/providers'

export interface CommitMessageOptions {
  description: string
  repoName?: string
  context?: string
  provider?: OpenCodeProviderId
  apiKey?: string
  modelId?: string
}

export async function generateCommitMessage(options: CommitMessageOptions): Promise<string> {
  const { description, repoName, context, provider = 'openai', apiKey, modelId } = options

  // Fallback check
  if (!apiKey && !process.env.AI_GATEWAY_API_KEY) {
    console.warn('No API key or AI_GATEWAY_API_KEY provided for commit message generation')
    return createFallbackCommitMessage(description)
  }

  // Create the prompt for commit message generation
  const prompt = `Generate a concise, descriptive Git commit message for the following change:

Description: ${description}
${repoName ? `Repository: ${repoName}` : ''}
${context ? `Additional context: ${context}` : ''}

Requirements:
- Keep it under 72 characters (conventional commit message length)
- Be descriptive but concise
- Use imperative mood (e.g., "Add feature" not "Added feature")
- Use sentence case (capitalize first letter only)
- Make it clear and meaningful
- No quotes, special formatting, or line breaks
- Do not include sensitive information like user IDs, file paths, or credentials

Examples of good commit messages:
- Add user authentication
- Fix memory leak in parser
- Update dependencies to latest versions
- Remove deprecated API endpoints

Return ONLY the commit message, nothing else.`

  try {
    // Generate commit message using the resolved model
    const model = getAIModel(provider, apiKey, modelId)

    const result = await generateText({
      model,
      prompt,
      temperature: 0.3,
    })

    // Clean up the response (remove any extra whitespace or quotes)
    const commitMessage = result.text.trim().replace(/^["']|["']$/g, '')

    // Validate the commit message length
    if (commitMessage.length > 72) {
      return commitMessage.substring(0, 69) + '...'
    }

    return commitMessage
  } catch (error) {
    console.error('Commit message generation error:', error)
    // Return a fallback commit message based on the description
    return createFallbackCommitMessage(description)
  }
}

export function createFallbackCommitMessage(description: string): string {
  // If description is short enough, use it as the commit message
  if (description.length <= 72) {
    return description
  }

  // Otherwise, truncate and add ellipsis
  return description.substring(0, 69) + '...'
}
