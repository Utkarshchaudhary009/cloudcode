export async function redirectToSignIn(): Promise<void> {
  const response = await fetch(
    `/api/auth/signin/github?${new URLSearchParams({
      next: window.location.pathname,
    }).toString()}`,
    { method: 'POST' },
  )

  const { url } = await response.json()
  window.location = url
  if (window.location.hash) {
    window.location.reload()
  }
}
