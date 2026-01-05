
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  UserPlus,
  Timer,
  Sparkles,
  PhoneCall,
  FileText,
  ExternalLink,
  MoreVertical,
  RefreshCw,
  X,
  Send,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "admin" | "consultant" | "viewer";

type ConversationRow = {
  id: string;
  last_message_at: string | null;
  created_at: string | null;
  customer: {
    id: string;
    name: string;
    grade: number | null;
    age: number | null;
    school_type: string | null;
  } | null;
  owner: {
    id: string;
    name: string | null;
    role: Role | null;
  } | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_type: "user" | "customer";
  sender_id: string | null;
  content: string;
  created_at: string;
  sender: { id: string; name: string | null } | null;
};

type InsightRow = {
  id: string;
  customer_id: string;
  emotion_score: number | null;
  engagement_level: string | null;
  historical_notes: any;
  tags: any;
};

type SuggestionRow = {
  id: string;
  conversation_id: string;
  stage: string;
  suggestion_type: string;
  title: string;
  content: string;
  priority: number | null;
};

function timeLabel(iso?: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  return `${d}天前`;
}

function schoolLabel(c: ConversationRow["customer"]) {
  if (!c) return "";
  const parts: string[] = [];
  if (c.school_type) parts.push(c.school_type);
  if (c.grade !== null && c.grade !== undefined) parts.push(`${c.grade}年级`);
  if (!parts.length) return "";
  return parts.join(" ");
}

