"use client";


import React from 'react';
import { AppStatus } from '@/lib/kewei/types';
import { Clock, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

const TRACKING_DATA = [
  { student: '张小凡', school: 'Columbia University', program: 'MS in CS', status: AppStatus.SUBMITTED, date: '2023-11-01', portalUrl: '#' },
  { student: '李若冰', school: 'University of Oxford', program: 'BA Economics', status: AppStatus.OFFER_RECEIVED, date: '2023-10-15', portalUrl: '#' },
  { student: '陆雪琪', school: 'NUS', program: 'Bachelor of Computing', status: AppStatus.VISA_PROCESSING, date: '2023-10-30', portalUrl: '#' },
  { student: '王也', school: 'University of Toronto', program: 'MEng in ECE', status: AppStatus.PREPARING, date: '2023-12-15', portalUrl: '#' },
];

const ApplicationTracker: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">申请状态跟踪</h2>
          <p className="text-gray-500">实时监控所有院校申请进展与关键节点。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: '正在准备', count: 12, icon: Clock, color: 'text-yellow-600' },
          { label: '已提交', count: 45, icon: CheckCircle2, color: 'text-blue-600' },
          { label: '补件通知', count: 3, icon: AlertCircle, color: 'text-red-600' },
          { label: '本月录取', count: 8, icon: CheckCircle2, color: 'text-emerald-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center space-x-4">
            <div className={`p-2 rounded-lg bg-gray-50 ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              <p className="text-lg font-bold text-gray-900">{stat.count}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {TRACKING_DATA.map((app, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 hover:border-blue-200 transition-all group">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{app.school}</h4>
                  <p className="text-sm text-gray-500">{app.student} • {app.program}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">状态</p>
                  <p className="text-sm font-bold text-blue-600">{app.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">截止/节点日期</p>
                  <p className="text-sm font-bold text-gray-700">{app.date}</p>
                </div>
                <a 
                  href={app.portalUrl} 
                  className="flex items-center space-x-1 text-xs text-blue-500 hover:text-blue-700 font-bold bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ExternalLink size={14} />
                  <span>官网 Portal</span>
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApplicationTracker;
