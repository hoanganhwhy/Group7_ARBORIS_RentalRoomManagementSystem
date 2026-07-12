import React from 'react';
import { Inbox } from 'lucide-react';

interface ListEmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

export const ListEmptyState: React.FC<ListEmptyStateProps> = ({
  title = 'Không có dữ liệu',
  message = 'Chưa có bản ghi nào hoặc không tìm thấy kết quả phù hợp.',
  icon = <Inbox className="mx-auto h-12 w-12 text-gray-400" />
}) => {
  return (
    <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm mt-4">
      {icon}
      <h3 className="mt-2 text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
  );
};
