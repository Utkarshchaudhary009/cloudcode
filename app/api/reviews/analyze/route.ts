import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { accounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { diff, rules, repoUrl, prTitle } = body

  const account = await db.select().from(accounts).where(eq(accounts.userId, session.user.id)).limit(1)

  if (!account[0]) {
    return NextResponse.json({ error: 'GitHub account not found' }, { status: 404 })
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json({ error: 'AI Gateway API key not configured' }, { status: 500 })
  }

  const prompt = `You are a code reviewer. Review the following pull request diff.

Repository: ${repoUrl}
PR Title: ${prTitle}

Diff:
${diff}

${
  rules && rules.length > 0
    ? `
Review Rules to apply:
${rules.map((rule: any) => `- ${rule.name}: ${rule.prompt} (severity: ${rule.severity})`).join('\n')}
`
    : ''
}

Provide a structured review with:
1. Summary of the PR
2. Findings (bugs, security issues, code quality issues, suggestions)
3. Overall code quality score (0-100)

Format your response as JSON:
{
  "summary": "brief summary",
  "items": [
    {
      "file": "path/to/file.ts",
      "line": 123,
      "severity": "error|warning|info",
      "message": "description of issue",
      "suggestion": "how to fix (optional)"
    }
  ],
  "score": 85
}`

  const response = await fetch('https://ai-gateway.kilo.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('AI Gateway error:', errorText)
    return NextResponse.json({ error: 'Failed to analyze review' }, { status: 500 })
  }

  const data = await response.json()

  try {
    const parsed = JSON.parse(data.choices[0].message.content)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }
}