export default function SalesWorkbench() {
  const supabase = useMemo(() => createClient(), []);

  // auth/profile
  const [me, setMe] = useState<{ id: string; email: string | null; role: Role | null; name: string | null } | null>(null);

  // conversations
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) || conversations[0] || null,
    [conversations, selectedConversationId]
  );
  const selectedCustomer = selectedConversation?.customer || null;

  // messages
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  // right panel
  const [insight, setInsight] = useState<InsightRow | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);

  // ui
  const [isSyncing, setIsSyncing] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // Manual Form State
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    grade: "",
    age: "",
    schoolType: "",
    history: "",
  });

  async function loadMe() {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      setMe(null);
      return null;
    }

    const { data: p } = await supabase
      .from("profiles")
      .select("id,name,role")
      .eq("id", user.id)
      .maybeSingle();

    const meObj = {
      id: user.id,
      email: user.email ?? null,
      name: (p as any)?.name ?? null,
      role: ((p as any)?.role ?? null) as Role | null,
    };
    setMe(meObj);
    return meObj;
  }

  async function loadConversations() {
    const { data, error } = await supabase
      .from("conversations")
      .select(
        `
        id,
        last_message_at,
        created_at,
        customer:customers(id,name,grade,age,school_type),
        owner:profiles!conversations_owner_user_id_fkey(id,name,role)
      `
      )
      .order("last_message_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as any as ConversationRow[];
    setConversations(rows);
    if (!selectedConversationId && rows.length > 0) setSelectedConversationId(rows[0].id);
  }

  async function loadMessages(conversationId: string) {
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
        sender:profiles(id,name)
      `
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    setMessages((data ?? []) as any);
  }

  async function loadInsightAndSuggestions(customerId: string, conversationId: string) {
    const [{ data: iData, error: iErr }, { data: sData, error: sErr }] = await Promise.all([
      supabase
        .from("customer_insights")
        .select("id,customer_id,emotion_score,engagement_level,historical_notes,tags")
        .eq("customer_id", customerId)
        .maybeSingle(),
      supabase
        .from("ai_suggestions")
        .select("id,conversation_id,stage,suggestion_type,title,content,priority")
        .eq("conversation_id", conversationId)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false }),
    ]);

    if (iErr) throw iErr;
    if (sErr) throw sErr;

    setInsight((iData ?? null) as any);
    setSuggestions((sData ?? []) as any);
  }

  useEffect(() => {
    (async () => {
      await loadMe();
      await loadConversations();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedConversation?.id) return;

    (async () => {
      await loadMessages(selectedConversation.id);
      if (selectedConversation.customer?.id) {
        await loadInsightAndSuggestions(selectedConversation.customer.id, selectedConversation.id);
      } else {
        setInsight(null);
        setSuggestions([]);
      }
      // scroll to bottom
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  const canSendMessage = useMemo(() => {
    if (!me?.id) return false;
    if (!selectedConversation) return false;
    if (me.role === "admin") return true;
    if (me.role === "consultant") return selectedConversation.owner?.id === me.id;
    return false;
  }, [me, selectedConversation]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await loadConversations();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me?.id) {
      alert("请先登录");
      return;
    }
    if (me.role !== "admin") {
      alert("当前账号无权限创建客户（需要 Admin）。请用 admin@mykiwiedu.com 登录后创建。");
      return;
    }

    const gradeNum = newCustomer.grade ? Number(newCustomer.grade) : null;
    const ageNum = newCustomer.age ? Number(newCustomer.age) : null;

    // 1) customers insert（RLS: admin 才能）
    const { data: cust, error: e1 } = await supabase
      .from("customers")
      .insert({
        name: newCustomer.name,
        grade: Number.isFinite(gradeNum as any) ? gradeNum : null,
        age: Number.isFinite(ageNum as any) ? ageNum : null,
        school_type: newCustomer.schoolType || null,
      })
      .select("id")
      .single();

    if (e1) {
      alert(e1.message);
      return;
    }

    // 2) conversations insert（你当前策略：只有 admin ALL）
    const { data: conv, error: e2 } = await supabase
      .from("conversations")
      .insert({
        customer_id: cust.id,
        owner_user_id: me.id,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (e2) {
      alert(e2.message);
      return;
    }

    // 3) 可选：把 history 作为一条“客户消息”写入 messages（如果你想保留导入备注）
    if (newCustomer.history?.trim()) {
      await supabase.from("messages").insert({
        conversation_id: conv.id,
        sender_type: "customer",
        sender_id: null,
        content: `【导入/备注】\n${newCustomer.history.trim()}`,
      });
    }

    setShowManualModal(false);
    setNewCustomer({ name: "", grade: "", age: "", schoolType: "", history: "" });

    await loadConversations();
    setSelectedConversationId(conv.id);
  };

  const handleSend = async () => {
    if (!selectedConversation?.id) return;
    if (!me?.id) return;
    const text = messageInput.trim();
    if (!text) return;

    if (!canSendMessage) {
      alert("无权限发送：顾问只能编辑自己的会话（admin 例外）。");
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedConversation.id,
        sender_type: "user",
        sender_id: me.id,
        content: text,
      });
      if (error) throw error;

      setMessageInput("");
      await loadMessages(selectedConversation.id);
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err: any) {
      alert(err?.message ?? "发送失败");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-10rem)] relative overflow-hidden">
      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <UserPlus size={20} className="text-blue-600" />
                手动录入客户（Admin）
              </h3>
              <button onClick={() => setShowManualModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
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
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">年级（数字）</label>
                  <input
                    value={newCustomer.grade}
                    onChange={(e) => setNewCustomer({ ...newCustomer, grade: e.target.value })}
                    type="number"
                    placeholder="如：11"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">学校类型</label>
                  <select
                    value={newCustomer.schoolType}
                    onChange={(e) => setNewCustomer({ ...newCustomer, schoolType: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
                >
                  保存并跟进
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Left: Conversation Stream */}
      <div className="col-span-3 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30 shrink-0">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            会话列表{" "}
            <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full">
              {conversations.length}
            </span>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              title="刷新会话"
              className={`p-1.5 rounded-lg transition-colors ${
                isSyncing ? "bg-gray-100 text-gray-400" : "bg-green-50 text-green-600 hover:bg-green-100"
              }`}
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowManualModal(true)}
              title="手动录入新客户（Admin）"
              className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <UserPlus size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {conversations.map((conv) => {
            const c = conv.customer;
            const name = c?.name ?? "未命名";
            const time = timeLabel(conv.last_message_at ?? conv.created_at);
            const school = schoolLabel(c);
            const risk = false; // 你后面想做“待回复/超时风险”时再加逻辑

            return (
              <div
                key={conv.id}
                onClick={() => setSelectedConversationId(conv.id)}
                className={`p-4 border-b border-gray-50 cursor-pointer transition-all ${
                  selectedConversationId === conv.id ? "bg-blue-50/50 border-r-4 border-r-blue-600" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">{name}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 truncate w-32">{school}</span>
                  {risk && <Timer size={14} className="text-red-500 animate-pulse" />}
                </div>
              </div>
            );
          })}

          {conversations.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-400">暂无会话</p>
            </div>
          )}
        </div>
      </div>

      {/* Middle: Chat */}
      <div className="col-span-6 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900 truncate">
                {selectedCustomer?.name ?? "未选择会话"}
              </h3>
            </div>
            <div className="mt-1 text-xs text-gray-500 truncate">
              {selectedCustomer ? `${schoolLabel(selectedCustomer)} · ${selectedCustomer.age ? `${selectedCustomer.age}岁` : ""}` : "请选择左侧会话"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50" title="电话回访（占位）">
              <PhoneCall size={16} />
            </button>
            <button className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50" title="导出（占位）">
              <FileText size={16} />
            </button>
            <button className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50" title="更多">
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => {
            const isMe = m.sender_type === "user";
            const label = isMe ? (m.sender?.name || me?.name || "我") : (selectedCustomer?.name || "客户");
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isMe ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-900 border border-gray-100"
                }`}>
                  <div className={`text-[11px] mb-1 ${isMe ? "text-blue-100" : "text-gray-400"}`}>
                    {label} · {timeLabel(m.created_at)}
                  </div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            );
          })}
          <div ref={listEndRef} />
        </div>

        <div className="border-t border-gray-100 p-3 bg-white">
          <div className="flex gap-2 items-end">
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={canSendMessage ? "输入回复…" : "无权限发送（顾问只能编辑自己的会话）"}
              className="flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              disabled={!canSendMessage || sending || !selectedConversation}
            />
            <button
              onClick={handleSend}
              disabled={!canSendMessage || sending || !selectedConversation || !messageInput.trim()}
              className={`h-11 px-4 rounded-2xl font-bold text-sm inline-flex items-center gap-2 ${
                (!canSendMessage || sending || !selectedConversation || !messageInput.trim())
                  ? "bg-gray-100 text-gray-400"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
              title="发送"
            >
              <Send size={16} />
              发送
            </button>
          </div>
        </div>
      </div>

      {/* Right: AI + Profile */}
      <div className="col-span-3 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-50 bg-gray-50/30 shrink-0">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={18} className="text-purple-600" />
            AI & 客户画像
          </h3>
          <div className="mt-1 text-xs text-gray-500">
            {selectedCustomer ? "根据当前会话生成建议" : "请选择会话查看"}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Insight */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="text-sm font-bold text-gray-900 mb-2">客户画像</div>
            {!selectedCustomer ? (
              <div className="text-sm text-gray-400">暂无数据</div>
            ) : (
              <>
                <div className="text-xs text-gray-500 mb-2">情绪分 / 参与度</div>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-gray-900">{insight?.emotion_score ?? 50}</div>
                  <div className="text-xs text-gray-500">
                    {insight?.engagement_level ?? "medium"}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-1">标签</div>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(insight?.tags) ? insight?.tags : []).slice(0, 6).map((t: any, i: number) => (
                      <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                        {String(t)}
                      </span>
                    ))}
                    {(!insight?.tags || (Array.isArray(insight.tags) && insight.tags.length === 0)) && (
                      <span className="text-[11px] text-gray-400">暂无</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Suggestions */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold text-gray-900">AI 建议</div>
              <button className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1" onClick={async () => {
                if (selectedConversation?.id && selectedCustomer?.id) {
                  await loadInsightAndSuggestions(selectedCustomer.id, selectedConversation.id);
                }
              }}>
                <RefreshCw size={14} />
                刷新
              </button>
            </div>

            {suggestions.length === 0 ? (
              <div className="text-sm text-gray-400">暂无建议</div>
            ) : (
              <div className="space-y-3">
                {suggestions.slice(0, 5).map((s) => (
                  <div key={s.id} className="rounded-2xl border border-gray-100 p-3 bg-gray-50/40">
                    <div className="text-xs text-gray-500 mb-1">
                      {s.stage} · {s.suggestion_type}
                    </div>
                    <div className="text-sm font-bold text-gray-900">{s.title}</div>
                    <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{s.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick links (占位) */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
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