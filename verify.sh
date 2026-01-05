#!/bin/bash

# 销售工作台 - 快速验证脚本
# 用于验证项目结构是否正确

echo "🔍 开始验证项目结构..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
passed=0
failed=0

# 检查函数
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
    ((passed++))
  else
    echo -e "${RED}✗${NC} $1 (缺失)"
    ((failed++))
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1/"
    ((passed++))
  else
    echo -e "${RED}✗${NC} $1/ (缺失)"
    ((failed++))
  fi
}

echo "📁 检查核心目录..."
check_dir "app"
check_dir "components"
check_dir "lib"
check_dir "lib/supabase"
echo ""

echo "📄 检查配置文件..."
check_file "package.json"
check_file "tsconfig.json"
check_file "tailwind.config.ts"
check_file "next.config.js"
check_file ".env.example"
echo ""

echo "🎨 检查 App 文件..."
check_file "app/layout.tsx"
check_file "app/globals.css"
check_file "app/page.tsx"
check_file "app/login/page.tsx"
check_file "app/workspace/sales/page.tsx"
echo ""

echo "🧩 检查组件..."
check_file "components/SidebarNav.tsx"
check_file "components/ConversationList.tsx"
check_file "components/ChatHeader.tsx"
check_file "components/MessageList.tsx"
check_file "components/MessageComposer.tsx"
check_file "components/AISuggestionCard.tsx"
check_file "components/UserProfilePanel.tsx"
check_file "components/LearningAnalysisCard.tsx"
echo ""

echo "🔧 检查工具库..."
check_file "lib/types.ts"
check_file "lib/supabase/client.ts"
check_file "lib/supabase/server.ts"
echo ""

echo "🗄️ 检查数据库..."
check_file "supabase-schema.sql"
echo ""

echo "📚 检查文档..."
check_file "README.md"
check_file "FIXES_CHECKLIST.md"
echo ""

# 检查 tsconfig.json 中的路径映射
echo "🔗 检查路径映射..."
if grep -q '"@/\*": \["\./\*"\]' tsconfig.json 2>/dev/null; then
  echo -e "${GREEN}✓${NC} tsconfig.json 路径映射正确"
  ((passed++))
else
  echo -e "${RED}✗${NC} tsconfig.json 路径映射有误"
  ((failed++))
fi
echo ""

# 检查 layout.tsx 是否引入 globals.css
echo "🎨 检查样式引入..."
if [ -f "app/layout.tsx" ] && grep -q 'import.*globals.css' app/layout.tsx; then
  echo -e "${GREEN}✓${NC} layout.tsx 正确引入 globals.css"
  ((passed++))
else
  echo -e "${RED}✗${NC} layout.tsx 未引入 globals.css"
  ((failed++))
fi
echo ""

# 检查 SQL 文件中的 SECURITY DEFINER
echo "🔐 检查 Trigger 修复..."
if grep -q "SECURITY DEFINER" supabase-schema.sql 2>/dev/null; then
  echo -e "${GREEN}✓${NC} SQL 包含 SECURITY DEFINER"
  ((passed++))
else
  echo -e "${RED}✗${NC} SQL 缺少 SECURITY DEFINER"
  ((failed++))
fi

if grep -q "SET search_path = public" supabase-schema.sql 2>/dev/null; then
  echo -e "${GREEN}✓${NC} SQL 包含 search_path 设置"
  ((passed++))
else
  echo -e "${RED}✗${NC} SQL 缺少 search_path 设置"
  ((failed++))
fi
echo ""

# 总结
echo "================================"
echo -e "验证完成！"
echo -e "${GREEN}通过: $passed${NC}"
echo -e "${RED}失败: $failed${NC}"
echo "================================"
echo ""

if [ $failed -eq 0 ]; then
  echo -e "${GREEN}🎉 所有检查通过！项目结构正确。${NC}"
  echo ""
  echo "下一步："
  echo "1. npm install"
  echo "2. 配置 .env.local"
  echo "3. npm run dev"
  exit 0
else
  echo -e "${RED}⚠️  发现 $failed 个问题，请检查上述失败项。${NC}"
  exit 1
fi
