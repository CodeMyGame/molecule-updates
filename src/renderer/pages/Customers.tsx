import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Plus,
  Users,
  Phone,
  MapPin,
  Star,
  ShoppingBag,
  Edit2,
  Gift,
  Loader2,
  AlertCircle,
  X,
  Award,
  ArrowLeft,
  RotateCcw,
  Clock,
} from 'lucide-react';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import DataTable from '../components/common/DataTable';
import { formatCurrency, formatDate, formatDateTime } from '../lib/formatters';
import { useCustomers } from '../hooks/useCustomers';
import { useLocaleCurrencyIcon } from '../hooks/useLocaleCurrencyIcon';
import { useBillingStore } from '../stores/billing.store';
import { useSettings } from '../hooks/useSettings';
import { ipc } from '../lib/ipc';
import {
  resolveOrderItemTaxRateFallback,
  resolveTaxRateForCartLine,
} from '../lib/taxLocalePresets';
import type { Customer, LoyaltyTransaction } from '../../shared/types/customer.types';

interface CustomerFormData {
  phone: string;
  address: string;
}

const emptyForm: CustomerFormData = { phone: '', address: '' };

interface PastOrder {
  id: number;
  orderNumber: string;
  orderType: string;
  grandTotal: number;
  createdAt: string;
  itemNames: string;
}

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { settings, fetchSettings } = useSettings();

  useEffect(() => {
    void fetchSettings(['default_tax_rate']);
  }, [fetchSettings]);
  const CurrencyIcon = useLocaleCurrencyIcon();
  const addToCart = useBillingStore((s) => s.addToCart);
  const clearCart = useBillingStore((s) => s.clearCart);
  const {
    customers,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    createCustomer,
    updateCustomer,
    getLoyaltyTransactions,
    addLoyaltyPoints,
    refetch,
  } = useCustomers();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState('');
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [pastOrders, setPastOrders] = useState<PastOrder[]>([]);

  // Loyalty overview
  const totalPointsIssued = customers.reduce((sum, c) => sum + Math.max(0, c.loyaltyPoints), 0);
  const totalSpentAll = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  useEffect(() => {
    if (selectedCustomer) {
      setLoyaltyLoading(true);
      getLoyaltyTransactions(selectedCustomer.id)
        .then(setLoyaltyTransactions)
        .finally(() => setLoyaltyLoading(false));
      // Fetch past orders
      ipc<PastOrder[]>(window.electronAPI.orders.getByCustomer(selectedCustomer.id, 5))
        .then((orders) => setPastOrders(orders ?? []))
        .catch(() => setPastOrders([]));
    }
  }, [selectedCustomer, getLoyaltyTransactions]);

  const handleOpenAdd = () => {
    setFormData(emptyForm);
    setShowAddModal(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setFormData({
      phone: customer.phone ?? '',
      address: customer.address ?? '',
    });
    setEditingCustomer(customer);
  };

  const handleSaveCustomer = async () => {
    if (!formData.phone.trim()) return;
    setSaving(true);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, { ...formData, name: formData.phone });
        setEditingCustomer(null);
        if (selectedCustomer?.id === editingCustomer.id) {
          setSelectedCustomer({ ...selectedCustomer, phone: formData.phone, address: formData.address });
        }
      } else {
        await createCustomer({ ...formData, name: formData.phone });
        setShowAddModal(false);
      }
    } catch {
      // Error is set in hook
    } finally {
      setSaving(false);
    }
  };

  const handleAddLoyalty = async (customerId: number) => {
    const pts = parseInt(loyaltyPoints, 10);
    if (isNaN(pts) || pts === 0) return;
    try {
      await addLoyaltyPoints(customerId, pts);
      setLoyaltyPoints('');
      // Refresh loyalty transactions
      const txns = await getLoyaltyTransactions(customerId);
      setLoyaltyTransactions(txns);
      await refetch();
      // Update selected customer points
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer((prev) =>
          prev ? { ...prev, loyaltyPoints: prev.loyaltyPoints + pts } : prev
        );
      }
    } catch {
      // Error is set in hook
    }
  };

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  const customerFormModal = (
    isOpen: boolean,
    onClose: () => void,
    title: string
  ) => (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSaveCustomer} loading={saving}>
            {editingCustomer ? t('customers.update') : t('customers.addCustomer')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {t('customers.phone')} <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') })}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
            placeholder={t('customers.phonePlaceholder')}
            maxLength={10}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('customers.address')}</label>
          <textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none resize-none"
            rows={2}
            placeholder={t('customers.addressPlaceholder')}
          />
        </div>
      </div>
    </Modal>
  );

  // Customer detail panel
  if (selectedCustomer) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedCustomer(null)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ArrowLeft size={16} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-xs font-bold text-gray-900">{selectedCustomer.phone || selectedCustomer.name}</h1>
              <p className="text-[10px] text-gray-500">{t('customers.customerDetails')}</p>
            </div>
            <div className="ml-auto">
              <button
                onClick={() => handleOpenEdit(selectedCustomer)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Edit2 size={11} className="text-gray-500" />
                <span>{t('common.edit')}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="max-w-4xl mx-auto space-y-3">
            {/* Profile info */}
            <div className="bg-white rounded-md border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-700 mb-2">{t('customers.profileInformation')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-400" />
                  <span className="text-xs text-gray-700">{selectedCustomer.phone || t('customers.noPhone')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-gray-400" />
                  <span className="text-xs text-gray-700">{selectedCustomer.address || t('customers.noAddress')}</span>
                </div>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div className="bg-white rounded-md border border-gray-200 p-2.5 text-center">
                <Star size={16} className="mx-auto text-yellow-500 mb-0.5" />
                <p className="text-base font-bold text-gray-900">{selectedCustomer.loyaltyPoints}</p>
                <p className="text-[10px] text-gray-500">{t('customers.loyaltyPoints')}</p>
              </div>
              <div className="bg-white rounded-md border border-gray-200 p-2.5 text-center">
                <CurrencyIcon size={16} className="mx-auto text-green-600 mb-0.5" />
                <p className="text-base font-bold text-gray-900">{formatCurrency(selectedCustomer.totalSpent)}</p>
                <p className="text-[10px] text-gray-500">{t('customers.totalSpent')}</p>
              </div>
              <div className="bg-white rounded-md border border-gray-200 p-2.5 text-center">
                <ShoppingBag size={16} className="mx-auto text-blue-600 mb-0.5" />
                <p className="text-base font-bold text-gray-900">{selectedCustomer.totalVisits}</p>
                <p className="text-[10px] text-gray-500">{t('customers.totalVisits')}</p>
              </div>
              <div className="bg-white rounded-md border border-gray-200 p-2.5 text-center">
                <CurrencyIcon size={16} className="mx-auto text-purple-600 mb-0.5" />
                <p className="text-base font-bold text-gray-900">
                  {selectedCustomer.totalVisits > 0
                    ? formatCurrency(selectedCustomer.totalSpent / selectedCustomer.totalVisits)
                    : formatCurrency(0)}
                </p>
                <p className="text-[10px] text-gray-500">{t('customers.avgPerVisit')}</p>
              </div>
            </div>

            {/* Loyalty management */}
            <div className="bg-white rounded-md border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-700 mb-2">{t('customers.manageLoyaltyPoints')}</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={loyaltyPoints}
                  onChange={(e) => setLoyaltyPoints(e.target.value)}
                  className="w-32 px-2.5 py-1 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                  placeholder={t('customers.pointsPlaceholder')}
                />
                <Button
                  variant="success"
                  size="sm"
                  icon={<Plus size={13} />}
                  onClick={() => handleAddLoyalty(selectedCustomer.id)}
                  disabled={!loyaltyPoints || loyaltyPoints === '0'}
                >
                  {t('customers.addPoints')}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Gift size={13} />}
                  onClick={() => {
                    const pts = parseInt(loyaltyPoints, 10);
                    if (!isNaN(pts) && pts > 0) {
                      handleAddLoyalty(selectedCustomer.id);
                    }
                  }}
                  disabled={!loyaltyPoints || parseInt(loyaltyPoints, 10) >= 0}
                >
                  {t('customers.redeem')}
                </Button>
              </div>
            </div>

            {/* Past Orders / Quick Reorder */}
            {pastOrders.length > 0 && (
              <div className="bg-white rounded-md border border-gray-200 p-3">
                <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <Clock size={12} />
                  {t('customers.recentOrders')}
                </h3>
                <div className="space-y-2">
                  {pastOrders.map((order) => {
                    const ts = order.createdAt.endsWith('Z') ? order.createdAt : order.createdAt + 'Z';
                    return (
                      <div key={order.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-gray-900">#{order.orderNumber}</span>
                            <span className="text-[10px] text-gray-400 capitalize">{order.orderType.replace('_', ' ')}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">{order.itemNames}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(ts)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-bold text-gray-900">{formatCurrency(order.grandTotal)}</span>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<RotateCcw size={12} />}
                            onClick={async () => {
                              try {
                                const fullOrder = await ipc<any>(window.electronAPI.orders.getById(order.id));
                                if (fullOrder && fullOrder.items) {
                                  clearCart();
                                  for (const oi of fullOrder.items) {
                                    const raw = oi.taxRate ?? oi.tax_rate;
                                    const n =
                                      typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').trim());
                                    const baseRate =
                                      Number.isFinite(n) && n >= 0
                                        ? n
                                        : resolveOrderItemTaxRateFallback(
                                            null,
                                            settings.default_tax_rate,
                                            i18n.language
                                          );
                                    const taxRate = resolveTaxRateForCartLine(
                                      baseRate,
                                      settings.default_tax_rate,
                                      i18n.language
                                    );
                                    addToCart(
                                      {
                                        id: oi.menuItemId ?? oi.menu_item_id,
                                        name: (oi.name ?? '').split(' (')[0],
                                        basePrice: oi.unitPrice ?? oi.unit_price,
                                        categoryId: 0,
                                        taxRate,
                                        isVeg: false,
                                      },
                                      oi.variationId ? { id: oi.variationId, name: '', priceDelta: 0 } : undefined,
                                      (oi.addons ?? []).map((a: any) => ({ id: a.addonId ?? a.id, name: a.name, price: a.price }))
                                    );
                                  }
                                  navigate('/billing');
                                }
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            {t('customers.reorder')}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Loyalty transaction history */}
            <div className="bg-white rounded-md border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-700 mb-2">{t('customers.loyaltyHistory')}</h3>
              {loyaltyLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={20} className="animate-spin text-blue-600" />
                </div>
              ) : (
                <DataTable
                  columns={[
                    {
                      header: t('common.date'),
                      accessor: 'createdAt',
                      render: (item) => formatDateTime(item.createdAt),
                    },
                    { header: t('customers.description'), accessor: 'description' },
                    {
                      header: t('customers.points'),
                      accessor: 'points',
                      align: 'right',
                      render: (item) => (
                        <span className={item.points >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {item.points >= 0 ? '+' : ''}{item.points}
                        </span>
                      ),
                    },
                    {
                      header: t('customers.order'),
                      accessor: 'orderId',
                      render: (item) => item.orderId ? `#${item.orderId}` : '-',
                    },
                  ]}
                  data={loyaltyTransactions}
                  keyExtractor={(item) => item.id}
                  emptyMessage={t('customers.noLoyaltyTransactions')}
                />
              )}
            </div>
          </div>
        </div>

        {/* Edit customer modal */}
        {customerFormModal(
          !!editingCustomer,
          () => setEditingCustomer(null),
          t('customers.editCustomer')
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Users size={15} className="text-blue-600 shrink-0" />
            <h1 className="text-xs font-bold text-gray-900 tracking-tight">{t('customers.title')}</h1>
          </div>

          {/* Search */}
          <div className="relative w-56">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
              placeholder={t('customers.searchPlaceholder')}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors"
          >
            <Plus size={11} />
            <span>{t('customers.addCustomer')}</span>
          </button>
        </div>
      </div>

      {/* Loyalty Overview */}
      <div className="flex-shrink-0 px-3 py-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="bg-white rounded-md border border-gray-200 p-2.5 flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-yellow-50 text-yellow-600 shrink-0">
              <Award size={16} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500">{t('customers.totalPointsBalance')}</p>
              <p className="text-sm font-bold text-gray-900">{totalPointsIssued.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-2.5 flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-blue-50 text-blue-600 shrink-0">
              <Users size={16} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500">{t('customers.totalCustomers')}</p>
              <p className="text-sm font-bold text-gray-900">{customers.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-2.5 flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-green-50 text-green-600 shrink-0">
              <CurrencyIcon size={16} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500">{t('customers.totalRevenue')}</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(totalSpentAll)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-red-500">
            <AlertCircle size={24} className="mb-2" />
            <p className="text-xs">{error}</p>
          </div>
        ) : (
          <DataTable
            columns={[
              { header: t('customers.phone'), accessor: 'phone', render: (item) => item.phone || '-' },
              { header: t('customers.loyaltyPoints'), accessor: 'loyaltyPoints', align: 'right' },
              {
                header: t('customers.totalSpent'),
                accessor: 'totalSpent',
                align: 'right',
                render: (item) => formatCurrency(item.totalSpent),
              },
              { header: t('customers.visits'), accessor: 'totalVisits', align: 'right' },
            ]}
            data={customers}
            onRowClick={handleRowClick}
            keyExtractor={(item) => item.id}
            emptyMessage={t('customers.noCustomersFound')}
          />
        )}
      </div>

      {/* Add customer modal */}
      {customerFormModal(showAddModal, () => setShowAddModal(false), t('customers.addCustomer'))}
    </div>
  );
};

export default Customers;
