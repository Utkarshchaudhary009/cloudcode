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

    let response: any
    let projects: any[] = []
    
    console.log(`[listProjects] Starting fetch for teamId: ${teamId || 'personal'}`)

    // 1. Try V9 endpoint (standard)
    try {
      const url = teamId 
        ? `https://api.vercel.com/v9/projects?teamId=${teamId}&limit=100` 
        : 'https://api.vercel.com/v9/projects?limit=100'
      
      console.log(`[listProjects] Trying API V9: ${url}`)
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store'
      })
      
      if (res.ok) {
        const data = await res.json()
        projects = data.projects || data.data || (Array.isArray(data) ? data : [])
        console.log(`[listProjects] V9 success. Found ${projects.length} projects. Keys: ${Object.keys(data).join(', ')}`)
      } else {
        console.error(`[listProjects] V9 failed: ${res.status} ${await res.text()}`)
      }
    } catch (err) {
      console.error(`[listProjects] V9 error:`, err)
    }

    // 2. If V9 empty, try V4 endpoint (legacy/alternative)
    if (projects.length === 0) {
      try {
        const url = teamId 
          ? `https://api.vercel.com/v4/projects?teamId=${teamId}` 
          : 'https://api.vercel.com/v4/projects'
        
        console.log(`[listProjects] Trying API V4: ${url}`)
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store'
        })
        
        if (res.ok) {
          const data = await res.json()
          const v4Projects = data.projects || (Array.isArray(data) ? data : [])
          if (v4Projects.length > 0) {
            projects = v4Projects
            console.log(`[listProjects] V4 success. Found ${projects.length} projects.`)
          }
        }
      } catch (err) {
        console.error(`[listProjects] V4 error:`, err)
      }
    }

    // 3. Last resort: Try SDK
    if (projects.length === 0) {
      try {
        console.log(`[listProjects] Trying SDK as last resort`)
        const sdkRes = await vercel.projects.getProjects({ teamId, limit: '100' })
        projects = (sdkRes as any).projects || (Array.isArray(sdkRes) ? sdkRes : [])
        console.log(`[listProjects] SDK result count: ${projects.length}`)
      } catch (sdkErr) {
        console.error(`[listProjects] SDK error:`, sdkErr)
      }
    }

    console.log(`[listProjects] Final count for ${teamId || 'personal'}: ${projects.length}`)
    
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
