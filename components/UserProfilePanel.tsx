'use client'

import { Customer, CustomerInsight } from '@/lib/types'
import { Calendar } from 'lucide-react'

interface UserProfilePanelProps {
  customer?: Customer | null
  insight?: CustomerInsight | null
  ownerName?: string
}

export default function UserProfilePanel({ customer, insight, ownerName }: UserProfilePanelProps) {
  if (!customer) {
    return (
      <div className="w-96 bg-white border-l border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">用户画像</h2>
      </div>

      {/* Profile Info */}
      <div className="p-6 space-y-4">
        {/* Basic Info */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">关键信息</h3>
          <div className="space-y-2">
            <InfoRow label="添加日期" value="2023.10.20" />
            <InfoRow label="交互负责" value={ownerName || 'Kate, Lin'} />
          </div>
        </div>

        {/* Customer Details */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">背景档案</h3>
          <div className="space-y-2">
            {customer.grade && <InfoRow label="年级" value={customer.grade.toString()} />}
            {customer.age && <InfoRow label="年龄" value={customer.age.toString()} />}
            {customer.school_type && <InfoRow label="学校类型" value={customer.school_type} />}
          </div>
        </div>

        {/* Engagement */}
        {insight && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">情绪档案</h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">咨询积极度</span>
                  <span className="text-sm font-medium text-gray-900">{insight.emotion_score}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${insight.emotion_score}%` }}
                  ></div>
                </div>
              </div>
              <InfoRow 
                label="问询阶段" 
                value={
                  insight.tags && insight.tags.length > 0 
                    ? insight.tags[0].replace(/["\[\]]/g, '')
                    : '对USC感兴趣'
                } 
              />
            </div>
          </div>
        )}

        {/* Historical Notes */}
        {insight?.historical_notes && insight.historical_notes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">历史足迹</h3>
            <div className="space-y-2">
              {insight.historical_notes.map((note, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-gray-500">{note.date}</span>
                    <span className="text-gray-700 ml-2">{note.event}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}
