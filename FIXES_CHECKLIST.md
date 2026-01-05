# 修复验证清单

本文档帮助您验证所有修复点是否生效。

## ✅ 问题 1: 项目结构一致性

### 验证步骤

1. **检查文件结构**
```bash
cd sales-workspace
ls -la
```

应该看到：
```
app/
components/
lib/
package.json
tsconfig.json
tailwind.config.ts
...
```

2. **检查 import 路径**

打开 `app/workspace/sales/page.tsx`，检查 import：
```typescript
import { createClient } from '@/lib/supabase/client'  // ✅ 路径存在
import SidebarNav from '@/components/SidebarNav'      // ✅ 路径存在
import type { Conversation } from '@/lib/types'       // ✅ 路径存在
```

3. **验证 TypeScript 配置**

打开 `tsconfig.json`，确认：
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]  // ✅ 路径映射正确
    }
  }
}
```

4. **测试运行**
```bash
npm install
npm run dev
```

**预期结果**: 
- [ ] 安装无错误
- [ ] 启动成功，显示 "Ready in X.Xs"
- [ ] 访问 http://localhost:3000 能看到登录页
- [ ] 浏览器控制台无 404 错误

---

## ✅ 问题 2: Supabase RLS + Trigger 修复

### 验证步骤

1. **检查 Trigger 函数定义**

在 Supabase Dashboard → SQL Editor 执行：
```sql
SELECT 
  p.proname as function_name,
  p.prosecdef as is_security_definer
FROM pg_proc p
WHERE p.proname = 'update_conversation_last_message';
```

**预期结果**:
- [ ] `is_security_definer` 为 `true`

2. **检查函数源码**
```sql
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'update_conversation_last_message';
```

**预期结果**:
- [ ] 包含 `SECURITY DEFINER`
- [ ] 包含 `SET search_path = public`

3. **测试 Consultant 发送消息**

步骤：
1. 登录 `kate@test.com`
2. 选中王同学会话（Kate 负责）
3. 发送消息："测试 trigger 修复"
4. 刷新页面

**预期结果**:
- [ ] 消息发送成功（无错误）
- [ ] 刷新后，王同学会话在列表最上方
- [ ] 时间显示"刚刚"或"X秒前"
- [ ] 浏览器控制台无 RLS 错误

4. **验证数据库更新**

在 SQL Editor 执行：
```sql
SELECT 
  c.id,
  cu.name as customer_name,
  c.last_message_at,
  (SELECT created_at FROM messages 
   WHERE conversation_id = c.id 
   ORDER BY created_at DESC LIMIT 1) as latest_message_time
FROM conversations c
JOIN customers cu ON c.customer_id = cu.id
WHERE cu.name = '王同学';
```

**预期结果**:
- [ ] `last_message_at` 与 `latest_message_time` 相同或非常接近

---

## ✅ 问题 3: 全局布局与样式

### 验证步骤

1. **检查 layout.tsx 存在**
```bash
ls app/layout.tsx
```

**预期结果**: 文件存在

2. **检查 globals.css 引入**

打开 `app/layout.tsx`，确认：
```typescript
import "./globals.css";  // ✅ 存在
```

3. **验证 Tailwind 生效**

访问任意页面（如登录页），打开浏览器开发工具：
- 右键点击蓝色按钮
- 选择"检查"
- 查看 Computed 样式

**预期结果**:
- [ ] 按钮有 `background-color: rgb(37, 99, 235)` (蓝色)
- [ ] 有 `border-radius` (圆角)
- [ ] 有 `padding` 等 Tailwind 样式

4. **检查自定义样式**

在任意有滚动条的区域（如会话列表）：

**预期结果**:
- [ ] 滚动条宽度为 6px（自定义）
- [ ] 滚动条颜色为浅灰色（非默认黑色）

5. **验证动画**

发送一条新消息后：

**预期结果**:
- [ ] 消息有淡入动画（slideIn）
- [ ] 动画流畅，无闪烁

---

## ✅ 综合测试

### 完整流程验证

1. **安装与启动**
```bash
npm install          # 应无错误
npm run dev          # 应成功启动
```

2. **登录测试**
- [ ] 访问根路径自动跳转到 `/login`
- [ ] 使用 `admin@test.com` / `admin123` 成功登录
- [ ] 跳转到 `/workspace/sales`

3. **权限测试**

**Admin 测试**:
- [ ] 可以查看所有 3 个会话
- [ ] 可以给任何会话发消息
- [ ] 消息成功保存

**Consultant 测试**:
- [ ] 登录 `kate@test.com`
- [ ] 查看王同学会话 → 输入框可用
- [ ] 查看陈同学会话 → 输入框禁用 + 提示

**Viewer 测试**:
- [ ] 登录 `viewer@test.com`
- [ ] 所有输入框禁用
- [ ] 显示"观察者角色"提示

4. **Trigger 测试**
- [ ] Consultant 发送消息成功
- [ ] 会话排序正确更新
- [ ] 无 RLS 错误

5. **UI 测试**
- [ ] 所有页面样式正常
- [ ] Tailwind 样式生效
- [ ] 自定义滚动条显示
- [ ] 消息动画流畅

---

## 🎯 所有问题已修复的标志

当以下所有项都打勾时，说明修复完全成功：

### 结构问题
- [ ] `npm run dev` 直接启动，无路径错误
- [ ] 所有 import 路径正确
- [ ] TypeScript 无编译错误

### RLS + Trigger 问题
- [ ] Trigger 函数使用 SECURITY DEFINER
- [ ] Consultant 发消息后会话时间更新
- [ ] 无 RLS policy violation 错误

### 样式问题
- [ ] `app/layout.tsx` 正确引入 `globals.css`
- [ ] Tailwind 在所有页面生效
- [ ] 自定义样式（滚动条、动画）正常

### 功能完整性
- [ ] 登录流程完整
- [ ] 权限控制正确
- [ ] 消息发送与接收正常
- [ ] UI 交互流畅

---

## 🔍 问题排查

如果某项未通过，参考以下排查步骤：

### import 错误
1. 检查 `tsconfig.json` 中的 `paths` 配置
2. 确认文件实际位置与 import 路径一致
3. 重启开发服务器

### Trigger 不工作
1. 检查函数定义是否包含 `SECURITY DEFINER`
2. 重新执行 SQL（DROP 后再 CREATE）
3. 检查 Supabase Logs

### 样式不生效
1. 确认 `app/layout.tsx` 引入了 `globals.css`
2. 检查 `tailwind.config.ts` 的 `content` 配置
3. 清除缓存并重启：
```bash
rm -rf .next
npm run dev
```

---

## ✅ 最终验收标准

**项目合格标准**：
1. 解压 → 填 env → npm install → npm run dev → 页面正常
2. 三种角色权限测试全部通过
3. Consultant 发消息后会话排序正确
4. 无任何控制台错误

**达到以上标准即可认为修复完成！**
