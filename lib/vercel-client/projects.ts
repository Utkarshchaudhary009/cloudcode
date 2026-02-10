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
 * @param accessToken - Vercel access token
 * @param teamId - Optional team ID (omit for personal account)
 * @returns Array of projects with key info
 */
export async function listProjects(accessToken: string, teamId?: string): Promise<VercelProject[]> {
  try {
    const vercel = new Vercel({
      bearerToken: accessToken,
    })

    const response = await vercel.projects.getProjects({
      teamId,
      limit: '100', // Get up to 100 projects
    })

    console.log(`[listProjects] response for teamId ${teamId}:`, JSON.stringify(response).substring(0, 500))

    // Response can be an array, or object with projects property, or potentially just the projects directly if it's a different SDK version behavior
    let projects: any[] = []
    if (Array.isArray(response)) {
      projects = response
    } else if (response && typeof response === 'object') {
      if ((response as any).projects && Array.isArray((response as any).projects)) {
        projects = (response as any).projects
      } else {
        // Log keys if projects not found where expected
        console.log(`[listProjects] response keys: ${Object.keys(response).join(', ')}`)
      }
    }

    console.log(`[listProjects] count for teamId ${teamId}: ${projects.length}`)
    if (projects.length > 0) {
      console.log(`[listProjects] first project sample: ${JSON.stringify(projects[0]).substring(0, 200)}`)
    }

    if (!projects || projects.length === 0) {
      return []
    }

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      framework: project.framework || null,
      repoUrl: project.link?.type === 'github' ? `https://github.com/${project.link.org}/${project.link.repo}` : null,
      latestDeploymentStatus:
        (project.latestDeployments?.[0]?.readyState as VercelProject['latestDeploymentStatus']) || null,
      latestDeploymentUrl: project.latestDeployments?.[0]?.url ? `https://${project.latestDeployments[0].url}` : null,
      updatedAt: project.updatedAt || Date.now(),
    }))
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
