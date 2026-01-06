"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  UserPlus,
  Timer,
  Sparkles,
  RefreshCw,
  X,
  Send,
  ExternalLink,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "admin" | "consultant" | "viewer";

type ProfileRow = {
  id: string;
  name: string;
  role: Role;
  avatar_url?: string | null;
};

type CustomerRow = {
  id: string;
  name: string;
  grade: number | null;
  age: number | null;
  school_type: string | null;
};

type ConversationRow = {
  id: string;
  customer_id: string;
  owner_user_id: string;
  last_message_at: string | null;
  created_at?: string | null;
  customers?: CustomerRow | null; // joined
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_type: "user" | "customer";
  sender_id: string | null;
  content: string;
  created_at: string;
  sender?: ProfileRow | null; // joined
};

type CustomerInsightRow = {
  id: string;
  customer_id: string;
  emotion_score: number | null;
  engagement_level: string | null;
  historical_notes: any;
  tags: any;
  updated_at: string | null;
};

type AISuggestionRow = {
  id: string;
  conversation_id: string;
  stage: string;
  suggestion_type: string;
  title: string;
  content: string;
  priority: number | null;
  updated_at: string | null;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function timeAgo(input: string | null | undefined) {
  if (!input) return "—";
  const d = new Date(input);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "刚刚";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  return `${day}天前`;
}

function schoolLabel(c: CustomerRow | null | undefined) {
  if (!c) return "—";
  const parts: string[] = [];
  if (c.school_type) parts.push(c.school_type);
  if (c.grade !== null && c.grade !== undefined) parts.push(`${c.grade}年级`);
  return parts.length ? parts.join(" ") : "—";
}

function safeJsonArray(v: any): any[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function SalesWorkbench() {
  const supabase = useMemo(() => createClient(), []);

  const [booting, setBooting] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<ProfileRow | null>(null);

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );
  const selectedCustomer = selectedConversation?.customers || null;

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [insight, setInsight] = useState<CustomerInsightRow | null>(null);
  const [suggestion, setSuggestion] = useState<AISuggestionRow | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);

  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  // Manual modal (先保留 UI：仅 admin 可用，避免 RLS 失败)
  const [showManualModal, setShowManualModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    grade: "",
    age: "",
    schoolType: "",
    history: "",
  });

  function canCreateCustomer() {
    return currentProfile?.role === "admin";
  }
  function canSendMessage() {
    if (!currentProfile || !selectedConversation) return false;
    if (currentProfile.role === "admin") return true;
    if (currentProfile.role === "consultant") {
      return selectedConversation.owner_user_id === currentProfile.id;
    }
    return false;
  }

  async function loadSessionAndProfile() {
    const { data: authData, error } = await supabase.auth.getUser();
    if (error) {
      console.error("auth.getUser error:", error);
      setCurrentUserId(null);
      setCurrentProfile(null);
      return;
    }
    const user = authData.user;
    if (!user) {
      setCurrentUserId(null);
      setCurrentProfile(null);
      return;
    }
    setCurrentUserId(user.id);

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id,name,role,avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) {
      console.error("load profile error:", profErr);
      setCurrentProfile(null);
      return;
    }
    setCurrentProfile((prof as any) || null);
  }

  async function loadConversations() {
    const { data, error } = await supabase
      .from("conversations")
      .select(
        `
        id,
        customer_id,
        owner_user_id,
        last_message_at,
        created_at,
        customers:customer_id (
          id,
          name,
          grade,
          age,
          school_type
        )
      `
      )
      .order("last_message_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("load conversations error:", error);
      setConversations([]);
      setSelectedConversationId(null);
      return;
    }

    const rows = (data as any as ConversationRow[]) || [];
    setConversations(rows);
    if (!selectedConversationId && rows.length > 0) {
      setSelectedConversationId(rows[0].id);
    } else if (selectedConversationId && !rows.find((r) => r.id === selectedConversationId)) {
      setSelectedConversationId(rows[0]?.id || null);
    }
  }

  async function loadMessages(conversationId: string) {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(
          `
          id,
          conversation_id,
          sender_type,
          sender_id,
          content,
          created_at,
          sender:sender_id (
            id,
            name,
            role,
            avatar_url
          )
        `
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(300);

      if (error) {
        console.error("load messages error:", error);
        setMessages([]);
        return;
      }
      setMessages(((data as any) || []) as MessageRow[]);
      // scroll to bottom
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function loadInsight(customerId: string) {
    const { data, error } = await supabase
      .from("customer_insights")
      .select("id,customer_id,emotion_score,engagement_level,historical_notes,tags,updated_at")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (error) {
      console.error("load insight error:", error);
      setInsight(null);
      return;
    }
    setInsight((data as any) || null);
  }

  async function loadSuggestion(conversationId: string) {
    const { data, error } = await supabase
      .from("ai_suggestions")
      .select("id,conversation_id,stage,suggestion_type,title,content,priority,updated_at")
      .eq("conversation_id", conversationId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("load suggestion error:", error);
      setSuggestion(null);
      return;
    }
    setSuggestion(((data as any) || [])[0] || null);
  }

  async function handleSend() {
    const text = composer.trim();
    if (!text || !selectedConversation || !currentProfile) return;
    if (!canSendMessage()) return;

    setSending(true);
    try {
      const tempId = `tmp-${Date.now()}`;
      const optimistic: MessageRow = {
        id: tempId,
        conversation_id: selectedConversation.id,
        sender_type: "user",
        sender_id: currentProfile.id,
        content: text,
        created_at: new Date().toISOString(),
        sender: currentProfile,
      };
      setMessages((prev) => [...prev, optimistic]);
      setComposer("");
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }, 50);

      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedConversation.id,
        sender_type: "user",
        sender_id: currentProfile.id,
        content: text,
      });

      if (error) {
        console.error("send message error:", error);
        // rollback optimistic
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setComposer(text);
        return;
      }

      // refresh conversation list for last_message_at ordering
      await loadConversations();
      // reload messages from server (确保 id / created_at 正确)
      await loadMessages(selectedConversation.id);
      await loadSuggestion(selectedConversation.id);
    } finally {
      setSending(false);
    }
  }

  async function handleSync() {
    // 占位：未来接企微同步；现在保持按钮体验
    setIsSyncing(true);
    try {
      await loadConversations();
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreateCustomer()) return;

    const name = newCustomer.name.trim();
    if (!name) return;

    const gradeNum = newCustomer.grade.trim() ? Number(newCustomer.grade.trim()) : null;
    const ageNum = newCustomer.age.trim() ? Number(newCustomer.age.trim()) : null;

    // 1) create customer
    const { data: cust, error: custErr } = await supabase
      .from("customers")
      .insert({
        name,
        grade: Number.isFinite(gradeNum as any) ? gradeNum : null,
        age: Number.isFinite(ageNum as any) ? ageNum : null,
        school_type: newCustomer.schoolType || null,
      })
      .select("id,name,grade,age,school_type")
      .single();

    if (custErr) {
      console.error("create customer error:", custErr);
      return;
    }

    // 2) create conversation owned by current user
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .insert({
        customer_id: (cust as any).id,
        owner_user_id: currentProfile?.id,
      })
      .select(
        `
        id,
        customer_id,
        owner_user_id,
        last_message_at,
        created_at,
        customers:customer_id (id,name,grade,age,school_type)
      `
      )
      .single();

    if (convErr) {
      console.error("create conversation error:", convErr);
      return;
    }

    // 3) optional: seed a "customer" message from history
    const history = newCustomer.history.trim();
    if (history) {
      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: (conv as any).id,
        sender_type: "customer",
        sender_id: null,
        content: history,
      });
      if (msgErr) console.error("seed history msg error:", msgErr);
    }

    setShowManualModal(false);
    setNewCustomer({ name: "", grade: "", age: "", schoolType: "", history: "" });

    await loadConversations();
    setSelectedConversationId((conv as any).id);
  }

  // boot
  useEffect(() => {
    (async () => {
      setBooting(true);
      await loadSessionAndProfile();
      await loadConversations();
      setBooting(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when selection changes -> load messages + insight + suggestion
  useEffect(() => {
    if (!selectedConversationId) return;
    (async () => {
      await loadMessages(selectedConversationId);
      const conv = conversations.find((c) => c.id === selectedConversationId) || null;
      const customerId = conv?.customer_id;
      if (customerId) await loadInsight(customerId);
      await loadSuggestion(selectedConversationId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

  const convoCount = conversations.length;

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-10rem)] relative overflow-hidden">
      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <UserPlus size={20} className="text-blue-600" />
                手动录入客户
              </h3>
              <button onClick={() => setShowManualModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
              {!canCreateCustomer() && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  当前账号角色为 <b>{currentProfile?.role || "未知"}</b>，按现有 RLS 规则仅 <b>admin</b> 可新建客户/会话。
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">客户姓名</label>
                  <input
                    required
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    type="text"
                    placeholder="请输入姓名"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    disabled={!canCreateCustomer()}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">年龄</label>
                  <input
                    value={newCustomer.age}
                    onChange={(e) => setNewCustomer({ ...newCustomer, age: e.target.value })}
                    type="number"
                    placeholder="请输入年龄"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    disabled={!canCreateCustomer()}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">年级</label>
                  <input
                    value={newCustomer.grade}
                    onChange={(e) => setNewCustomer({ ...newCustomer, grade: e.target.value })}
                    type="text"
                    placeholder="如：11"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    disabled={!canCreateCustomer()}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">高中/学校类型</label>
                  <select
                    value={newCustomer.schoolType}
                    onChange={(e) => setNewCustomer({ ...newCustomer, schoolType: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    disabled={!canCreateCustomer()}
                  >
                    <option value="">请选择</option>
                    <option value="公办高中">公办高中</option>
                    <option value="国际学校">国际学校</option>
                    <option value="美高">美高</option>
                    <option value="大学">大学</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">对话记录导入/备注</label>
                <textarea
                  value={newCustomer.history}
                  onChange={(e) => setNewCustomer({ ...newCustomer, history: e.target.value })}
                  placeholder="手动录入关键对话信息或需求背景..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all h-32 resize-none"
                  disabled={!canCreateCustomer()}
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!canCreateCustomer()}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold shadow-lg transition-all",
                    canCreateCustomer() ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100" : "bg-gray-200 text-gray-500 shadow-none cursor-not-allowed"
                  )}
                >
                  保存并跟进
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Left: Conversation List */}
      <div className="col-span-3 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30 shrink-0">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            会话列表{" "}
            <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full">
              {convoCount}
            </span>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              title="刷新会话"
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                isSyncing ? "bg-gray-100 text-gray-400" : "bg-green-50 text-green-600 hover:bg-green-100"
              )}
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowManualModal(true)}
              title={canCreateCustomer() ? "手动录入新客户" : "仅 admin 可新建"}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                canCreateCustomer() ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
              disabled={!canCreateCustomer()}
            >
              <UserPlus size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {booting ? (
            <div className="p-8 text-center text-sm text-gray-400">加载中…</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-400">暂无会话</p>
              <p className="text-xs text-gray-400 mt-1">请先在 Supabase 插入 conversations / messages</p>
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = selectedConversationId === c.id;
              const cust = c.customers;
              const isRisk = false; // 你可以后续接规则：例如超时未回复、情绪分等
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedConversationId(c.id)}
                  className={cn(
                    "p-4 border-b border-gray-50 cursor-pointer transition-all",
                    isActive ? "bg-blue-50/50 border-r-4 border-r-blue-600" : "hover:bg-gray-50"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-gray-900 text-sm truncate">{cust?.name || "未命名客户"}</span>
                      {c.owner_user_id === currentUserId && (
                        <span className="text-[8px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded tracking-tighter uppercase font-bold">
                          我的
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">{timeAgo(c.last_message_at)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 truncate w-40">{schoolLabel(cust)}</span>
                    {isRisk && <Timer size={14} className="text-red-500 animate-pulse" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Middle: Chat */}
      <div className="col-span-6 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare size={18} className="text-blue-600" />
            <div className="min-w-0">
              <div className="font-bold text-gray-900 truncate">
                {selectedCustomer?.name || "请选择一个会话"}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {selectedCustomer ? schoolLabel(selectedCustomer) : "—"}
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            {currentProfile ? (
              <span>
                当前身份：<b className="text-gray-800">{currentProfile.name}</b>{" "}
                <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                  {currentProfile.role}
                </span>
              </span>
            ) : (
              <span className="text-red-500">未登录 / 未找到 profile</span>
            )}
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
          {loadingMessages ? (
            <div className="text-sm text-gray-400 text-center py-8">加载消息中…</div>
          ) : selectedConversationId && messages.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-8">暂无消息</div>
          ) : (
            messages.map((m) => {
              const isUser = m.sender_type === "user";
              const name = isUser ? (m.sender?.name || "顾问") : (selectedCustomer?.name || "客户");
              return (
                <div key={m.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-4 py-3 border text-sm leading-relaxed",
                      isUser
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-gray-50 text-gray-800 border-gray-100"
                    )}
                  >
                    <div className={cn("text-[10px] mb-1", isUser ? "text-blue-100" : "text-gray-400")}>
                      {name} · {new Date(m.created_at).toLocaleString()}
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="p-4 border-t border-gray-50 bg-gray-50/30">
          {!selectedConversationId ? (
            <div className="text-sm text-gray-400">请选择会话后开始回复</div>
          ) : !canSendMessage() ? (
            <div className="text-sm text-gray-400">
              当前账号无权限发送消息（viewer 或非本人会话）。
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder="输入回复内容…"
                className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!sending) handleSend();
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !composer.trim()}
                className={cn(
                  "px-4 py-2.5 rounded-xl font-bold inline-flex items-center gap-2",
                  sending || !composer.trim()
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                <Send size={16} />
                发送
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Panels */}
      <div className="col-span-3 space-y-6 overflow-y-auto pr-1">
        {/* Insight */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-gray-900 flex items-center gap-2">
              <Sparkles size={16} className="text-purple-600" />
              客户画像
            </div>
            <div className="text-[10px] text-gray-400">
              {insight?.updated_at ? `更新：${timeAgo(insight.updated_at)}` : ""}
            </div>
          </div>

          {selectedCustomer ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-xl bg-gray-50 p-3 border border-gray-100">
                  <div className="text-[10px] text-gray-400 font-bold">情绪分</div>
                  <div className="text-lg font-black text-gray-900">
                    {insight?.emotion_score ?? "—"}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 border border-gray-100">
                  <div className="text-[10px] text-gray-400 font-bold">互动</div>
                  <div className="text-lg font-black text-gray-900">
                    {insight?.engagement_level ?? "—"}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <div className="text-xs font-bold text-gray-600 mb-2">标签</div>
                <div className="flex flex-wrap gap-2">
                  {safeJsonArray(insight?.tags).length ? (
                    safeJsonArray(insight?.tags).map((t, idx) => (
                      <span
                        key={`${t}-${idx}`}
                        className="text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
                      >
                        {String(t)}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">暂无</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-600 mb-2">历史节点</div>
                <div className="space-y-2">
                  {safeJsonArray(insight?.historical_notes).length ? (
                    safeJsonArray(insight?.historical_notes).slice(0, 5).map((h: any, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                      >
                        <div className="text-[10px] text-gray-400 font-bold">{h?.date || "—"}</div>
                        <div>{h?.event || JSON.stringify(h)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-400">暂无</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400">请选择会话查看客户画像</div>
          )}
        </div>

        {/* AI Suggestion */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-gray-900 flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-600" />
              AI 建议
            </div>
            <div className="text-[10px] text-gray-400">
              {suggestion?.updated_at ? `更新：${timeAgo(suggestion.updated_at)}` : ""}
            </div>
          </div>

          {selectedConversationId ? (
            suggestion ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-500">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 mr-2">
                    {suggestion.stage}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                    {suggestion.suggestion_type}
                  </span>
                </div>
                <div className="text-sm font-black text-gray-900">{suggestion.title}</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {suggestion.content}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400">暂无 AI 建议（ai_suggestions 表为空或无权限）</div>
            )
          ) : (
            <div className="text-sm text-gray-400">请选择会话查看 AI 建议</div>
          )}

          {/* Quick links (占位) */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 mt-4">
            <div className="text-sm font-bold text-gray-900 mb-2">快捷操作</div>
            <div className="grid grid-cols-2 gap-2">
              <button className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2">
                <ExternalLink size={14} />
                打开资料
              </button>
              <button className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2">
                <FileText size={14} />
                导出记录
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
