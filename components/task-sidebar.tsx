'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Task } from '@/lib/db/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertCircle,
  Plus,
  Trash2,
  GitBranch,
  Loader2,
  Search,
  X,
  Clock,
  Settings,
  CheckCircle2,
  Home,
  ListTodo,
  ChevronDown,
  ChevronRight,
  FolderGit2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useTasks } from '@/components/app-layout'
import { useAtomValue } from 'jotai'
import { sessionAtom } from '@/lib/atoms/session'
import { githubConnectionAtom } from '@/lib/atoms/github-connection'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface TaskSidebarProps {
  tasks: Task[]
  width?: number
}

interface GitHubRepoInfo {
  name: string
  full_name: string
  owner: string
  description?: string
  private: boolean
  clone_url: string
  updated_at: string
  language?: string
}

// Main navigation items
const mainNavItems = [
  { href: '/', icon: Home, label: 'Home', exact: true },
  { href: '/tasks', icon: ListTodo, label: 'Tasks' },
  { href: '/scheduled-tasks', icon: Clock, label: 'Scheduled Tasks' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function TaskSidebar({ tasks, width = 288 }: TaskSidebarProps) {
  const pathname = usePathname()
  const { refreshTasks, toggleSidebar } = useTasks()
  const session = useAtomValue(sessionAtom)
  const githubConnection = useAtomValue(githubConnectionAtom)
  const isCollapsed = width < 100

  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteCompleted, setDeleteCompleted] = useState(true)
  const [deleteFailed, setDeleteFailed] = useState(true)
  const [deleteStopped, setDeleteStopped] = useState(true)

  // Repos state
  const [reposOpen, setReposOpen] = useState(true)
  const [repos, setRepos] = useState<GitHubRepoInfo[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [reposPage, setReposPage] = useState(1)
  const [hasMoreRepos, setHasMoreRepos] = useState(true)
  const [reposInitialized, setReposInitialized] = useState(false)
  const [repoSearchQuery, setRepoSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GitHubRepoInfo[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchPage, setSearchPage] = useState(1)
  const [searchHasMore, setSearchHasMore] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Close sidebar on mobile when clicking any link
  const handleLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      toggleSidebar()
    }
  }

  // Check if nav item is active
  const isNavActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(repoSearchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [repoSearchQuery])

  // Fetch search results
  const fetchSearchResults = useCallback(async (query: string, page: number, append: boolean = false) => {
    if (!query.trim()) {
      setSearchResults([])
      setSearchHasMore(false)
      return
    }

    setSearchLoading(true)
    try {
      const response = await fetch(
        `/api/github/user-repos?page=${page}&per_page=25&search=${encodeURIComponent(query)}`,
      )
      if (!response.ok) throw new Error('Failed to search repos')
      const data = await response.json()

      if (append) {
        setSearchResults((prev) => [...prev, ...data.repos])
      } else {
        setSearchResults(data.repos)
      }
      setSearchHasMore(data.has_more)
      setSearchPage(page)
    } catch (error) {
      console.error('Error searching repos')
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      fetchSearchResults(debouncedSearchQuery, 1)
    } else {
      setSearchResults([])
      setSearchHasMore(false)
    }
  }, [debouncedSearchQuery, fetchSearchResults])

  const displayedRepos = debouncedSearchQuery.trim() ? searchResults : repos
  const displayedHasMore = debouncedSearchQuery.trim() ? searchHasMore : hasMoreRepos
  const isSearching = debouncedSearchQuery.trim().length > 0

  // Fetch repos
  const fetchRepos = useCallback(
    async (page: number, append: boolean = false) => {
      if (reposLoading) return
      setReposLoading(true)
      try {
        const response = await fetch(`/api/github/user-repos?page=${page}&per_page=25`)
        if (!response.ok) throw new Error('Failed to fetch repos')
        const data = await response.json()

        if (append) {
          setRepos((prev) => [...prev, ...data.repos])
        } else {
          setRepos(data.repos)
        }
        setHasMoreRepos(data.has_more)
        setReposPage(page)
        setReposInitialized(true)
      } catch (error) {
        console.error('Error fetching repos')
      } finally {
        setReposLoading(false)
      }
    },
    [reposLoading],
  )

  // Load repos when GitHub is connected
  useEffect(() => {
    if (session.user && githubConnection.connected && !reposInitialized && !reposLoading) {
      fetchRepos(1)
    }
  }, [session.user, githubConnection.connected, reposInitialized, reposLoading, fetchRepos])

  // Reset repos when GitHub disconnected
  useEffect(() => {
    if (!githubConnection.connected) {
      setRepos([])
      setReposPage(1)
      setHasMoreRepos(true)
      setReposInitialized(false)
    }
  }, [githubConnection.connected])

  // Infinite scroll for repos
  useEffect(() => {
    const isLoading = isSearching ? searchLoading : reposLoading
    const hasMore = displayedHasMore

    if (!hasMore || isLoading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          if (isSearching) {
            fetchSearchResults(debouncedSearchQuery, searchPage + 1, true)
          } else {
            fetchRepos(reposPage + 1, true)
          }
        }
      },
      { threshold: 0.1 },
    )

    const currentRef = loadMoreRef.current
    if (currentRef) observer.observe(currentRef)

    return () => {
      if (currentRef) observer.unobserve(currentRef)
    }
  }, [
    displayedHasMore,
    reposLoading,
    searchLoading,
    reposPage,
    searchPage,
    isSearching,
    debouncedSearchQuery,
    fetchRepos,
    fetchSearchResults,
  ])

  // Delete tasks handler
  const handleDeleteTasks = async () => {
    if (!deleteCompleted && !deleteFailed && !deleteStopped) {
      toast.error('Please select at least one task type to delete')
      return
    }

    setIsDeleting(true)
    try {
      const actions = []
      if (deleteCompleted) actions.push('completed')
      if (deleteFailed) actions.push('failed')
      if (deleteStopped) actions.push('stopped')

      const response = await fetch(`/api/tasks?action=${actions.join(',')}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message)
        await refreshTasks()
        setShowDeleteDialog(false)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete tasks')
      }
    } catch (error) {
      console.error('Error deleting tasks')
      toast.error('Failed to delete tasks')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      className={cn(
        'pb-12 h-full border-r bg-background transition-all duration-300 ease-in-out flex flex-col',
        isCollapsed ? 'w-[60px]' : 'w-72',
      )}
      style={{ width: isCollapsed ? 60 : width }}
    >
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon
              const isActive = isNavActive(item.href, item.exact)

              if (isCollapsed) {
                return (
                  <TooltipProvider key={item.href} delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          onClick={handleLinkClick}
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:text-foreground md:h-8 md:w-8 mx-auto mb-1',
                            isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent',
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="sr-only">{item.label}</span>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="flex items-center gap-4">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              }

              return (
                <Link key={item.href} href={item.href} onClick={handleLinkClick}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn('w-full justify-start h-9 mb-1', isActive && 'bg-accent')}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Repos Section */}
      <div className={cn('flex-1 px-2 md:px-3', isCollapsed ? 'overflow-hidden' : 'overflow-y-auto')}>
        {isCollapsed ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    toggleSidebar()
                    setReposOpen(true)
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:h-8 md:w-8 mx-auto mt-2"
                >
                  <GitBranch className="h-5 w-5" />
                  <span className="sr-only">Repositories</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-4">
                Repositories
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Collapsible open={reposOpen} onOpenChange={setReposOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5" />
                  Repositories
                </span>
                {reposOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {!session.user ? (
                <Card>
                  <CardContent className="p-3 text-center text-xs text-muted-foreground">
                    Sign in to view repositories
                  </CardContent>
                </Card>
              ) : !githubConnection.connected ? (
                <Card>
                  <CardContent className="p-3 text-center text-xs text-muted-foreground">
                    Connect GitHub to view repositories
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Search input */}
                  {(repos.length > 0 || repoSearchQuery) && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search repos..."
                        value={repoSearchQuery}
                        onChange={(e) => setRepoSearchQuery(e.target.value)}
                        className="h-7 pl-7 pr-7 text-xs"
                      />
                      {repoSearchQuery && (
                        <button
                          onClick={() => setRepoSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Repos list */}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {(reposLoading && repos.length === 0 && !isSearching) ||
                    (searchLoading && searchResults.length === 0 && isSearching) ? (
                      <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {isSearching ? 'Searching...' : 'Loading...'}
                      </div>
                    ) : displayedRepos.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        {isSearching ? `No repos match "${repoSearchQuery}"` : 'No repositories found'}
                      </p>
                    ) : (
                      <>
                        {displayedRepos.map((repo) => {
                          const repoPath = `/repos/${repo.owner}/${repo.name}`
                          const isActive = pathname === repoPath || pathname.startsWith(repoPath + '/')

                          return (
                            <Link key={`${repo.owner}/${repo.name}`} href={repoPath} onClick={handleLinkClick}>
                              <div
                                className={cn(
                                  'flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors',
                                  isActive
                                    ? 'bg-accent text-accent-foreground'
                                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                )}
                              >
                                <GitBranch className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">
                                  {repo.owner}/{repo.name}
                                </span>
                                {repo.private && (
                                  <span className="text-[9px] bg-muted px-1 py-0.5 rounded ml-auto">Private</span>
                                )}
                              </div>
                            </Link>
                          )
                        })}
                        {displayedHasMore && (
                          <div ref={loadMoreRef} className="py-1 flex justify-center">
                            {(isSearching ? searchLoading : reposLoading) && (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* Delete Tasks Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tasks</AlertDialogTitle>
            <AlertDialogDescription>
              Select which types of tasks you want to delete. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delete-completed"
                  checked={deleteCompleted}
                  onCheckedChange={(checked) => setDeleteCompleted(checked === true)}
                />
                <label
                  htmlFor="delete-completed"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Delete Completed Tasks
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delete-failed"
                  checked={deleteFailed}
                  onCheckedChange={(checked) => setDeleteFailed(checked === true)}
                />
                <label
                  htmlFor="delete-failed"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Delete Failed Tasks
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delete-stopped"
                  checked={deleteStopped}
                  onCheckedChange={(checked) => setDeleteStopped(checked === true)}
                />
                <label
                  htmlFor="delete-stopped"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Delete Stopped Tasks
                </label>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTasks}
              disabled={isDeleting || (!deleteCompleted && !deleteFailed && !deleteStopped)}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete Tasks'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
