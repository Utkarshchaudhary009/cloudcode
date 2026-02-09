export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-background flex flex-col">
      <div className="min-h-screen">
        <div className="px-4 md:px-8 lg:px-16 xl:px-24 py-8">{children}</div>
      </div>
    </div>
  )
}
