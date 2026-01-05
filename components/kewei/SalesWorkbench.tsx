"use client";


import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  UserPlus, 
  Timer, 
  Sparkles, 
  PhoneCall, 
  FileText, 
  ExternalLink,
  ChevronRight,
  MoreVertical,
  History,
  Image as ImageIcon,
  RefreshCw,
  X,
  Plus
} from 'lucide-react';
import { Customer, ChatRecord } from '@/lib/kewei/types';

const INITIAL_MOCK_CUSTOMERS: any[] = [
  { id: '1', name: '王同学', school: '美高 11年级', status: '待回复', time: '10分钟前', risk: true, grade: '11', age: 17, schoolType: '美高', source: 'WeChat' },
  { id: '2', name: '李妈妈', school: '上海公办高二', status: '跟进中', time: '2小时前', risk: false, grade: '11', age: 45, schoolType: '公办高中', source: 'WeChat' },
  { id: '3', name: '陈同学', school: '美本转学意向', status: '已约访', time: '昨天', risk: false, grade: '大一', age: 19, schoolType: '大学', source: 'Manual' },
];

const SalesWorkbench: React.FC = () => {
  const [customers, setCustomers] = useState(INITIAL_MOCK_CUSTOMERS);
  const [selectedId, setSelectedId] = useState('1');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  
  // Manual Form State
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    grade: '',
    age: '',
    schoolType: '',
    history: ''
  });

  const selectedCustomer = customers.find(c => c.id === selectedId) || customers[0];

  const handleSyncWeChat = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      console.log("Synced latest WeChat conversations");
    }, 1500);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = (customers.length + 1).toString();
    const entry = {
      id,
      name: newCustomer.name,
      school: `${newCustomer.schoolType} ${newCustomer.grade}`,
      status: '待回复',
      time: '刚刚',
      risk: false,
      grade: newCustomer.grade,
      age: parseInt(newCustomer.age),
      schoolType: newCustomer.schoolType,
      source: 'Manual' as const,
    };
    
    setCustomers([entry, ...customers]);
    setShowManualModal(false);
    setNewCustomer({ name: '', grade: '', age: '', schoolType: '', history: '' });
    setSelectedId(id);
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
                手动录入客户
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
                    onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                    type="text" 
                    placeholder="请输入姓名" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">年龄</label>
                  <input 
                    value={newCustomer.age}
                    onChange={e => setNewCustomer({...newCustomer, age: e.target.value})}
                    type="number" 
                    placeholder="请输入年龄" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">年级</label>
                  <input 
                    value={newCustomer.grade}
                    onChange={e => setNewCustomer({...newCustomer, grade: e.target.value})}
                    type="text" 
                    placeholder="如：高二 / 大一" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">高中/学校类型</label>
                  <select 
                    value={newCustomer.schoolType}
                    onChange={e => setNewCustomer({...newCustomer, schoolType: e.target.value})}
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
                  onChange={e => setNewCustomer({...newCustomer, history: e.target.value})}
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

      {/* Left: Customer Stream */}
      <div className="col-span-3 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30 shrink-0">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            会话列表 <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full">{customers.length}</span>
          </h3>
          <div className="flex gap-2">
            <button 
              onClick={handleSyncWeChat}
              disabled={isSyncing}
              title="同步企业微信会话"
              className={`p-1.5 rounded-lg transition-colors ${isSyncing ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={() => setShowManualModal(true)}
              title="手动录入新客户"
              className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <UserPlus size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {customers.map(c => (
            <div 
              key={c.id} 
              onClick={() => setSelectedId(c.id)}
              className={`p-4 border-b border-gray-50 cursor-pointer transition-all ${
                selectedId === c.id ? 'bg-blue-50/50 border-r-4 border-r-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-sm">{c.name}</span>
                  {c.source === 'Manual' && <span className="text-[8px] bg-gray-100 text-gray-400 px-1 py-0.5 rounded tracking-tighter uppercase font-bold">手动</span>}
                </div>
                <span className="text-[10px] text-gray-400">{c.time}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 truncate w-32">{c.school}</span>
                {c.risk && <Timer size={14} className="text-red-500 animate-pulse" />}
              </div>
            </div>
          ))}
          {customers.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-400">暂无客户记录</p>
            </div>
          )}
        </div>
      </div>

      {/* Middle: Chat & AI Brain */}
      <div className="col-span-6 flex flex-col gap-4 overflow-hidden">
        {/* Chat Log (Simulated) */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-5 flex flex-col shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                {selectedCustomer.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{selectedCustomer.name}</h4>
                <p className="text-[10px] text-green-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> 
                  {selectedCustomer.source === 'WeChat' ? '企微实时监听中' : '手动录入模式'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><PhoneCall size={18}/></button>
              <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><ImageIcon size={18}/></button>
              <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><MoreVertical size={18}/></button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
            {selectedCustomer.source === 'WeChat' ? (
              <>
                <div className="flex justify-start">
                  <div className="bg-gray-100 p-3 rounded-2xl rounded-tl-none text-sm text-gray-800 max-w-[80%]">
                    老师，我现在的背景想转学去南加大的商学院，希望大吗？
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-blue-600 p-3 rounded-2xl rounded-tr-none text-sm text-white max-w-[80%] shadow-lg shadow-blue-100">
                    南加大(USC)的Marshall商学院非常欢迎有明确规划的转学生。你能先提供一下目前的GPA和已经修过的先修课程吗？
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                <MessageSquare className="text-gray-300 mb-3" size={32} />
                <p className="text-sm text-gray-500 font-medium">手动录入客户会话</p>
                <p className="text-xs text-gray-400 mt-1">您可以手动记录对话概要，AI将基于此提供建议</p>
                <button className="mt-4 text-xs bg-white border border-gray-200 px-4 py-2 rounded-xl text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-all">
                  添加对话摘要
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-50 shrink-0">
            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mb-3 animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-[10px] mb-1.5">
                <Sparkles size={14} /> AI 决策层建议
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed mb-2">
                检测到客户处于「决策关键期」。建议：发送 11月 Marshall 商学院转学成功案例包，引导客户签署《初步评估表》。
              </p>
              <div className="flex gap-2">
                <button className="text-[9px] px-2 py-1 bg-white border border-blue-200 rounded-md hover:bg-blue-100 transition-colors font-medium">话术：侧面引导</button>
                <button className="text-[9px] px-2 py-1 bg-white border border-blue-200 rounded-md hover:bg-blue-100 transition-colors font-medium">素材：USC案例</button>
              </div>
            </div>
            <div className="flex gap-2">
              <textarea placeholder="输入回复或使用AI建议..." className="flex-1 bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500 h-11 resize-none" />
              <button className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700 transition-all shadow-md font-bold text-sm">发送</button>
            </div>
          </div>
        </div>

        {/* Action Quick Bar */}
        <div className="grid grid-cols-3 gap-3 shrink-0">
          <button className="bg-white p-3 rounded-2xl border border-gray-100 flex flex-col items-center gap-1.5 hover:border-blue-500 transition-all group shadow-sm">
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-all"><ImageIcon size={18}/></div>
            <span className="text-[10px] font-bold text-gray-700">生成朋友圈图</span>
          </button>
          <button className="bg-white p-3 rounded-2xl border border-gray-100 flex flex-col items-center gap-1.5 hover:border-blue-500 transition-all group shadow-sm">
            <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg group-hover:bg-orange-600 group-hover:text-white transition-all"><FileText size={18}/></div>
            <span className="text-[10px] font-bold text-gray-700">生成预签合同</span>
          </button>
          <button className="bg-white p-3 rounded-2xl border border-gray-100 flex flex-col items-center gap-1.5 hover:border-blue-500 transition-all group shadow-sm">
            <div className="p-1.5 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-600 group-hover:text-white transition-all"><ExternalLink size={18}/></div>
            <span className="text-[10px] font-bold text-gray-700">跳转简道云CRM</span>
          </button>
        </div>
      </div>

      {/* Right: User Persona & Learning Layer */}
      <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm overflow-hidden flex flex-col">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 shrink-0"><History size={16}/> 用户画像</h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-2">关键信息</p>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[9px] text-gray-500">添加日期</p><p className="text-xs font-bold">2023.10.20</p></div>
                <div><p className="text-[9px] text-gray-500">交互员工</p><p className="text-xs font-bold text-blue-600">Kate, Lin</p></div>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">背景档案</p>
              <div className="bg-gray-50 p-3 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-500">年级</span>
                  <span className="text-xs font-bold">{selectedCustomer.grade || '未完善'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-500">年龄</span>
                  <span className="text-xs font-bold">{selectedCustomer.age || '未完善'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-500">学校类型</span>
                  <span className="text-xs font-bold">{selectedCustomer.schoolType || '未完善'}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50/30 rounded-xl border border-blue-50">
              <p className="text-[9px] text-blue-500 uppercase font-bold tracking-wider mb-2">情绪监测</p>
              <div className="flex gap-1 mb-2">
                <div className="h-1 flex-1 bg-green-400 rounded-full"></div>
                <div className="h-1 flex-1 bg-green-400 rounded-full"></div>
                <div className="h-1 flex-1 bg-gray-200 rounded-full"></div>
                <div className="h-1 flex-1 bg-gray-200 rounded-full"></div>
              </div>
              <p className="text-[10px] text-green-600 font-medium">偏向积极：对案例反馈强烈</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">历史足迹</p>
              {[
                { event: '查看了 2024转学白皮书', date: '2h前' },
                { event: '视频号咨询转学GPA', date: '1天前' },
              ].map((h, i) => (
                <div key={i} className="flex gap-2 text-[11px] border-l-2 border-gray-100 pl-3 pb-3">
                  <span className="text-gray-900 leading-tight flex-1">{h.event}</span>
                  <span className="text-gray-400 text-[9px] whitespace-nowrap">{h.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg shrink-0">
          <h3 className="font-bold text-xs mb-2 flex items-center gap-2"><Sparkles size={16}/> 学习层分析</h3>
          <p className="text-[11px] text-blue-100 leading-relaxed mb-4">
            针对「{selectedCustomer.schoolType || '留学'}」客户，建议在对话中提及「11年级选课策略」。
          </p>
          <button className="w-full py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-[11px] font-black backdrop-blur-sm transition-all border border-white/10 shadow-sm">
            查看针对性 SOP
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesWorkbench;
