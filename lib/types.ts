export type UserRole = 'admin' | 'consultant' | 'viewer'

export interface Profile {
  id: string
  name: string
  role: UserRole
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  name: string
  grade?: number
  age?: number
  school_type?: string
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  customer_id: string
  owner_user_id: string
  last_message_at: string
  created_at: string
  updated_at: string
  customer?: Customer
  owner?: Profile
}

export interface Message {
  id: string
  conversation_id: string
  sender_type: 'user' | 'customer'
  sender_id?: string
  content: string
  created_at: string
  sender?: Profile
}

export interface CustomerInsight {
  id: string
  customer_id: string
  emotion_score: number
  engagement_level: 'low' | 'medium' | 'high'
  historical_notes: Array<{ date: string; event: string }>
  tags: string[]
  created_at: string
  updated_at: string
}

export interface AISuggestion {
  id: string
  conversation_id: string
  stage: string
  suggestion_type: string
  title: string
  content: string
  priority: number
  created_at: string
  updated_at: string
}
