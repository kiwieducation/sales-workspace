-- =====================================================
-- 销售工作台 - Supabase 数据库 Schema (修复版)
-- =====================================================

-- 清理现有表（如果存在）
DROP TABLE IF EXISTS ai_suggestions CASCADE;
DROP TABLE IF EXISTS customer_insights CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- =====================================================
-- 1. 用户角色表
-- =====================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'consultant', 'viewer')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. 客户表
-- =====================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade INTEGER,
  age INTEGER,
  school_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. 会话表
-- =====================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. 消息表
-- =====================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'customer')),
  sender_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. 客户画像/洞察表
-- =====================================================
CREATE TABLE customer_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  emotion_score INTEGER DEFAULT 50 CHECK (emotion_score >= 0 AND emotion_score <= 100),
  engagement_level TEXT DEFAULT 'medium',
  historical_notes JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. AI 建议表
-- =====================================================
CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  suggestion_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 索引优化
-- =====================================================
CREATE INDEX idx_conversations_owner ON conversations(owner_user_id);
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_customer_insights_customer ON customer_insights(customer_id);
CREATE INDEX idx_ai_suggestions_conversation ON ai_suggestions(conversation_id);

-- =====================================================
-- RLS (Row Level Security) 启用
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies - Profiles
-- =====================================================
CREATE POLICY "所有人可查看profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "用户可更新自己的profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- RLS Policies - Customers
-- =====================================================
CREATE POLICY "所有用户可查看客户" ON customers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin可管理客户" ON customers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- RLS Policies - Conversations
-- =====================================================
CREATE POLICY "所有用户可查看会话" ON conversations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin可管理会话" ON conversations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- RLS Policies - Messages
-- =====================================================
CREATE POLICY "所有用户可查看消息" ON messages
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Consultant可发送消息给自己的客户" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'admin'
        OR (
          profiles.role = 'consultant'
          AND EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.owner_user_id = auth.uid()
          )
        )
      )
    )
  );

-- =====================================================
-- RLS Policies - Customer Insights
-- =====================================================
CREATE POLICY "所有用户可查看客户画像" ON customer_insights
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin可管理客户画像" ON customer_insights
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- RLS Policies - AI Suggestions
-- =====================================================
CREATE POLICY "所有用户可查看AI建议" ON ai_suggestions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin可管理AI建议" ON ai_suggestions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- 触发器函数：自动更新 updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_insights_updated_at BEFORE UPDATE ON customer_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_suggestions_updated_at BEFORE UPDATE ON ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 触发器函数：更新会话的 last_message_at（增强修复版）
-- =====================================================
DROP TRIGGER IF EXISTS update_last_message_trigger ON messages;
DROP FUNCTION IF EXISTS update_conversation_last_message();

CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER
SECURITY DEFINER              -- 以函数定义者身份运行
SET search_path = public      -- 明确 schema
LANGUAGE plpgsql
AS $$
BEGIN
  -- 显式关闭当前事务中的 RLS
  PERFORM set_config('row_security', 'off', true);
  
  -- 更新会话的最后消息时间
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_last_message_trigger 
AFTER INSERT ON messages
FOR EACH ROW 
EXECUTE FUNCTION update_conversation_last_message();

-- =====================================================
-- Seed 数据
-- =====================================================

