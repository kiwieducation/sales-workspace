'use client'

import { Phone, Image, MoreVertical } from 'lucide-react'
import { Customer } from '@/lib/types'

interface ChatHeaderProps {
  customer?: Customer
  status?: string
}

export default function ChatHeader({ customer, status = '企业实时监听中' }: ChatHeaderProps) {
  if (!customer) {
    return (
      <div className="h-16 px-6 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
          <div className="ml-3">
            <div className="h-4 w-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-16 px-6 border-b border-gray-200 flex items-center justify-between bg-white">
      <div className="flex items-center">
        <div className="relative">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center text-white font-medium">
            {customer.name.charAt(0)}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
        </div>
        <div className="ml-3">
          <h2 className="text-base font-semibold text-gray-900">{customer.name}</h2>
          <p className="text-xs text-green-600 flex items-center">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
            {status}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <Phone className="w-5 h-5 text-gray-600" />
        </button>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <Image className="w-5 h-5 text-gray-600" />
        </button>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <MoreVertical className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </div>
  )
}
