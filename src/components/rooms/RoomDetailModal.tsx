import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Input';
import { Crown, User, Calendar, Banknote, CalendarDays, RefreshCw, Info, Edit2, UserPlus } from 'lucide-react';
import type { Room, RoomAssignment } from '../../types';

interface RoomDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  onEdit: (room: Room) => void;
  onAssign: (room: Room) => void;
  onExtend: (assignment: RoomAssignment) => void;
}

export function RoomDetailModal({ isOpen, onClose, room, onEdit, onAssign, onExtend }: RoomDetailModalProps) {
  if (!room) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Chi tiết phòng ${room.room_number}`} size="lg">
      <div className="p-6 space-y-6">
        {/* Room Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
            <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-1">Trạng thái</p>
            <Badge status={room.status} variant={
              room.status === 'available' ? 'success' : room.status === 'occupied' ? 'info' : 'default'
            } />
          </div>
          <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
            <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-1">Tầng</p>
            <p className="font-semibold text-charcoal-900">Tầng {room.floor}</p>
          </div>
          <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
            <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-1">Diện tích</p>
            <p className="font-semibold text-charcoal-900">{room.area_sqm} m²</p>
          </div>
          <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
            <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-1">Giá thuê/tháng</p>
            <p className="font-semibold text-terra-600">{room.monthly_rent.toLocaleString('vi-VN')}đ</p>
          </div>
        </div>

        {/* Capacity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-charcoal-700">Người đang ở</p>
            <p className="text-sm text-charcoal-500">
              {room.active_assignments?.length || 0}/{room.max_occupants} người
            </p>
          </div>
          <div className="h-2 bg-charcoal-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-terra-400 rounded-full transition-all"
              style={{ width: `${Math.min(100, ((room.active_assignments?.length || 0) / (room.max_occupants || 1)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Occupants */}
        {(room.active_assignments?.length ?? 0) > 0 ? (
          <div>
            <p className="text-sm font-medium text-charcoal-700 mb-3">Danh sách người ở</p>
            <div className="space-y-3">
              {room.active_assignments!.map((assignment) => (
                <div key={assignment.id} className="bg-white border border-charcoal-100 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        assignment.is_primary ? 'bg-amber-100' : 'bg-charcoal-50'
                      }`}>
                        {assignment.is_primary
                          ? <Crown className="w-5 h-5 text-amber-600" />
                          : <User className="w-5 h-5 text-charcoal-400" />
                        }
                      </div>
                      <div>
                        <p className="font-semibold text-charcoal-900">{assignment.tenant?.full_name}</p>
                        <p className={`text-xs font-medium ${assignment.is_primary ? 'text-amber-600' : 'text-charcoal-400'}`}>
                          {assignment.is_primary ? 'Chủ hợp đồng' : 'Người ở cùng'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-charcoal-100">
                    <div className="flex items-center gap-2 text-sm text-charcoal-500">
                      <Calendar className="w-4 h-4 shrink-0" />
                      <span>Vào ở: <span className="font-medium text-charcoal-700">{new Date(assignment.start_date).toLocaleDateString('vi-VN')}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-charcoal-500">
                      <Banknote className="w-4 h-4 shrink-0" />
                      <span>Cọc: <span className="font-medium text-charcoal-700">{Number(assignment.deposit_amount).toLocaleString('vi-VN')}đ</span></span>
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 text-charcoal-500">
                        <CalendarDays className="w-4 h-4 shrink-0 text-terra-500" />
                        {assignment.contract_end_date ? (
                          <span>Hết hạn HĐ: <span className="font-medium text-charcoal-700">{new Date(assignment.contract_end_date).toLocaleDateString('vi-VN')}</span></span>
                        ) : (
                          <span className="text-charcoal-400 italic">Chưa đặt ngày kết thúc HĐ</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {assignment.contract_end_date && (() => {
                          const daysLeft = Math.ceil((new Date(assignment.contract_end_date).getTime() - new Date().getTime()) / 86400000);
                          if (daysLeft <= 0) return <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg">Đã hết hạn</span>;
                          if (daysLeft <= 30) return <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">Còn {daysLeft} ngày</span>;
                          return null;
                        })()}
                        <button
                          onClick={() => onExtend(assignment)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-terra-600 bg-terra-50 hover:bg-terra-100 rounded-lg transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {assignment.contract_end_date ? 'Gia hạn' : 'Đặt ngày'}
                        </button>
                      </div>
                    </div>
                    {assignment.notes && (
                      <div className="col-span-2 flex items-start gap-2 text-sm text-charcoal-500">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{assignment.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center bg-cream-50 rounded-xl border border-charcoal-100">
            <p className="text-charcoal-400">Phòng hiện chưa có người ở</p>
          </div>
        )}

        {room.description && (
          <div className="p-4 bg-cream-50 rounded-xl border border-charcoal-100">
            <p className="text-xs text-charcoal-400 uppercase tracking-wide font-medium mb-2">Ghi chú</p>
            <p className="text-charcoal-700 text-sm">{room.description}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-charcoal-100">
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
          <Button onClick={() => { onClose(); onEdit(room); }}>
            <Edit2 className="w-4 h-4" />Sửa thông tin
          </Button>
          {room.status !== 'maintenance' && (room.active_assignments?.length ?? 0) < (room.max_occupants ?? 2) && (
            <Button variant="secondary" onClick={() => { onClose(); onAssign(room); }}>
              <UserPlus className="w-4 h-4" />Thêm người
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