-- 插入用户profiles
-- 注意：需要先在 Supabase Auth 中创建对应的用户
INSERT INTO profiles (id, name, role) VALUES
  ('11111111-1111-1111-1111-111111111111', '超级管理员', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Kate, Lin', 'consultant'),
  ('33333333-3333-3333-3333-333333333333', '李顾问', 'consultant'),
  ('44444444-4444-4444-4444-444444444444', '观察者', 'viewer')
ON CONFLICT (id) DO NOTHING;

-- 插入客户
INSERT INTO customers (id, name, grade, age, school_type) VALUES
  ('c1111111-1111-1111-1111-111111111111', '王同学', 11, 17, '美高'),
  ('c2222222-2222-2222-2222-222222222222', '李妈妈', NULL, 45, NULL),
  ('c3333333-3333-3333-3333-333333333333', '陈同学', NULL, NULL, '美本转学咨询')
ON CONFLICT (id) DO NOTHING;

-- 插入会话
INSERT INTO conversations (id, customer_id, owner_user_id, last_message_at) VALUES
  ('cv111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '10 minutes'),
  ('cv222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '2 hours'),
  ('cv333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- 插入消息（王同学会话）
INSERT INTO messages (conversation_id, sender_type, sender_id, content, created_at) VALUES
  ('cv111111-1111-1111-1111-111111111111', 'customer', NULL, '老师，我现在的背景想转学去南加大的商学院，希望大四？', NOW() - INTERVAL '30 minutes'),
  ('cv111111-1111-1111-1111-111111111111', 'user', '22222222-2222-2222-2222-222222222222', '南加大(USC)的Marshall商学院非常欢迎这类跨越性选手。你能先提供一下目前的GPA和已经修过的先修课程吗？', NOW() - INTERVAL '25 minutes'),
  ('cv111111-1111-1111-1111-111111111111', 'customer', NULL, 'GPA 3.6，修过微观经济学、统计学和会计基础', NOW() - INTERVAL '20 minutes'),
  ('cv111111-1111-1111-1111-111111111111', 'user', '22222222-2222-2222-2222-222222222222', '很好的基础！Marshall要求GPA 3.5+，你已经达标。建议补充商业法和市场营销课程，同时准备好个人陈述重点说明转专业动机。', NOW() - INTERVAL '10 minutes')
ON CONFLICT (id) DO NOTHING;

-- 插入消息（李妈妈会话）
INSERT INTO messages (conversation_id, sender_type, sender_id, content, created_at) VALUES
  ('cv222222-2222-2222-2222-222222222222', 'customer', NULL, '你好，我想咨询一下我女儿申请美本的事情', NOW() - INTERVAL '3 hours'),
  ('cv222222-2222-2222-2222-222222222222', 'user', '22222222-2222-2222-2222-222222222222', '您好！很高兴为您服务。请问您女儿目前是几年级呢？', NOW() - INTERVAL '2 hours 50 minutes'),
  ('cv222222-2222-2222-2222-222222222222', 'customer', NULL, '高二，成绩还不错，托福准备中', NOW() - INTERVAL '2 hours 40 minutes'),
  ('cv222222-2222-2222-2222-222222222222', 'user', '22222222-2222-2222-2222-222222222222', '时间规划很合理！高二正是准备标化的关键时期。建议托福目标100+，同时开始准备SAT。我们可以先做一个完整的背景评估。', NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

-- 插入消息（陈同学会话）
INSERT INTO messages (conversation_id, sender_type, sender_id, content, created_at) VALUES
  ('cv333333-3333-3333-3333-333333333333', 'customer', NULL, '老师你好，我想了解美本转学的流程', NOW() - INTERVAL '2 days'),
  ('cv333333-3333-3333-3333-333333333333', 'user', '33333333-3333-3333-3333-333333333333', '你好！美本转学主要看大学GPA、推荐信和转学文书。请问你目前在哪所学校？', NOW() - INTERVAL '1 day 23 hours'),
  ('cv333333-3333-3333-3333-333333333333', 'customer', NULL, '某双非，GPA3.8', NOW() - INTERVAL '1 day 22 hours'),
  ('cv333333-3333-3333-3333-333333333333', 'user', '33333333-3333-3333-3333-333333333333', 'GPA很优秀！转学到美本主要考虑：1)学分转换 2)转学时间点 3)目标学校选择。建议大二申请转学，成功率最高。', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- 插入客户画像
INSERT INTO customer_insights (customer_id, emotion_score, engagement_level, historical_notes, tags) VALUES
  ('c1111111-1111-1111-1111-111111111111', 83, 'high', 
    '[{"date":"2023.10.15","event":"首次咨询"},{"date":"2023.10.20","event":"提交背景资料"},{"date":"2023.11.05","event":"参加线上讲座"}]'::jsonb,
    '["对USC感兴趣","GPA优秀","需要课程规划"]'::jsonb),
  ('c2222222-2222-2222-2222-222222222222', 75, 'medium',
    '[{"date":"2023.09.01","event":"母亲初次咨询"},{"date":"2023.09.15","event":"学生参加模考"}]'::jsonb,
    '["家长主导","高二学生","托福备考中"]'::jsonb),
  ('c3333333-3333-3333-3333-333333333333', 65, 'medium',
    '[{"date":"2023.08.20","event":"了解转学流程"}]'::jsonb,
    '["美本转学","GPA高","需要选校建议"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 插入AI建议
INSERT INTO ai_suggestions (conversation_id, stage, suggestion_type, title, content, priority) VALUES
  ('cv111111-1111-1111-1111-111111111111', '决策关键期', '话术', '发送11月Marshall商学院转学成功案例包', 
    '检测到客户处于"决策关键期"，建议：发送 11月 Marshall 商学院转学成功案例包，引导客户签署《初步评估表》。
    
话术：USC案例
素材：转学成功案例', 1),
  ('cv222222-2222-2222-2222-222222222222', '需求确认期', '素材', '发送美本申请时间规划表', 
    '客户处于初步了解阶段，建议发送美本申请完整时间规划表，建立专业形象。', 2),
  ('cv333333-3333-3333-3333-333333333333', '方案设计期', '话术', '提供转学选校方案', 
    '根据GPA3.8背景，推荐冲刺TOP30、稳妥TOP50学校组合。', 1)
ON CONFLICT (id) DO NOTHING;
