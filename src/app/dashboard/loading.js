export default function DashboardLoading() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 p-6">
      {/* Filters Skeleton */}
      <div className="w-full h-16 bg-gray-200 rounded-2xl animate-pulse" />
      
      {/* Tabs Skeleton */}
      <div className="flex gap-2">
        <div className="w-32 h-10 bg-gray-200 rounded-xl animate-pulse" />
        <div className="w-48 h-10 bg-gray-200 rounded-xl animate-pulse" />
        <div className="w-48 h-10 bg-gray-200 rounded-xl animate-pulse" />
      </div>

      {/* Top Search and AI Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-32 bg-gray-200 rounded-[2.5rem] animate-pulse" />
        <div className="h-32 bg-gray-200 rounded-[2.5rem] animate-pulse" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-36 bg-gray-200 rounded-3xl animate-pulse" />
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="h-96 w-full bg-gray-200 rounded-[2.5rem] animate-pulse" />
    </div>
  )
}
