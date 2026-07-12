import { useEffect, useState } from 'react';
import { Users, Phone, Mail, UserPlus, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input, Spinner, EmptyState } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { getAdminUsers, createTenantUser } from '../lib/api';
import { Pagination } from '../components/common/Pagination';
import { PageSizeSelector } from '../components/common/PageSizeSelector';
import { SearchInput } from '../components/common/SearchInput';

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ totalPages: 1, hasNextPage: false, hasPreviousPage: false });

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    phone: ''
  });

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, searchQuery]);

  // Reset trang khi thay đổi search
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  async function loadData() {
    try {
      setLoading(true);
      const usersData = await getAdminUsers({ page, limit, search: searchQuery });
      setUsers(usersData.data || []);
      setPagination(usersData.pagination);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreateModal() {
    setFormData({ username: '', password: '', full_name: '', phone: '' });
    setIsModalOpen(true);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.username || !formData.password) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (formData.password.length < 6) {
      alert('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    
    setSaving(true);
    try {
      await createTenantUser(formData.username, formData.password, formData.full_name, formData.phone);
      await loadData();
      setIsModalOpen(false);
      alert('Tạo tài khoản thành công!');
    } catch (error: any) {
      alert(error.message || 'Lỗi khi tạo tài khoản');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-10">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-charcoal-900 tracking-tight">Tài khoản</h1>
          <p className="text-charcoal-400 mt-2 text-base">Cấp tài khoản đăng nhập cho Khách thuê. Khách sẽ tự cập nhật thông tin cá nhân khi đăng nhập.</p>
        </div>
        <Button onClick={() => handleOpenCreateModal()}>
          <UserPlus className="w-4 h-4 mr-2" />
          Tạo tài khoản
        </Button>
      </header>

      {/* Danh sách Tài khoản đã cấp */}
      {users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-12">
          <EmptyState
            icon={<Users className="w-10 h-10" />}
            title="Chưa có tài khoản nào"
            description="Hệ thống chưa có tài khoản người dùng nào ngoài Admin."
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
           <div className="px-6 py-4 border-b border-charcoal-100 bg-charcoal-50/50 flex justify-between items-center">
            <h2 className="font-semibold text-charcoal-900">Tài khoản hiện có</h2>
            <div className="flex gap-4 items-center">
              <div className="w-64">
                <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Tìm tài khoản..." />
              </div>
              <PageSizeSelector limit={limit} onLimitChange={setLimit} />
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-charcoal-100 bg-charcoal-50/50">
                <th className="text-left px-6 py-4 text-xs text-charcoal-500 uppercase tracking-wider font-semibold">Tài khoản</th>
                <th className="text-left px-6 py-4 text-xs text-charcoal-500 uppercase tracking-wider font-semibold">Thông tin (Khách tự nhập)</th>
                <th className="text-left px-6 py-4 text-xs text-charcoal-500 uppercase tracking-wider font-semibold">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-cream-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-charcoal-900">@{u.username}</p>
                    <p className="text-xs text-charcoal-400 mt-1">{u.role}</p>
                  </td>
                  <td className="px-6 py-4">
                     <p className="text-sm text-charcoal-900 font-medium">{u.full_name}</p>
                     <div className="text-xs text-charcoal-500 mt-1 space-y-0.5">
                       {u.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3"/> {u.phone}</div>}
                       {u.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3"/> {u.email}</div>}
                     </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-charcoal-600">
                    {new Date(u.created_at).toLocaleDateString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination component */}
          {!loading && users.length > 0 && (
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              hasNextPage={pagination.hasNextPage}
              hasPreviousPage={pagination.hasPreviousPage}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* Modal Tạo tài khoản */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Cấp tài khoản mới">
        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
          <Input 
            label="Tên đăng nhập" 
            name="username" 
            value={formData.username} 
            onChange={(v) => setFormData({ ...formData, username: v })} 
            required 
            placeholder="VD: caoltuananh"
          />

          <Input 
            label="Họ và tên" 
            name="full_name" 
            value={formData.full_name} 
            onChange={(v) => setFormData({ ...formData, full_name: v })} 
            required 
            placeholder="VD: Cao Anh"
          />

          <Input 
            label="Số điện thoại" 
            name="phone" 
            value={formData.phone} 
            onChange={(v) => setFormData({ ...formData, phone: v })} 
            required 
            placeholder="VD: 0987654321"
          />
          
          <div className="relative">
             <Input 
              label="Mật khẩu" 
              name="password" 
              type={(showPassword ? 'text' : 'password') as any}
              value={formData.password} 
              onChange={(v) => setFormData({ ...formData, password: v })} 
              required 
              placeholder="Ít nhất 6 ký tự"
            />
            <button
              type="button"
              className="absolute right-3 top-[34px] text-charcoal-400 hover:text-terra-600 focus:outline-none"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          
          <p className="text-xs text-charcoal-500 italic mt-2">
            Hệ thống sẽ tự động tạo một hồ sơ Khách Thuê mới khi tài khoản này được tạo. Khi khách đăng nhập, họ có thể tự điền họ tên, số điện thoại, CCCD.
          </p>

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving || !formData.username}>
              {saving ? 'Đang tạo...' : 'Tạo tài khoản'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
