'use client'

import { Message } from '@/lib/types'
import { format } from 'date-fns'

interface MessageListProps {
  messages: Message[]
  currentUserId?: string
}

export default function MessageList({ messages, currentUserId }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
      {messages.map((message) => {
        const isCurrentUser = message.sender_type === 'user' && message.sender_id === currentUserId
        const isUser = message.sender_type === 'user'
        const time = format(new Date(message.created_at), 'HH:mm')

        return (
          <div
            key={message.id}
            className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} message-bubble`}
          >
            <div className={`flex ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 max-w-2xl`}>
              {/* Avatar */}
              {!isCurrentUser && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  {isUser ? (message.sender?.name?.charAt(0) || 'U') : 'C'}
                </div>
              )}

              {/* Message Bubble */}
              <div className="flex flex-col">
                <div
                  className={`
                    px-4 py-2.5 rounded-2xl shadow-sm
                    ${isCurrentUser
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white text-gray-900 rounded-bl-md'
                    }
                  `}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
                <span className={`text-xs text-gray-400 mt-1 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                  {time}
                </span>
              </div>

              {/* Current User Avatar */}
              {isCurrentUser && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  {message.sender?.name?.charAt(0) || 'U'}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
