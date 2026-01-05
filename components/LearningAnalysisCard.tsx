'use client'

import { useState } from 'react'
import { TrendingUp, X } from 'lucide-react'
import { Customer } from '@/lib/types'

interface LearningAnalysisCardProps {
  customer?: Customer
}

export default function LearningAnalysisCard({ customer }: LearningAnalysisCardProps) {
  const [showModal, setShowModal] = useState(false)

  if (!customer) return null

  return (
    <>
      {/* Card */}
      <div className="mx-6 mb-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">学习层分析</h3>
            <p className="text-sm text-blue-100 mb-4">
              针对「{customer.school_type || '美高'}」客户，建议在对话提及「{customer.grade ? `${customer.grade}年级选课规划` : '11年级选课规划'}」。
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              查看针对性 SOP
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">针对性 SOP - 美高学生选课规划</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              <div className="space-y-4">
                <Section
                  title="1. 初步接触阶段"
                  content="了解学生当前年级、GPA、标化成绩准备情况。询问学生的兴趣方向和目标院校。"
                />
                <Section
                  title="2. 需求分析"
                  content="评估学生的学术背景，识别课程规划的优化空间。提供个性化的AP/IB选课建议。"
                />
                <Section
                  title="3. 方案设计"
                  content="制定详细的11-12年级选课路线图。平衡难度与GPA，突出学科特长。"
                />
                <Section
                  title="4. 跟进转化"
                  content="分享成功案例，建立信任。引导签署服务协议，进入深度服务阶段。"
                />
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">关键话术</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• "根据你的背景，我建议你在11年级重点选择..."</li>
                    <li>• "这样的选课组合在申请TOP30时会有明显优势"</li>
                    <li>• "我们之前有类似背景的学生成功录取了..."</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                关闭
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                应用到对话
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 mb-1">{title}</h4>
      <p className="text-sm text-gray-600 leading-relaxed">{content}</p>
    </div>
  )
}
