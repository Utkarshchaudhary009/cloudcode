import { Vercel } from '@vercel/sdk'

interface CreateProjectParams {
  name: string
  gitRepository?: {
    type: 'github'
    repo: string // Format: "owner/repo"
  }
  framework?: string | null
}

interface CreateProjectResponse {
  id: string
  name: string
  accountId: string
  framework: string | null
  link?: {
    type: string
    repo: string
    repoId: number
  }
}

export interface VercelProject {
  id: string
  name: string
  framework: string | null
  repoUrl: string | null
  latestDeploymentStatus: 'READY' | 'ERROR' | 'BUILDING' | 'QUEUED' | null
  latestDeploymentUrl: string | null
  updatedAt: number
}

/**
 * List all Vercel projects for the authenticated user/team
 * Uses the official @vercel/sdk which targets GET /v10/projects
 * @param accessToken - Vercel access token
 * @param teamId - Optional team ID (omit for personal account)
 * @returns Array of projects with key info
 */
export async function listProjects(accessToken: string, teamId?: string): Promise<VercelProject[]> {
  try {
    const vercel = new Vercel({
      bearerToken: accessToken,
    })

    const allProjects: VercelProject[] = []
    let from: string | undefined
    let hasMore = true

    while (hasMore) {
      const result = await vercel.projects.getProjects({
        ...(teamId ? { teamId } : {}),
        limit: '100',
        ...(from ? { from } : {}),
      })

      const projects = Array.isArray(result)
        ? result
        : result && typeof result === 'object' && 'projects' in result
          ? (result as { projects: Array<Record<string, unknown>> }).projects
          : []

      for (const project of projects) {
        const p = project as Record<string, unknown>
        const link = p.link as Record<string, unknown> | undefined
        const latestDeployments = p.latestDeployments as Array<Record<string, unknown>> | undefined

        allProjects.push({
          id: p.id as string,
          name: p.name as string,
          framework: (p.framework as VercelProject['framework']) || null,
          repoUrl:
            link && link.type === 'github' && link.org && link.repo
              ? `https://github.com/${link.org}/${link.repo}`
              : null,
          latestDeploymentStatus:
            (latestDeployments?.[0]?.readyState as VercelProject['latestDeploymentStatus']) || null,
          latestDeploymentUrl: latestDeployments?.[0]?.url ? `https://${latestDeployments[0].url}` : null,
          updatedAt: (p.updatedAt as number) || Date.now(),
        })
      }

      const pagination =
        !Array.isArray(result) && result && typeof result === 'object' && 'pagination' in result
          ? (result as { pagination: { next?: number | null } }).pagination
          : null

      if (projects.length < 100 || !pagination?.next) {
        hasMore = false
      } else {
        from = String(pagination.next)
      }
    }

    return allProjects
  } catch (error) {
    console.error('Error listing Vercel projects:', error)
    throw error
  }
}

/**
 * Create a Vercel project using the official SDK
 * @param accessToken - Vercel OAuth access token
 * @param teamId - Team ID (for teams) or User ID (for personal accounts)
 * @param params - Project creation parameters
 * @returns The created project data
 */
export async function createProject(
  accessToken: string,
  teamId: string,
  params: CreateProjectParams,
): Promise<CreateProjectResponse | undefined> {
  try {
    const vercel = new Vercel({
      bearerToken: accessToken,
    })

    // Use the SDK as shown in the Vercel docs
    const requestBody: Record<string, unknown> = {
      name: params.name,
      gitRepository: params.gitRepository
        ? {
            type: params.gitRepository.type,
            repo: params.gitRepository.repo,
          }
        : undefined,
    }

    // Only add framework if it's provided
    if (params.framework) {
      requestBody.framework = params.framework
    }

    const response = await vercel.projects.createProject({
      teamId, // Pass teamId at the top level
      requestBody: requestBody as any,
    })

    console.log('Successfully created Vercel project')
    return response as unknown as CreateProjectResponse
  } catch (error) {
    console.error('Error creating Vercel project:', error)

    // Check for permission errors
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 403) {
      console.error('Permission denied - user may need proper team permissions in Vercel')
    }

    return undefined
  }
}
