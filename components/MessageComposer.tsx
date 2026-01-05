'use client'

import { useState } from 'react'
import { Send, Image, Smile, Paperclip } from 'lucide-react'

interface MessageComposerProps {
  onSend: (content: string) => Promise<void>
  disabled?: boolean
  disabledMessage?: string
}

export default function MessageComposer({ 
  onSend, 
  disabled = false,
  disabledMessage 
}: MessageComposerProps) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || disabled || sending) return

    setSending(true)
    try {
      await onSend(content.trim())
      setContent('')
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white">
      {disabled && disabledMessage && (
        <div className="px-6 py-2 bg-yellow-50 border-b border-yellow-100">
          <p className="text-sm text-yellow-800">{disabledMessage}</p>
        </div>
      )}
      
      <div className="p-4">
        <form onSubmit={handleSubmit}>
          <div className="flex items-end gap-3">
            {/* Attachments */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={disabled}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="生成朋友圈"
              >
                <Image className="w-5 h-5 text-gray-600" />
              </button>
              <button
                type="button"
                disabled={disabled}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="生成预签合同"
              >
                <Paperclip className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Input */}
            <div className="flex-1 relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled || sending}
                placeholder={disabled ? disabledMessage || "无法发送消息" : "输入或复制使用AI建议..."}
                rows={1}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                style={{ minHeight: '42px', maxHeight: '120px' }}
              />
              <button
                type="button"
                disabled={disabled}
                className="absolute right-2 bottom-2 p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Smile className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={disabled || !content.trim() || sending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? '发送中...' : '发送'}
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Quick Actions */}
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Image className="w-4 h-4" />
            生成朋友圈图圈
          </button>
          <button
            type="button"
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Paperclip className="w-4 h-4" />
            生成预签合同
          </button>
          <button
            type="button"
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            跳转调通至CRM
          </button>
        </div>
      </div>
    </div>
  )
}
