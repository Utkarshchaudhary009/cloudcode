export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="px-4 md:px-8 lg:px-16 xl:px-24 py-8">{children}</div>
    </div>
  )
}
