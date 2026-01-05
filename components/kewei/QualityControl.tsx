"use client";


import React from 'react';
import { ShieldAlert, TrendingDown, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

const QualityControl: React.FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">合规与质量监督</h2>
        <p className="text-gray-500">维护柯维服务标准，确保护每一位客户获得即时且专业的咨询。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-red-100 bg-gradient-to-br from-white to-red-50/30">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-xl"><ShieldAlert size={24}/></div>
            <span className="text-xs font-bold text-red-500 px-2 py-1 bg-white rounded-lg border border-red-100 shadow-sm">高危</span>
          </div>
          <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">超时未回复客户</h3>
          <p className="text-3xl font-black text-gray-900 mt-2">4 <span className="text-sm font-normal text-gray-400">人</span></p>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-red-600 font-bold">
            <AlertCircle size={12}/> 需在 24 小时内完成跟进，否则将计入绩效。
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-amber-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><TrendingDown size={24}/></div>
          </div>
          <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">今日流失率 (美高/转学)</h3>
          <p className="text-3xl font-black text-gray-900 mt-2">12%</p>
          <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-amber-500 h-1.5 rounded-full" style={{width: '12%'}}></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-green-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-xl"><CheckCircle size={24}/></div>
          </div>
          <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">朋友圈发布合规数</h3>
          <p className="text-3xl font-black text-gray-900 mt-2">95 <span className="text-sm font-normal text-gray-400">/ 100</span></p>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-green-600 font-bold">
            平均发布频率: 1.2条/天
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-900">响应效率实时榜</h3>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {[
              { name: 'Kate', time: '4.2min', status: 'Excellent', color: 'text-green-600' },
              { name: 'Lin', time: '12.5min', status: 'Good', color: 'text-blue-600' },
              { name: 'Zhao', time: '128min', status: 'Warning', color: 'text-amber-600' },
              { name: 'Chen', time: '48.2h', status: 'Critical', color: 'text-red-600' },
            ].map((staff, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-600">{staff.name.charAt(0)}</div>
                   <div>
                     <p className="text-sm font-bold text-gray-900">{staff.name}</p>
                     <p className="text-[10px] text-gray-400">平均首访响应</p>
                   </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-black ${staff.color}`}>{staff.time}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">{staff.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityControl;
