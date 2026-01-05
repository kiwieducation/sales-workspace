'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SidebarNav from '@/components/SidebarNav'
import ConversationList from '@/components/ConversationList'
import ChatHeader from '@/components/ChatHeader'
import MessageList from '@/components/MessageList'
import MessageComposer from '@/components/MessageComposer'
import AISuggestionCard from '@/components/AISuggestionCard'
import UserProfilePanel from '@/components/UserProfilePanel'
import LearningAnalysisCard from '@/components/LearningAnalysisCard'
import type { Conversation, Message, Profile, CustomerInsight, AISuggestion } from '@/lib/types'

export default function SalesWorkspacePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [insight, setInsight] = useState<CustomerInsight | null>(null)
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [loading, setLoading] = useState(true)

  // 检查登录状态并获取当前用户
  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // 获取用户profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setCurrentUser(profile)
      }
    }

    checkAuth()
  }, [router, supabase])

  // 加载会话列表
  useEffect(() => {
    async function loadConversations() {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          customer:customers(*),
          owner:profiles(*)
        `)
        .order('last_message_at', { ascending: false })

      if (error) {
        console.error('Error loading conversations:', error)
        return
      }

      setConversations(data || [])
      
      // 默认选中第一个会话
      if (data && data.length > 0 && !selectedConversation) {
        setSelectedConversation(data[0])
      }

      setLoading(false)
    }

    loadConversations()
  }, [supabase, selectedConversation])

  // 加载选中会话的消息
  useEffect(() => {
    if (!selectedConversation) return

    async function loadMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(*)
        `)
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading messages:', error)
        return
      }

      setMessages(data || [])
    }

    loadMessages()
  }, [selectedConversation, supabase])

  // 加载客户画像
  useEffect(() => {
    if (!selectedConversation?.customer_id) return

    async function loadInsight() {
      const { data, error } = await supabase
        .from('customer_insights')
        .select('*')
        .eq('customer_id', selectedConversation.customer_id)
        .single()

      if (error) {
        console.error('Error loading insight:', error)
        return
      }

      setInsight(data)
    }

    loadInsight()
  }, [selectedConversation, supabase])

  // 加载AI建议
  useEffect(() => {
    if (!selectedConversation?.id) return

    async function loadSuggestion() {
      const { data, error } = await supabase
        .from('ai_suggestions')
        .select('*')
        .eq('conversation_id', selectedConversation.id)
        .order('priority', { ascending: true })
        .limit(1)
        .single()

      if (error) {
        console.error('Error loading suggestion:', error)
        return
      }

      setSuggestion(data)
    }

    loadSuggestion()
  }, [selectedConversation, supabase])

  const handleSendMessage = async (content: string) => {
    if (!selectedConversation || !currentUser) return

    // 插入消息
    const { error } = await supabase.from('messages').insert({
      conversation_id: selectedConversation.id,
      sender_type: 'user',
      sender_id: currentUser.id,
      content,
    })

    if (error) {
      console.error('Error sending message:', error)
      throw error
    }

    // 重新加载消息
    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles(*)
      `)
      .eq('conversation_id', selectedConversation.id)
      .order('created_at', { ascending: true })

    if (data) {
      setMessages(data)
    }
  }

  const handleRefresh = () => {
    router.refresh()
  }

  // 判断是否可以发送消息
  const canSendMessage = () => {
    if (!currentUser || !selectedConversation) return false
    
    // Admin可以给所有人发消息
    if (currentUser.role === 'admin') return true
    
    // Consultant只能给自己负责的客户发消息
    if (currentUser.role === 'consultant') {
      return selectedConversation.owner_user_id === currentUser.id
    }
    
    // Viewer不能发消息
    return false
  }

  const getDisabledMessage = () => {
    if (!currentUser || !selectedConversation) return undefined
    
    if (currentUser.role === 'viewer') {
      return '您当前是观察者角色，无法发送消息'
    }
    
    if (currentUser.role === 'consultant' && selectedConversation.owner_user_id !== currentUser.id) {
      return `此会话由 ${selectedConversation.owner?.name} 负责，您无权发送消息`
    }
    
    return undefined
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <SidebarNav />

      {/* Conversation List */}
      <ConversationList
        conversations={conversations}
        selectedId={selectedConversation?.id}
        onSelect={(id) => {
          const conv = conversations.find((c) => c.id === id)
          if (conv) setSelectedConversation(conv)
        }}
        onRefresh={handleRefresh}
      />

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <ChatHeader customer={selectedConversation?.customer} />
        <MessageList messages={messages} currentUserId={currentUser?.id} />
        <AISuggestionCard suggestion={suggestion} />
        <MessageComposer
          onSend={handleSendMessage}
          disabled={!canSendMessage()}
          disabledMessage={getDisabledMessage()}
        />
      </div>

      {/* Right Panel */}
      <div className="flex flex-col">
        <UserProfilePanel
          customer={selectedConversation?.customer}
          insight={insight}
          ownerName={selectedConversation?.owner?.name}
        />
        <LearningAnalysisCard customer={selectedConversation?.customer} />
      </div>
    </div>
  )
}
