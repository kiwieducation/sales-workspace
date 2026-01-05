import SidebarNav from '@/components/SidebarNav'

export default function CommandCenterPage() {
  return (
    <div className="h-screen flex bg-gray-50">
      <SidebarNav />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">指挥中心</h1>
          <p className="text-gray-500">功能开发中...</p>
        </div>
      </div>
    </div>
  )
}
