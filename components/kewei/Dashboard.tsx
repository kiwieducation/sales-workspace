"use client";


import React from 'react';
import { 
  Users, 
  TrendingUp, 
  GraduationCap, 
  FileCheck2,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  AlertCircle,
  Timer,
  CheckCircle,
  TrendingDown,
  ChevronRight,
  // Added Sparkles icon import to fix the "Cannot find name 'Sparkles'" error on line 232
  Sparkles
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const data = [
  { name: '10-25', conversion: 40, quality: 95 },
  { name: '10-26', conversion: 30, quality: 88 },
  { name: '10-27', conversion: 45, quality: 92 },
  { name: '10-28', conversion: 27, quality: 99 },
  { name: '10-29', conversion: 50, quality: 94 },
  { name: '10-30', conversion: 60, quality: 97 },
];

const staffPerformance = [
  { name: 'Kate', time: 4.2, status: '优秀', score: 98 },
  { name: 'Lin', time: 12.5, status: '良好', score: 85 },
  { name: 'Zhao', time: 128, status: '待改进', score: 62 },
  { name: 'Chen', time: 245, status: '风险', score: 45 },
];

const StatCard = ({ title, value, icon: Icon, change, isPositive, subtitle, urgent }: any) => (
  <div className={`bg-white p-6 rounded-2xl shadow-sm border ${urgent ? 'border-red-100 bg-red-50/10' : 'border-gray-100'} hover:shadow-md transition-all`}>
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${urgent ? 'bg-red-100 text-red-600' : isPositive ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
        <Icon size={24} />
      </div>
      {change && (
        <div className={`flex items-center space-x-1 text-xs font-bold px-2 py-1 rounded-full ${
          isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
        }`}>
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <span>{change}%</span>
        </div>
      )}
    </div>
    <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
    <div className="flex items-baseline space-x-2">
      <p className={`text-2xl font-black mt-1 ${urgent ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
      {subtitle && <span className="text-xs text-gray-400 font-medium">{subtitle}</span>}
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Info */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">指挥中心</h2>
          <p className="text-gray-500 mt-1">整合运营数据、员工表现及合规预警，实时驱动业务决策。</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-600" />
            <div className="text-xs">
              <p className="font-bold text-amber-800">4 条超24小时未跟进</p>
              <p className="text-amber-600 opacity-80">点击查看待复盘列表</p>
            </div>
            <ChevronRight size={14} className="text-amber-400 ml-2" />
          </div>
          <button className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center space-x-2 hover:bg-blue-700 transition-colors">
            <TrendingUp size={18} />
            <span>生成周度经营复盘</span>
          </button>
        </div>
      </div>

      {/* Stats Grid: Integrated Business & Quality */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="实时会话量" value="1,284" icon={Users} change={12} isPositive={true} subtitle="较上周" />
        <StatCard title="月度成交总额" value="¥2.48M" icon={FileCheck2} change={8} isPositive={true} />
        <StatCard title="超时未回复 (24h)" value="4" icon={AlertCircle} urgent={true} subtitle="高危质检项" />
        <StatCard title="平均转化率" value="98.2%" icon={GraduationCap} change={2} isPositive={true} />
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Conversion & Quality Trends */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-gray-900">业务趋势分析</h3>
                <p className="text-xs text-gray-400">成交转化 vs 合规分数</p>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-[10px] font-bold text-blue-700 uppercase">转化量</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 rounded-lg">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <span className="text-[10px] font-bold text-indigo-700 uppercase">质检分</span>
                </div>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="conversion" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorConv)" />
                  <Area type="monotone" dataKey="quality" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Staff Ranking (from QualityControl) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Timer size={18} className="text-blue-500" /> 响应效率实时榜
              </h3>
              <div className="space-y-5">
                {staffPerformance.map((staff, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {staff.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{staff.name}</p>
                        <p className="text-[10px] text-gray-400">合规分: {staff.score}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${i < 2 ? 'text-green-600' : 'text-red-500'}`}>{staff.time}m</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        i < 2 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>{staff.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Churn Analysis (from QualityControl) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingDown size={18} className="text-red-500" /> 异常与流失分析
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-bold text-gray-600 uppercase">月度流失率 (美高)</span>
                    <span className="text-red-500 font-black">12.5%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: '12.5%' }}></div>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2 text-blue-700 font-bold text-[10px] mb-1">
                    <CheckCircle size={12} /> 朋友圈合规达成度
                  </div>
                  <p className="text-lg font-black text-blue-900">95 / 100 <span className="text-[10px] font-medium text-blue-600">条</span></p>
                </div>
                <button className="w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-xs font-bold text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all uppercase tracking-widest">
                  填写流失客户复盘表
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Department Health & Quick Actions */}
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-6">各部门协同效能</h3>
            <div className="space-y-6">
              {[
                { label: '咨询部 (响应率)', progress: 85, color: 'bg-blue-600' },
                { label: '文案部 (交付率)', progress: 62, color: 'bg-indigo-600' },
                { label: '申请部 (成功率)', progress: 98, color: 'bg-emerald-600' },
                { label: '运营部 (合规率)', progress: 92, color: 'bg-purple-600' },
              ].map((dept, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-bold text-gray-700 uppercase">{dept.label}</span>
                    <span className="text-gray-500 font-black">{dept.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`${dept.color} h-1.5 rounded-full transition-all duration-1000 shadow-sm`} 
                      style={{ width: `${dept.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-200">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Sparkles size={20} /> AI 决策助手
            </h3>
            <p className="text-xs text-blue-100 leading-relaxed mb-6">
              分析发现：Kate 老师在处理「美本转学」咨询时，提及「GPA先修课」的对话响应合规率最高，建议全员学习该话术。
            </p>
            <div className="space-y-3">
              <button className="w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold backdrop-blur-md transition-all border border-white/20">
                查看全员学习案例
              </button>
              <button className="w-full py-2.5 bg-white text-blue-700 rounded-xl text-xs font-black shadow-lg hover:bg-blue-50 transition-all">
                开启月度效能AI诊断
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-widest">最近质检异常报告</h3>
            <div className="space-y-4">
              {[
                { type: '挑客户', staff: 'Lin', time: '10:24', status: '已预警' },
                { type: '超时', staff: 'Zhao', time: '昨日', status: '待处理' },
              ].map((err, i) => (
                <div key={i} className="flex items-center justify-between text-xs border-l-4 border-red-500 pl-3">
                  <div>
                    <p className="font-black text-gray-800">{err.type} 行为检测</p>
                    <p className="text-gray-400">{err.staff} • {err.time}</p>
                  </div>
                  <span className="text-red-500 font-bold">{err.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
