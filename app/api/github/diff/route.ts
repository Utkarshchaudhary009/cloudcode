import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { accounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { decrypt } from '@/lib/crypto'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { userId, repoUrl, prNumber } = body

  if (!userId || !repoUrl || !prNumber) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const account = await db.select().from(accounts).where(eq(accounts.userId, userId)).limit(1)

  if (!account[0]) {
    return NextResponse.json({ error: 'GitHub account not found' }, { status: 404 })
  }

  const accessToken = decrypt(account[0].accessToken)

  const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!urlMatch) {
    return NextResponse.json({ error: 'Invalid GitHub repository URL' }, { status: 400 })
  }

  const [, owner, repo] = urlMatch

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3.diff',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('GitHub API error:', errorText)
    return NextResponse.json({ error: 'Failed to fetch PR diff' }, { status: response.status })
  }

  const diff = await response.text()

  return NextResponse.json({ diff })
}
