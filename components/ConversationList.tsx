'use client'

import { Search, RefreshCw, UserPlus } from 'lucide-react'
import { Conversation } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface ConversationListProps {
  conversations: Conversation[]
  selectedId?: string
  onSelect: (id: string) => void
  onRefresh: () => void
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onRefresh,
}: ConversationListProps) {
  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="h-16 px-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center">
          <h2 className="text-base font-semibold text-gray-900">会话列表</h2>
          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            {conversations.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
          <button
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="新增会话"
          >
            <UserPlus className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索知识库、客户、合同..."
            className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => {
          const isSelected = conv.id === selectedId
          const timeAgo = formatDistanceToNow(new Date(conv.last_message_at), {
            addSuffix: true,
            locale: zhCN,
          })

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`
                w-full px-4 py-3 border-b border-gray-100 text-left transition-colors
                ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'}
              `}
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-medium text-gray-900">{conv.customer?.name}</h3>
                <span className="text-xs text-gray-500">{timeAgo}</span>
              </div>
              {conv.customer?.school_type && (
                <p className="text-xs text-gray-500">{conv.customer.school_type}</p>
              )}
              {conv.customer?.grade && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                    美高 {conv.customer.grade}年级
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
