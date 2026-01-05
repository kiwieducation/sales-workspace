"use client";


import React from 'react';
// Fix: Added ExternalLink to imports to resolve the missing reference error
import { BookOpen, FileSpreadsheet, Film, Layout, Share2, Search, ExternalLink } from 'lucide-react';

const KNOWLEDGE_ITEMS = [
  { title: '产品资料与竞品分析', type: 'sheet', url: 'https://doc.weixin.qq.com/sheet/e3_AN8ATQakAIEl0ePGY21QVei9wCqsI' },
  { title: '简道云工作系统使用手册', type: 'doc', url: 'https://doc.weixin.qq.com/doc/w3_AN8ATQakAIEXwpjqgBhT1aybwHrMB' },
  { title: '朋友圈文案要求与AI生成技巧', type: 'sheet', url: 'https://doc.weixin.qq.com/sheet/e3_AKsA_wakAIE0dPGtkiURsiHX5FSKR' },
];

const KnowledgeBase: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">企业知识库</h2>
          <p className="text-gray-500">柯维核心资产库：包含话术、案例、SOP及媒体素材。</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-100">上传新资料</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: BookOpen, label: '销售话术', color: 'bg-blue-50 text-blue-600' },
          { icon: Film, label: '视频号素材', color: 'bg-red-50 text-red-600' },
          { icon: FileSpreadsheet, label: '合作院校清单', color: 'bg-green-50 text-green-600' },
        ].map((cat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className={`p-3 rounded-xl ${cat.color}`}><cat.icon size={24}/></div>
            <span className="font-bold text-gray-800">{cat.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
          <h3 className="font-bold text-gray-900">核心文档列表</h3>
          <div className="relative">
             <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
             <input type="text" placeholder="关键词搜索文档..." className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 outline-none" />
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {KNOWLEDGE_ITEMS.map((item, idx) => (
            <div key={idx} className="p-4 hover:bg-blue-50/20 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-gray-100 rounded-lg text-gray-400 group-hover:bg-white group-hover:text-blue-500 transition-colors">
                  {item.type === 'sheet' ? <FileSpreadsheet size={18}/> : <Layout size={18}/>}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">{item.title}</h4>
                  <p className="text-[10px] text-gray-400">最后更新: 2023-11-01 • 共有 1,284 次查看</p>
                </div>
              </div>
              <div className="flex gap-2">
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Share2 size={18}/>
                </a>
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                >
                  <span>立即打开</span>
                  <ExternalLink size={12}/>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
