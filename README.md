# 销售工作台 - 修复版

一个完整的、可直接运行的销售工作台应用，基于 Next.js 14 + Supabase。

## ✅ 修复内容

本版本修复了以下关键问题：

### 1. 项目结构规范化
- ✅ 统一所有 import 路径（`@/components/...`、`@/lib/...`）
- ✅ 标准 Next.js 14 App Router 结构
- ✅ 所有文件位置与路径完全一致
- ✅ 可直接 `npm run dev` 运行

### 2. Supabase RLS + Trigger 修复
- ✅ Trigger 函数使用 `SECURITY DEFINER`
- ✅ 设置 `search_path = public`
- ✅ 避免 RLS 策略冲突
- ✅ Consultant 发送消息后会话时间正确更新

### 3. 全局布局与样式
- ✅ `app/layout.tsx` 正确配置
- ✅ `app/globals.css` 被正确引入
- ✅ Tailwind 在所有页面生效

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Supabase

#### 2.1 创建项目
访问 https://supabase.com 创建新项目

#### 2.2 执行 SQL
在 Supabase Dashboard → SQL Editor 中执行 `supabase-schema.sql` 全部内容

#### 2.3 创建用户
在 Authentication → Users 中创建：
- `admin@test.com` / `admin123`
- `kate@test.com` / `kate123`
- `viewer@test.com` / `viewer123`

#### 2.4 更新 UUID
```sql
-- 查看实际 UUID
SELECT id, email FROM auth.users;

-- 更新 profiles
UPDATE profiles SET id = '实际UUID' WHERE name = '超级管理员';
UPDATE profiles SET id = '实际UUID' WHERE name = 'Kate, Lin';
UPDATE profiles SET id = '实际UUID' WHERE name = '观察者';

-- 更新 conversations
UPDATE conversations 
SET owner_user_id = 'Kate的实际UUID'
WHERE customer_id IN (
  'c1111111-1111-1111-1111-111111111111',
  'c2222222-2222-2222-2222-222222222222'
);
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

填入 Supabase 配置：
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. 启动应用

```bash
npm run dev
```

访问 http://localhost:3000

## 📁 项目结构

```
sales-workspace/
├── app/                          # Next.js App Router
│   ├── globals.css              # 全局样式
│   ├── layout.tsx               # 根布局
│   ├── page.tsx                 # 首页（重定向）
│   ├── login/
│   │   └── page.tsx             # 登录页面
│   └── workspace/
│       ├── sales/page.tsx       # 销售工作台（主页面）
│       ├── command/page.tsx     # 指挥中心（占位）
│       ├── kb/page.tsx          # 企业知识库（占位）
│       └── contracts/page.tsx   # 合同与审批（占位）
├── components/                   # React 组件
│   ├── SidebarNav.tsx
│   ├── ConversationList.tsx
│   ├── ChatHeader.tsx
│   ├── MessageList.tsx
│   ├── MessageComposer.tsx
│   ├── AISuggestionCard.tsx
│   ├── UserProfilePanel.tsx
│   └── LearningAnalysisCard.tsx
├── lib/                         # 工具库
│   ├── types.ts                 # TypeScript 类型定义
│   └── supabase/
│       ├── client.ts            # 浏览器端客户端
│       └── server.ts            # 服务器端客户端
├── supabase-schema.sql          # 数据库 Schema（修复版）
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.js
└── .env.example
```

## 🔧 技术栈

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (PostgreSQL + Auth + RLS)
- **Lucide React** (图标)
- **date-fns** (日期格式化)

## 🎯 核心功能

### 权限控制（RLS）
- **Admin**: 全权限
- **Consultant**: 只能给自己负责的客户发消息
- **Viewer**: 只读

### 聊天系统
- 实时消息发送
- 历史消息加载
- Enter 发送 / Shift+Enter 换行

### AI 智能建议
- 根据会话显示建议
- 关键词提取
- SOP Modal

### 客户画像
- 基本信息
- 情绪分数
- 历史足迹

## ✅ 验证清单

### 基础功能
- [ ] `npm install` 无错误
- [ ] `npm run dev` 成功启动
- [ ] 访问 http://localhost:3000 自动跳转到 `/login`
- [ ] 可以成功登录

### 权限测试
- [ ] Admin 可以给所有会话发消息
- [ ] Consultant 只能给自己客户发消息（其他会话禁用）
- [ ] Viewer 所有输入框禁用

### Trigger 测试
- [ ] Consultant 发送消息成功
- [ ] 会话列表排序正确（最新消息的会话在最上面）
- [ ] 没有 RLS 错误

## 🐛 故障排查

### 问题：无法登录
**解决**: 检查用户是否在 Supabase Auth 中创建并确认邮箱

### 问题：会话列表为空
**解决**: 检查 SQL 是否完整执行，特别是 seed 数据部分

### 问题：RLS policy violation
**解决**: 确保 profiles 表的 UUID 与 auth.users 匹配

### 问题：消息发送后会话时间不更新
**解决**: 这已在修复版中解决（trigger 使用 SECURITY DEFINER）

## 📝 License

MIT
