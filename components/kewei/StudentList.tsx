"use client";


import React, { useState } from 'react';
import { AppStatus, Student } from '@/lib/kewei/types';
import { MoreHorizontal, Filter, Download, Plus, Mail, Phone } from 'lucide-react';

const MOCK_STUDENTS: Student[] = [
  { id: '1', name: '张小凡', targetCountry: '美国', targetDegree: '研究生', currentSchool: '北京大学', gpa: '3.8/4.0', consultant: '林老师', status: AppStatus.SUBMITTED, lastContact: '2023-10-25' },
  { id: '2', name: '李若冰', targetCountry: '英国', targetDegree: '本科', currentSchool: '上海中学', gpa: 'A*A*A', consultant: '赵老师', status: AppStatus.OFFER_RECEIVED, lastContact: '2023-10-27' },
  { id: '3', name: '王也', targetCountry: '加拿大', targetDegree: '研究生', currentSchool: '浙江大学', gpa: '3.6/4.0', consultant: '林老师', status: AppStatus.PLANNING, lastContact: '2023-10-20' },
  { id: '4', name: '陈果', targetCountry: '澳洲', targetDegree: '研究生', currentSchool: '悉尼大学', gpa: 'Distinction', consultant: '陈老师', status: AppStatus.PREPARING, lastContact: '2023-10-28' },
  { id: '5', name: '陆雪琪', targetCountry: '新加坡', targetDegree: '本科', currentSchool: '国际学校', gpa: 'IB 42', consultant: '赵老师', status: AppStatus.VISA_PROCESSING, lastContact: '2023-10-24' },
];

const StatusBadge = ({ status }: { status: AppStatus }) => {
  const styles: Record<string, string> = {
    [AppStatus.PLANNING]: 'bg-gray-100 text-gray-600',
    [AppStatus.PREPARING]: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    [AppStatus.SUBMITTED]: 'bg-blue-50 text-blue-600 border-blue-100',
    [AppStatus.OFFER_RECEIVED]: 'bg-green-50 text-green-600 border-green-100',
    [AppStatus.VISA_PROCESSING]: 'bg-purple-50 text-purple-600 border-purple-100',
    [AppStatus.ENROLLED]: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    [AppStatus.CLOSED]: 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
};

const StudentList: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">学员管理</h2>
          <p className="text-gray-500">管理所有正在服务的学员及申请意向。</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors">
            <Filter size={18} />
            <span>筛选</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors">
            <Download size={18} />
            <span>导出</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
            <Plus size={18} />
            <span>新增学员</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">学员姓名</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">意向国家/学历</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">背景信息</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">负责顾问</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">当前状态</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">最后联系</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {MOCK_STUDENTS.map((student) => (
              <tr key={student.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{student.name}</p>
                      <div className="flex space-x-2 mt-1">
                        <Mail size={12} className="text-gray-400 cursor-pointer hover:text-blue-500" />
                        <Phone size={12} className="text-gray-400 cursor-pointer hover:text-blue-500" />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-900 font-medium">{student.targetCountry}</p>
                  <p className="text-xs text-gray-500">{student.targetDegree}</p>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  <p>{student.currentSchool}</p>
                  <p className="text-xs text-gray-400">GPA: {student.gpa}</p>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {student.consultant}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={student.status} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {student.lastContact}
                </td>
                <td className="px-6 py-4">
                  <button className="p-1 text-gray-400 hover:text-gray-600">
                    <MoreHorizontal size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentList;
