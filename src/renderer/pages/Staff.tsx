import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Shield,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  LogIn,
  LogOut,
  Calendar,
  Search,
  Check,
} from 'lucide-react';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import DataTable from '../components/common/DataTable';
import { formatDate, formatTime } from '../lib/formatters';
import { useStaff } from '../hooks/useStaff';
import type { Staff as StaffType, Role, Attendance, CreateStaffDTO } from '../../shared/types/staff.types';

type StaffTab = 'list' | 'attendance' | 'roles';

const ALL_PERMISSIONS: Record<string, { groupKey: string; permissions: { key: string; labelKey: string }[] }> = {
  billing: {
    groupKey: 'permissions.billing',
    permissions: [
      { key: 'create_order', labelKey: 'permissions.createOrder' },
      { key: 'apply_discount', labelKey: 'permissions.applyDiscount' },
      { key: 'cancel_order', labelKey: 'permissions.cancelOrder' },
      { key: 'void_bill', labelKey: 'permissions.voidBill' },
    ],
  },
  menu: {
    groupKey: 'permissions.menu',
    permissions: [
      { key: 'view_menu', labelKey: 'permissions.viewMenu' },
      { key: 'edit_menu', labelKey: 'permissions.editMenu' },
      { key: 'manage_categories', labelKey: 'permissions.manageCategories' },
    ],
  },
  inventory: {
    groupKey: 'permissions.inventory',
    permissions: [
      { key: 'view_inventory', labelKey: 'permissions.viewInventory' },
      { key: 'edit_inventory', labelKey: 'permissions.editInventory' },
      { key: 'manage_suppliers', labelKey: 'permissions.manageSuppliers' },
      { key: 'create_po', labelKey: 'permissions.createPurchaseOrders' },
    ],
  },
  staff_mgmt: {
    groupKey: 'permissions.staff',
    permissions: [
      { key: 'view_staff', labelKey: 'permissions.viewStaff' },
      { key: 'manage_staff', labelKey: 'permissions.manageStaff' },
      { key: 'manage_roles', labelKey: 'permissions.manageRoles' },
    ],
  },
  reports: {
    groupKey: 'permissions.reports',
    permissions: [
      { key: 'view_reports', labelKey: 'permissions.viewReports' },
      { key: 'export_reports', labelKey: 'permissions.exportReports' },
    ],
  },
  settings: {
    groupKey: 'permissions.settings',
    permissions: [
      { key: 'manage_settings', labelKey: 'permissions.manageSettings' },
    ],
  },
  customers: {
    groupKey: 'permissions.customers',
    permissions: [
      { key: 'view_customers', labelKey: 'permissions.viewCustomers' },
      { key: 'manage_customers', labelKey: 'permissions.manageCustomers' },
      { key: 'manage_loyalty', labelKey: 'permissions.manageLoyalty' },
    ],
  },
};

interface StaffFormData {
  name: string;
  phone: string;
  email: string;
  pin: string;
  roleId: number;
  hourlyRate: string;
}

const emptyForm: StaffFormData = { name: '', phone: '', email: '', pin: '', roleId: 0, hourlyRate: '0' };

const StaffPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    staff,
    roles,
    attendance,
    loading,
    error,
    createStaff,
    updateStaff,
    deleteStaff,
    toggleActive,
    clockIn,
    clockOut,
    fetchAttendance,
    updateRole,
  } = useStaff();

  const [activeTab, setActiveTab] = useState<StaffTab>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffType | null>(null);
  const [formData, setFormData] = useState<StaffFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchAttendance(undefined, attendanceDate);
    }
  }, [activeTab, attendanceDate, fetchAttendance]);

  const handleOpenAdd = () => {
    setFormData({ ...emptyForm, roleId: roles[0]?.id ?? 0 });
    setShowAddModal(true);
  };

  const handleOpenEdit = (s: StaffType) => {
    setFormData({
      name: s.name,
      phone: s.phone ?? '',
      email: s.email ?? '',
      pin: '',
      roleId: s.roleId,
      hourlyRate: (s.hourlyRate / 100).toString(),
    });
    setEditingStaff(s);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      if (editingStaff) {
        const updateData: any = {
          name: formData.name,
          phone: formData.phone || undefined,
          email: formData.email || undefined,
          roleId: formData.roleId,
          hourlyRate: Math.round(parseFloat(formData.hourlyRate || '0') * 100),
        };
        if (formData.pin) {
          updateData.pin = formData.pin;
        }
        await updateStaff(editingStaff.id, updateData);
        setEditingStaff(null);
      } else {
        const createData: CreateStaffDTO = {
          name: formData.name,
          phone: formData.phone || undefined,
          email: formData.email || undefined,
          pin: formData.pin,
          roleId: formData.roleId,
          hourlyRate: Math.round(parseFloat(formData.hourlyRate || '0') * 100),
        };
        await createStaff(createData);
        setShowAddModal(false);
      }
    } catch {
      // Error set in hook
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteStaff(id);
      setDeleteConfirm(null);
    } catch {
      // Error set in hook
    }
  };

  const handleClockIn = async (staffId: number) => {
    try {
      await clockIn(staffId);
      fetchAttendance(undefined, attendanceDate);
    } catch {
      // Error set in hook
    }
  };

  const handleClockOut = async (staffId: number) => {
    try {
      await clockOut(staffId);
      fetchAttendance(undefined, attendanceDate);
    } catch {
      // Error set in hook
    }
  };

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setEditPermissions([...role.permissions]);
  };

  const handleTogglePermission = (perm: string) => {
    setEditPermissions((prev) =>
      prev.includes(perm)
        ? prev.filter((p) => p !== perm)
        : [...prev, perm]
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await updateRole(selectedRole.id, { permissions: editPermissions });
      setSelectedRole(null);
    } catch {
      // Error set in hook
    } finally {
      setSaving(false);
    }
  };

  const getHoursWorked = (att: Attendance): string => {
    if (!att.clockOut) return t('staff.active');
    const diffMs = new Date(att.clockOut).getTime() - new Date(att.clockIn).getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const getRoleName = (roleId: number): string => {
    return roles.find((r) => r.id === roleId)?.name ?? t('common.unknown');
  };

  const totalPresentToday = attendance.length;
  const totalHoursToday = attendance.reduce((sum, a) => {
    if (!a.clockOut) return sum;
    return sum + (new Date(a.clockOut).getTime() - new Date(a.clockIn).getTime()) / (1000 * 60 * 60);
  }, 0);

  const getStaffName = useCallback(
    (staffId: number) => staff.find((s) => s.id === staffId)?.name ?? t('common.unknown'),
    [staff, t]
  );

  const staffFormContent = (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('staff.name')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
          placeholder={t('staff.namePlaceholder')}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('staff.phone')}</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
            placeholder={t('staff.phonePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('staff.email')}</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
            placeholder={t('staff.emailPlaceholder')}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {editingStaff ? t('staff.newPin') : t('staff.pin')} {!editingStaff && <span className="text-red-500">*</span>}
          </label>
          <input
            type="password"
            value={formData.pin}
            onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
            placeholder={t('staff.pinPlaceholder')}
            maxLength={6}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('staff.hourlyRate')}</label>
          <input
            type="number"
            value={formData.hourlyRate}
            onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
            placeholder="0"
            min="0"
            step="0.01"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('staff.role')}</label>
        <select
          value={formData.roleId}
          onChange={(e) => setFormData({ ...formData, roleId: parseInt(e.target.value, 10) })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none bg-white"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderStaffList = () => (
    <div className="space-y-4">
      <DataTable
        columns={[
          { header: t('staff.name'), accessor: 'name' },
          {
            header: t('staff.role'),
            accessor: 'roleId',
            render: (item) => (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                {getRoleName(item.roleId)}
              </span>
            ),
          },
          { header: t('staff.phone'), accessor: 'phone', render: (item) => item.phone || '-' },
          {
            header: t('staff.status'),
            accessor: 'isActive',
            render: (item) => (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleActive(item.id, !item.isActive);
                }}
                className="flex items-center gap-1.5"
              >
                {item.isActive ? (
                  <>
                    <ToggleRight size={20} className="text-green-600" />
                    <span className="text-xs text-green-600 font-medium">{t('staff.active')}</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft size={20} className="text-gray-400" />
                    <span className="text-xs text-gray-400 font-medium">{t('staff.inactive')}</span>
                  </>
                )}
              </button>
            ),
          },
          {
            header: t('staff.actions'),
            accessor: 'actions',
            sortable: false,
            align: 'right',
            render: (item) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(item);
                  }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(item.id);
                  }}
                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-gray-500 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ),
          },
        ]}
        data={staff}
        keyExtractor={(item) => item.id}
        emptyMessage={t('staff.noStaffMembers')}
      />
    </div>
  );

  const renderAttendance = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-gray-400" />
          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{t('staff.present')}: <strong>{totalPresentToday}</strong></span>
          <span>{t('staff.totalHours')}: <strong>{totalHoursToday.toFixed(1)}h</strong></span>
        </div>
      </div>

      <DataTable
        columns={[
          {
            header: t('nav.staff'),
            accessor: 'staffId',
            render: (item) => getStaffName(item.staffId),
          },
          {
            header: t('staff.clockIn'),
            accessor: 'clockIn',
            render: (item) => formatTime(item.clockIn),
          },
          {
            header: t('staff.clockOut'),
            accessor: 'clockOut',
            render: (item) => item.clockOut ? formatTime(item.clockOut) : (
              <span className="text-green-600 text-xs font-medium">{t('staff.active')}</span>
            ),
          },
          {
            header: t('staff.hours'),
            accessor: 'hours',
            align: 'right',
            render: (item) => getHoursWorked(item),
          },
        ]}
        data={attendance}
        keyExtractor={(item) => item.id}
        emptyMessage={t('staff.noAttendanceRecords')}
      />

      {/* Manual clock in/out */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('staff.manualClockInOut')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {staff
            .filter((s) => s.isActive)
            .map((s) => {
              const activeRecord = attendance.find(
                (a) => a.staffId === s.id && !a.clockOut
              );
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">{getRoleName(s.roleId)}</p>
                  </div>
                  {activeRecord ? (
                    <button
                      onClick={() => handleClockOut(s.id)}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      title={t('staff.clockOut')}
                    >
                      <LogOut size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleClockIn(s.id)}
                      className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                      title={t('staff.clockIn')}
                    >
                      <LogIn size={16} />
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );

  const renderRoles = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Role list */}
      <div className="lg:col-span-1 space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('staff.roles')}</h3>
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => handleSelectRole(role)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              selectedRole?.id === role.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <p className="font-medium text-sm text-gray-900">{role.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('staff.permissionCount', { count: role.permissions.length })}
            </p>
          </button>
        ))}
      </div>

      {/* Permissions editor */}
      <div className="lg:col-span-2">
        {selectedRole ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">
                {t('staff.permissionsFor', { roleName: selectedRole.name })}
              </h3>
              <Button onClick={handleSavePermissions} loading={saving} size="sm">
                {t('staff.savePermissions')}
              </Button>
            </div>

            <div className="space-y-6">
              {Object.entries(ALL_PERMISSIONS).map(([key, group]) => (
                <div key={key}>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {t(group.groupKey)}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.permissions.map((perm) => (
                      <label
                        key={perm.key}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            editPermissions.includes(perm.key)
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300'
                          }`}
                          onClick={() => handleTogglePermission(perm.key)}
                        >
                          {editPermissions.includes(perm.key) && (
                            <Check size={14} className="text-white" />
                          )}
                        </div>
                        <span className="text-sm text-gray-700">{t(perm.labelKey)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Shield size={40} className="mb-3" />
            <p className="text-sm">{t('staff.selectRoleToEdit')}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">{t('staff.title')}</h1>
          {activeTab === 'list' && (
            <Button icon={<Plus size={16} />} onClick={handleOpenAdd}>
              {t('staff.addStaff')}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {[
            { key: 'list' as StaffTab, label: t('staff.staffList'), icon: <Users size={16} /> },
            { key: 'attendance' as StaffTab, label: t('staff.attendance'), icon: <Clock size={16} /> },
            { key: 'roles' as StaffTab, label: t('staff.rolesPermissions'), icon: <Shield size={16} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-500">
            <AlertCircle size={32} className="mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        ) : activeTab === 'list' ? (
          renderStaffList()
        ) : activeTab === 'attendance' ? (
          renderAttendance()
        ) : (
          renderRoles()
        )}
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('staff.addStaff')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('staff.addStaff')}</Button>
          </>
        }
      >
        {staffFormContent}
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        isOpen={!!editingStaff}
        onClose={() => setEditingStaff(null)}
        title={t('staff.editStaff')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingStaff(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('staff.update')}</Button>
          </>
        }
      >
        {staffFormContent}
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title={t('staff.deleteStaff')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm)}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {t('staff.deleteMessage')}
        </p>
      </Modal>
    </div>
  );
};

export default StaffPage;
