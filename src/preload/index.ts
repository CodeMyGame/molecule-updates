import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

const api = {
  menu: {
    getCategories: () => ipcRenderer.invoke('menu:getCategories'),
    getItems: (categoryId?: number) => ipcRenderer.invoke('menu:getItems', categoryId),
    createItem: (data: any) => ipcRenderer.invoke('menu:createItem', data),
    updateItem: (id: number, data: any) => ipcRenderer.invoke('menu:updateItem', id, data),
    deleteItem: (id: number) => ipcRenderer.invoke('menu:deleteItem', id),
    getVariations: (itemId: number) => ipcRenderer.invoke('menu:getVariations', itemId),
    createVariation: (data: any) => ipcRenderer.invoke('menu:createVariation', data),
    updateVariation: (id: number, data: any) => ipcRenderer.invoke('menu:updateVariation', id, data),
    deleteVariation: (id: number) => ipcRenderer.invoke('menu:deleteVariation', id),
    getAddons: (itemId?: number) => ipcRenderer.invoke('menu:getAddons', itemId),
    createAddon: (data: any) => ipcRenderer.invoke('menu:createAddon', data),
    updateAddon: (id: number, data: any) => ipcRenderer.invoke('menu:updateAddon', id, data),
    deleteAddon: (id: number) => ipcRenderer.invoke('menu:deleteAddon', id),
    getAddonGroups: () => ipcRenderer.invoke('menu:getAddonGroups'),
    createAddonGroup: (data: any) => ipcRenderer.invoke('menu:createAddonGroup', data),
    updateAddonGroup: (id: number, data: any) => ipcRenderer.invoke('menu:updateAddonGroup', id, data),
    deleteAddonGroup: (id: number) => ipcRenderer.invoke('menu:deleteAddonGroup', id),
    getItemAddonGroupIds: (menuItemId: number) => ipcRenderer.invoke('menu:getItemAddonGroupIds', menuItemId),
    linkAddonGroupToItem: (menuItemId: number, addonGroupId: number) => ipcRenderer.invoke('menu:linkAddonGroupToItem', menuItemId, addonGroupId),
    unlinkAddonGroupFromItem: (menuItemId: number, addonGroupId: number) => ipcRenderer.invoke('menu:unlinkAddonGroupFromItem', menuItemId, addonGroupId),
    setAddonVariationPrices: (addonId: number, variationPrices: Record<string, number>) => ipcRenderer.invoke('menu:setAddonVariationPrices', addonId, variationPrices),
    getVariationNamesForAddonGroup: (addonGroupId: number) => ipcRenderer.invoke('menu:getVariationNamesForAddonGroup', addonGroupId),
    getCombos: () => ipcRenderer.invoke('menu:getCombos'),
    createCombo: (data: any) => ipcRenderer.invoke('menu:createCombo', data),
    updateCombo: (id: number, data: any) => ipcRenderer.invoke('menu:updateCombo', id, data),
    deleteCombo: (id: number) => ipcRenderer.invoke('menu:deleteCombo', id),
    createCategory: (data: any) => ipcRenderer.invoke('menu:createCategory', data),
    updateCategory: (id: number, data: any) => ipcRenderer.invoke('menu:updateCategory', id, data),
    deleteCategory: (id: number) => ipcRenderer.invoke('menu:deleteCategory', id),
    forceDeleteCategory: (id: number) => ipcRenderer.invoke('menu:forceDeleteCategory', id),
    forceDeleteItem: (id: number) => ipcRenderer.invoke('menu:forceDeleteItem', id),
    toggleAvailability: (id: number) => ipcRenderer.invoke('menu:toggleAvailability', id),
    togglePin: (id: number) => ipcRenderer.invoke('menu:togglePin', id),
    getTopSellingIds: (limit?: number) => ipcRenderer.invoke('menu:getTopSellingIds', limit ?? 10),
  },

  orders: {
    create: (data: any) => ipcRenderer.invoke('orders:create', data),
    getActive: () => ipcRenderer.invoke('orders:getActive'),
    getById: (id: number) => ipcRenderer.invoke('orders:getById', id),
    getByTable: (tableId: number) => ipcRenderer.invoke('orders:getByTable', tableId),
    getAll: (filters?: any) => ipcRenderer.invoke('orders:getAll', filters),
    updateStatus: (id: number, status: string) => ipcRenderer.invoke('orders:updateStatus', id, status),
    addItems: (orderId: number, items: any[]) => ipcRenderer.invoke('orders:addItems', orderId, items),
    removeItem: (orderId: number, itemId: number) => ipcRenderer.invoke('orders:removeItem', orderId, itemId),
    applyDiscount: (orderId: number, discount: any) => ipcRenderer.invoke('orders:applyDiscount', orderId, discount),
    splitBill: (orderId: number, itemIds: number[], targetTableId?: number) => ipcRenderer.invoke('orders:splitBill', orderId, itemIds, targetTableId),
    mergeBills: (sourceOrderId: number, targetOrderId: number) => ipcRenderer.invoke('orders:mergeBills', sourceOrderId, targetOrderId),
    moveTable: (orderId: number, tableId: number) => ipcRenderer.invoke('orders:moveTable', orderId, tableId),
    updateCustomer: (orderId: number, customerId: number) => ipcRenderer.invoke('orders:updateCustomer', orderId, customerId),
    getByCustomer: (customerId: number, limit?: number) => ipcRenderer.invoke('orders:getByCustomer', customerId, limit ?? 5),
    delete: (orderId: number) => ipcRenderer.invoke('orders:delete', orderId),
  },

  favorites: {
    getAll: () => ipcRenderer.invoke('favorites:getAll'),
    add: (menuItemId: number) => ipcRenderer.invoke('favorites:add', menuItemId),
    remove: (menuItemId: number) => ipcRenderer.invoke('favorites:remove', menuItemId),
  },

  tables: {
    getAll: () => ipcRenderer.invoke('tables:getAll'),
    getByFloor: (floorId: number) => ipcRenderer.invoke('tables:getByFloor', floorId),
    create: (data: any) => ipcRenderer.invoke('tables:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('tables:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('tables:delete', id),
    forceDelete: (id: number) => ipcRenderer.invoke('tables:forceDelete', id),
    updateStatus: (id: number, status: string) => ipcRenderer.invoke('tables:updateStatus', id, status),
    togglePin: (id: number) => ipcRenderer.invoke('tables:togglePin', id),
    getFloors: () => ipcRenderer.invoke('tables:getFloors'),
    createFloor: (data: any) => ipcRenderer.invoke('tables:createFloor', data),
    updateFloor: (id: number, name: string) => ipcRenderer.invoke('tables:updateFloor', id, name),
    deleteFloor: (id: number) => ipcRenderer.invoke('tables:deleteFloor', id),
    forceDeleteFloor: (id: number) => ipcRenderer.invoke('tables:forceDeleteFloor', id),
  },

  inventory: {
    getAll: () => ipcRenderer.invoke('inventory:getAll'),
    getItem: (id: number) => ipcRenderer.invoke('inventory:getItem', id),
    create: (data: any) => ipcRenderer.invoke('inventory:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('inventory:update', id, data),
    adjustStock: (id: number, adjustment: any) => ipcRenderer.invoke('inventory:adjustStock', id, adjustment),
    getLowStock: () => ipcRenderer.invoke('inventory:getLowStock'),
    getTransactions: (itemId?: number) => ipcRenderer.invoke('inventory:getTransactions', itemId),
  },

  recipes: {
    getByItem: (itemId: number) => ipcRenderer.invoke('recipes:getByItem', itemId),
    create: (data: any) => ipcRenderer.invoke('recipes:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('recipes:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('recipes:delete', id),
  },

  suppliers: {
    getAll: () => ipcRenderer.invoke('suppliers:getAll'),
    create: (data: any) => ipcRenderer.invoke('suppliers:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('suppliers:update', id, data),
  },

  purchaseOrders: {
    getAll: (filters?: any) => ipcRenderer.invoke('purchaseOrders:getAll', filters),
    create: (data: any) => ipcRenderer.invoke('purchaseOrders:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('purchaseOrders:update', id, data),
    receive: (id: number, data: any) => ipcRenderer.invoke('purchaseOrders:receive', id, data),
  },

  staff: {
    getAll: () => ipcRenderer.invoke('staff:getAll'),
    create: (data: any) => ipcRenderer.invoke('staff:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('staff:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('staff:delete', id),
    login: (pin: string) => ipcRenderer.invoke('staff:login', pin),
    clockIn: (staffId: number) => ipcRenderer.invoke('staff:clockIn', staffId),
    clockOut: (staffId: number) => ipcRenderer.invoke('staff:clockOut', staffId),
    getAttendance: (staffId?: number, filters?: any) => ipcRenderer.invoke('staff:getAttendance', staffId, filters),
  },

  customers: {
    getAll: (filters?: any) => ipcRenderer.invoke('customers:getAll', filters),
    getById: (id: number) => ipcRenderer.invoke('customers:getById', id),
    search: (query: string) => ipcRenderer.invoke('customers:search', query),
    create: (data: any) => ipcRenderer.invoke('customers:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('customers:update', id, data),
    getLoyalty: (customerId: number) => ipcRenderer.invoke('customers:getLoyalty', customerId),
    addLoyalty: (customerId: number, points: number) => ipcRenderer.invoke('customers:addLoyalty', customerId, points),
    findByPhone: (phone: string) => ipcRenderer.invoke('customers:findByPhone', phone),
    recordVisit: (customerId: number, amountSpent: number) => ipcRenderer.invoke('customers:recordVisit', customerId, amountSpent),
  },

  payments: {
    create: (data: any) => ipcRenderer.invoke('payments:create', data),
    getByOrder: (orderId: number) => ipcRenderer.invoke('payments:getByOrder', orderId),
    getReconciliation: (filters?: any) => ipcRenderer.invoke('payments:getReconciliation', filters),
  },

  kot: {
    create: (data: any) => ipcRenderer.invoke('kot:create', data),
    getActive: () => ipcRenderer.invoke('kot:getActive'),
    updateStatus: (id: number, status: string) => ipcRenderer.invoke('kot:updateStatus', id, status),
    getByStation: (station: string) => ipcRenderer.invoke('kot:getByStation', station),
    printReceipt: (kotId: number) => ipcRenderer.invoke('kot:printReceipt', kotId),
    testPrint: () => ipcRenderer.invoke('kot:testPrint'),
    getLatestByOrder: (orderId: number) => ipcRenderer.invoke('kot:getLatestByOrder', orderId),
  },

  bill: {
    printReceipt: (receiptText: string) => ipcRenderer.invoke('bill:printReceipt', receiptText),
    testPrint: () => ipcRenderer.invoke('bill:testPrint'),
  },

  reports: {
    dailySales: (filters?: any) => ipcRenderer.invoke('reports:dailySales', filters),
    itemWiseSales: (filters?: any) => ipcRenderer.invoke('reports:itemWiseSales', filters),
    categoryWiseSales: (filters?: any) => ipcRenderer.invoke('reports:categoryWiseSales', filters),
    paymentSummary: (filters?: any) => ipcRenderer.invoke('reports:paymentSummary', filters),
    cashFlow: (filters?: any) => ipcRenderer.invoke('reports:cashFlow', filters),
    inventoryConsumption: (filters?: any) => ipcRenderer.invoke('reports:inventoryConsumption', filters),
    gstReport: (filters?: any) => ipcRenderer.invoke('reports:gstReport', filters),
    staffPerformance: (filters?: any) => ipcRenderer.invoke('reports:staffPerformance', filters),
    dayEndSummary: (filters?: any) => ipcRenderer.invoke('reports:dayEndSummary', filters),
    kitchenPrepTime: (filters?: any) => ipcRenderer.invoke('reports:kitchenPrepTime', filters),
    shiftHandover: (staffId: number, filters?: any) => ipcRenderer.invoke('reports:shiftHandover', staffId, filters),
    busyHours: (filters?: any) => ipcRenderer.invoke('reports:busyHours', filters),
  },

  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any, category?: string) => ipcRenderer.invoke('settings:set', key, value, category ?? 'general'),
    getRestaurant: () => ipcRenderer.invoke('settings:getRestaurant'),
    updateRestaurant: (data: any) => ipcRenderer.invoke('settings:updateRestaurant', data),
    saveLogo: (dataUrl: string) => ipcRenderer.invoke('settings:saveLogo', dataUrl),
    getLogoDataUrl: () => ipcRenderer.invoke('settings:getLogoDataUrl'),
    getRoles: () => ipcRenderer.invoke('settings:getRoles'),
    updateRole: (id: number, data: any) => ipcRenderer.invoke('settings:updateRole', id, data),
    getPrinters: () => ipcRenderer.invoke('settings:getPrinters'),
  },

  daySession: {
    open: (data: any) => ipcRenderer.invoke('daySession:open', data),
    close: (data: any) => ipcRenderer.invoke('daySession:close', data),
    getCurrent: () => ipcRenderer.invoke('daySession:getCurrent'),
  },

  license: {
    getStatus: () => ipcRenderer.invoke('license:getStatus'),
    activate: (key: string) => ipcRenderer.invoke('license:activate', key),
    clear: () => ipcRenderer.invoke('license:clear'),
  },

  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    restore: () => ipcRenderer.invoke('backup:restore'),
    reset: () => ipcRenderer.invoke('backup:reset'),
    archiveOldOrders: (olderThanDays: number) =>
      ipcRenderer.invoke('backup:archiveOldOrders', olderThanDays),
  },

  offers: {
    getAll: () => ipcRenderer.invoke('offers:getAll'),
    getActive: () => ipcRenderer.invoke('offers:getActive'),
    create: (data: any) => ipcRenderer.invoke('offers:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('offers:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('offers:delete', id),
  },

  gdrive: {
    signIn: () => ipcRenderer.invoke('gdrive:signIn'),
    signOut: () => ipcRenderer.invoke('gdrive:signOut'),
    getAccount: () => ipcRenderer.invoke('gdrive:getAccount'),
    uploadBackup: () => ipcRenderer.invoke('gdrive:uploadBackup'),
    listBackups: () => ipcRenderer.invoke('gdrive:listBackups'),
    restoreBackup: (fileId: string) => ipcRenderer.invoke('gdrive:restoreBackup', fileId),
  },

  cloud: {
    getStatus: () => ipcRenderer.invoke('cloud:getStatus'),
    connect: (email: string, password: string, opts?: { create?: boolean }) =>
      ipcRenderer.invoke('cloud:connect', email, password, opts),
    disconnect: () => ipcRenderer.invoke('cloud:disconnect'),
    syncNow: () => ipcRenderer.invoke('cloud:syncNow'),
  },

  kitchenNetwork: {
    getInfo: () => ipcRenderer.invoke('kitchenNetwork:getInfo'),
    start: () => ipcRenderer.invoke('kitchenNetwork:start'),
    stop: () => ipcRenderer.invoke('kitchenNetwork:stop'),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('kitchenNetwork:setEnabled', enabled),
    setPort: (port: number) => ipcRenderer.invoke('kitchenNetwork:setPort', port),
    regenerateToken: () => ipcRenderer.invoke('kitchenNetwork:regenerateToken'),
  },

  waiterNetwork: {
    getInfo: () => ipcRenderer.invoke('waiterNetwork:getInfo'),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('waiterNetwork:setEnabled', enabled),
    regenerateToken: () => ipcRenderer.invoke('waiterNetwork:regenerateToken'),
  },

  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
    getVersion: () => ipcRenderer.invoke('updater:get-version'),
    onUpdateAvailable: (cb: (info: any) => void) => {
      const handler = (_e: IpcRendererEvent, info: any) => cb(info);
      ipcRenderer.on('updater:update-available', handler);
      return () => ipcRenderer.removeListener('updater:update-available', handler);
    },
    onUpdateNotAvailable: (cb: (info: any) => void) => {
      const handler = (_e: IpcRendererEvent, info: any) => cb(info);
      ipcRenderer.on('updater:update-not-available', handler);
      return () => ipcRenderer.removeListener('updater:update-not-available', handler);
    },
    onDownloadProgress: (cb: (progress: any) => void) => {
      const handler = (_e: IpcRendererEvent, p: any) => cb(p);
      ipcRenderer.on('updater:download-progress', handler);
      return () => ipcRenderer.removeListener('updater:download-progress', handler);
    },
    onUpdateDownloaded: (cb: (info: any) => void) => {
      const handler = (_e: IpcRendererEvent, info: any) => cb(info);
      ipcRenderer.on('updater:update-downloaded', handler);
      return () => ipcRenderer.removeListener('updater:update-downloaded', handler);
    },
    onError: (cb: (msg: string) => void) => {
      const handler = (_e: IpcRendererEvent, msg: string) => cb(msg);
      ipcRenderer.on('updater:error', handler);
      return () => ipcRenderer.removeListener('updater:error', handler);
    },
    installNow: () => ipcRenderer.send('updater:install-now'),
  },

  whatsapp: {
    initialize: () => ipcRenderer.invoke('whatsapp:initialize'),
    getStatus: () => ipcRenderer.invoke('whatsapp:getStatus'),
    getLastQr: () => ipcRenderer.invoke('whatsapp:getLastQr'),
    disconnect: () => ipcRenderer.invoke('whatsapp:disconnect'),
    sendBill: (data: { orderId: number; phone: string; labels?: Record<string, string> }) =>
      ipcRenderer.invoke('whatsapp:sendBill', data),
  },

  // Event listeners for push events from main process
  on: (channel: string, callback: (...args: any[]) => void) => {
    const subscription = (_event: IpcRendererEvent, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return subscription;
  },

  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
