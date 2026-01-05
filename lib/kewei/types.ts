
export enum AppStatus {
    PLANNING = '规划中',
    PREPARING = '材料准备',
    SUBMITTED = '已递交',
    OFFER_RECEIVED = '获得录取',
    VISA_PROCESSING = '签证办理',
    ENROLLED = '已入学',
    CLOSED = '已结案'
}

// Fix: Added Student interface to match usage in components/StudentList.tsx
export interface Student {
    id: string;
    name: string;
    targetCountry: string;
    targetDegree: string;
    currentSchool: string;
    gpa: string;
    consultant: string;
    status: AppStatus;
    lastContact: string;
}

export interface Customer {
    id: string;
    name: string;
    source: 'WeChat' | 'Manual' | 'Red' | 'Video';
    grade: string;
    age: number;
    schoolType: string;
    lastMessageTime: string;
    status: 'Pending' | 'Following' | 'Contracting' | 'Lost';
    assignedStaff: string[];
    history: ChatRecord[];
    tags: string[];
}

export interface ChatRecord {
    sender: 'system' | 'staff' | 'customer';
    text: string;
    timestamp: string;
    intent?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface KnowledgeItem {
    category: string;
    title: string;
    url: string;
    type: 'doc' | 'sheet' | 'video' | 'post';
}

export interface Contract {
    id: string;
    customerName: string;
    type: string;
    amount: number;
    status: 'Draft' | 'Approving' | 'Signing' | 'Completed';
    createdAt: string;
}
