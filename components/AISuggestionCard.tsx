'use client'

import { Sparkles } from 'lucide-react'
import { AISuggestion } from '@/lib/types'

interface AISuggestionCardProps {
  suggestion?: AISuggestion | null
}

export default function AISuggestionCard({ suggestion }: AISuggestionCardProps) {
  if (!suggestion) {
    return null
  }

  const keywords = extractKeywords(suggestion.content)

  return (
    <div className="mx-6 mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">AI 决策建议</h3>
            <span className="text-xs text-gray-500">实时生成</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed mb-3 whitespace-pre-line">
            {suggestion.content}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {keywords.map((keyword, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-1 bg-white border border-blue-200 rounded-md text-xs font-medium text-blue-700"
              >
                {keyword.label}: {keyword.value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function extractKeywords(content: string): Array<{ label: string; value: string }> {
  const keywords: Array<{ label: string; value: string }> = []
  
  // 提取话术
  const huashuMatch = content.match(/话术[:：]\s*([^\n]+)/)
  if (huashuMatch) {
    keywords.push({ label: '话术', value: huashuMatch[1].trim() })
  }

  // 提取素材
  const sucaiMatch = content.match(/素材[:：]\s*([^\n]+)/)
  if (sucaiMatch) {
    keywords.push({ label: '素材', value: sucaiMatch[1].trim() })
  }

  // 如果没有找到关键词，返回默认
  if (keywords.length === 0) {
    keywords.push({ label: '阶段', value: '咨询期' })
  }

  return keywords
}
