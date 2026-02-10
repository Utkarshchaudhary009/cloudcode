import { generateText } from 'ai'
import { getAIModel } from './ai-model-resolver'
import { type OpenCodeProviderId } from '@/lib/opencode/providers'

export interface DescriptionGenerationOptions {
  prompt: string
  repoName?: string
  context?: string
  provider?: OpenCodeProviderId
  apiKey?: string
  modelId?: string
  changes?: string
}

export async function generatePRDescription(options: DescriptionGenerationOptions): Promise<string> {
  const { prompt, repoName, context, provider = 'openai', apiKey, modelId, changes } = options

  // Fallback check
  if (!apiKey && !process.env.AI_GATEWAY_API_KEY) {
    console.warn('No API key or AI_GATEWAY_API_KEY provided for PR description generation')
    return `This PR addresses the following task:

${prompt}`
  }

  // Create the prompt for PR description generation
  const systemPrompt = `Generate a descriptive, well-structured Pull Request description for the following task:

User Request: ${prompt}
${repoName ? `Repository: ${repoName}` : ''}
${context ? `Additional context: ${context}` : ''}
${
  changes
    ? `Actual changes performed:
${changes}`
    : ''
}

Requirements:
- Use Markdown formatting
- Include a "Summary" section explaining what was done
- Include a "Changes" section listing key modifications (use bullet points)
- If applicable, include a "Testing" section
- Keep it professional and clear
- Avoid fluff or unnecessary introduction

Return ONLY the Markdown description, nothing else.`

  try {
    // Generate description using the resolved model
    const model = getAIModel(provider, apiKey, modelId)

    const result = await generateText({
      model,
      prompt: systemPrompt,
      temperature: 0.5,
    })

    return result.text.trim()
  } catch (error) {
    console.error('PR description generation error:', error)
    return `This PR addresses the following task:

${prompt}`
  }
}
