"use client";


import React from 'react';
import { FileText, Send, Clock, CheckCircle2, FileSignature, Plus } from 'lucide-react';

const ContractCenter: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">合同中心</h2>
          <p className="text-gray-500">标准化合同样本、法大大电子签章集成及财务审批流。</p>
        </div>
        <button className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-100 flex items-center gap-2">
          <Plus size={18}/> 新建合同
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: '美高申请服务协议', count: 12 },
          { label: '美本转学咨询协议', count: 45 },
          { label: '文书单项润色协议', count: 8 },
          { label: '签证指导服务协议', count: 15 },
        ].map((tpl, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 hover:border-blue-500 transition-all cursor-pointer group">
            <div className="p-2 bg-gray-50 rounded-lg text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all mb-3 w-fit">
              <FileSignature size={20}/>
            </div>
            <h4 className="text-xs font-bold text-gray-700">{tpl.label}</h4>
            <p className="text-[10px] text-gray-400 mt-1">已使用: {tpl.count}次</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-900">待办事务</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {[
            { client: '张同学', type: '美高申请', amount: '¥48,000', status: '待审批', icon: Clock, color: 'text-amber-500' },
            { client: '李同学', type: '美本转学', amount: '¥35,000', status: '待签署', icon: Send, color: 'text-blue-500' },
            { client: '赵同学', type: '文书包', amount: '¥12,000', status: '已归档', icon: CheckCircle2, color: 'text-green-500' },
          ].map((item, i) => (
            <div key={i} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-all">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full bg-gray-50 ${item.color}`}>
                  <item.icon size={20}/>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{item.client} - {item.type}</h4>
                  <p className="text-xs text-gray-500 font-medium">{item.amount}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                 <div className="text-right">
                    <p className={`text-xs font-bold ${item.color}`}>{item.status}</p>
                    <p className="text-[10px] text-gray-400">2023-11-02 14:00</p>
                 </div>
                 <button className="text-gray-400 hover:text-blue-600 transition-colors">
                   <Plus className="rotate-45" size={20}/>
                 </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContractCenter;
