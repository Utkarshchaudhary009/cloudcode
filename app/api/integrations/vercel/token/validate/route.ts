import { NextRequest } from 'next/server'
import { providers } from '@/lib/integrations/registry'
import { listVercelProjects } from '@/lib/integrations/vercel/client'

function getGreetingMessage(username: string): string {
  const greetings = [
    `Hi ${username}! Let me check your account...`,
    `Welcome, ${username}! Verifying your token...`,
    `Hello ${username}! Connecting to Vercel...`,
  ]
  return greetings[Math.floor(Math.random() * greetings.length)]
}

function getProjectCountMessage(count: number): string {
  if (count === 0) {
    return "Account verified! No projects yet, but you're all set to connect."
  }
  if (count === 1) {
    return 'Great! Found 1 project. Ready to connect!'
  }
  if (count <= 5) {
    return `Great! Found ${count} projects. Ready to connect!`
  }
  if (count <= 20) {
    return `Nice! Found ${count} projects. You're all set!`
  }
  return `Wow! Found ${count} projects. Impressive work! Ready to connect.`
}

function createStreamMessage(type: string, data: Record<string, unknown>): string {
  return JSON.stringify({ type, ...data }) + '\n'
}

export async function POST(req: NextRequest) {
  const { token } = await req.json()

  if (!token || token.length < 10) {
    return new Response(createStreamMessage('error', { error: 'Valid token required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/x-ndjson' },
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (message: string) => {
        controller.enqueue(new TextEncoder().encode(message))
      }

      try {
        const provider = providers.vercel
        if (!provider) {
          send(createStreamMessage('error', { error: 'Provider not found' }))
          controller.close()
          return
        }

        const userInfo = await provider.validateToken(token)
        send(createStreamMessage('progress', { message: getGreetingMessage(userInfo.username) }))

        // Fetch available teams (including personal account scope)
        let teams: any[] = []
        try {
          const { Vercel } = await import('@vercel/sdk')
          const teamsResponse = await new Vercel({ bearerToken: token }).teams.getTeams({})
          teams = Array.isArray(teamsResponse.teams) ? teamsResponse.teams : []
        } catch (error) {
          console.error('Failed to fetch teams during validation')
        }

        let projectCount = 0
        try {
          const projects = await listVercelProjects(undefined, token)
          projectCount = Array.isArray(projects) ? projects.length : 0
        } catch {
          console.error('Failed to fetch projects during validation')
        }

        send(createStreamMessage('progress', { message: getProjectCountMessage(projectCount) }))
        send(
          createStreamMessage('complete', {
            valid: true,
            username: userInfo.username,
            projectCount,
            teams: teams.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
          }),
        )
        controller.close()
      } catch (error) {
        console.error('Token validation failed')
        send(createStreamMessage('error', { error: 'Token is invalid or expired' }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
    },
  })
}
