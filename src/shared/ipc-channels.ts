export const MENU = {
  getCategories: 'menu:getCategories',
  getItems: 'menu:getItems',
  createItem: 'menu:createItem',
  updateItem: 'menu:updateItem',
  deleteItem: 'menu:deleteItem',
  getVariations: 'menu:getVariations',
  createVariation: 'menu:createVariation',
  updateVariation: 'menu:updateVariation',
  deleteVariation: 'menu:deleteVariation',
  getAddons: 'menu:getAddons',
  createAddon: 'menu:createAddon',
  updateAddon: 'menu:updateAddon',
  deleteAddon: 'menu:deleteAddon',
  getAddonGroups: 'menu:getAddonGroups',
  createAddonGroup: 'menu:createAddonGroup',
  updateAddonGroup: 'menu:updateAddonGroup',
  deleteAddonGroup: 'menu:deleteAddonGroup',
  getItemAddonGroupIds: 'menu:getItemAddonGroupIds',
  linkAddonGroupToItem: 'menu:linkAddonGroupToItem',
  unlinkAddonGroupFromItem: 'menu:unlinkAddonGroupFromItem',
  setAddonVariationPrices: 'menu:setAddonVariationPrices',
  getVariationNamesForAddonGroup: 'menu:getVariationNamesForAddonGroup',
  getCombos: 'menu:getCombos',
  createCombo: 'menu:createCombo',
  updateCombo: 'menu:updateCombo',
  deleteCombo: 'menu:deleteCombo',
  createCategory: 'menu:createCategory',
  updateCategory: 'menu:updateCategory',
  deleteCategory: 'menu:deleteCategory',
  forceDeleteCategory: 'menu:forceDeleteCategory',
  forceDeleteItem: 'menu:forceDeleteItem',
  toggleAvailability: 'menu:toggleAvailability',
  togglePin: 'menu:togglePin',
  getTopSellingIds: 'menu:getTopSellingIds',
} as const;

export const ORDERS = {
  create: 'orders:create',
  getActive: 'orders:getActive',
  getById: 'orders:getById',
  getByTable: 'orders:getByTable',
  getAll: 'orders:getAll',
  updateStatus: 'orders:updateStatus',
  addItems: 'orders:addItems',
  removeItem: 'orders:removeItem',
  applyDiscount: 'orders:applyDiscount',
  splitBill: 'orders:splitBill',
  mergeBills: 'orders:mergeBills',
  moveTable: 'orders:moveTable',
  updateCustomer: 'orders:updateCustomer',
  getByCustomer: 'orders:getByCustomer',
  delete: 'orders:delete',
} as const;

export const FAVORITES = {
  getAll: 'favorites:getAll',
  add: 'favorites:add',
  remove: 'favorites:remove',
} as const;

export const TABLES = {
  getAll: 'tables:getAll',
  getByFloor: 'tables:getByFloor',
  create: 'tables:create',
  update: 'tables:update',
  delete: 'tables:delete',
  forceDelete: 'tables:forceDelete',
  updateStatus: 'tables:updateStatus',
  togglePin: 'tables:togglePin',
  getFloors: 'tables:getFloors',
  createFloor: 'tables:createFloor',
  updateFloor: 'tables:updateFloor',
  deleteFloor: 'tables:deleteFloor',
  forceDeleteFloor: 'tables:forceDeleteFloor',
} as const;

export const INVENTORY = {
  getAll: 'inventory:getAll',
  getItem: 'inventory:getItem',
  create: 'inventory:create',
  update: 'inventory:update',
  adjustStock: 'inventory:adjustStock',
  getLowStock: 'inventory:getLowStock',
  getTransactions: 'inventory:getTransactions',
} as const;

export const RECIPES = {
  getByItem: 'recipes:getByItem',
  create: 'recipes:create',
  update: 'recipes:update',
  delete: 'recipes:delete',
} as const;

export const SUPPLIERS = {
  getAll: 'suppliers:getAll',
  create: 'suppliers:create',
  update: 'suppliers:update',
} as const;

export const PURCHASE_ORDERS = {
  getAll: 'purchaseOrders:getAll',
  create: 'purchaseOrders:create',
  update: 'purchaseOrders:update',
  receive: 'purchaseOrders:receive',
} as const;

export const STAFF = {
  getAll: 'staff:getAll',
  create: 'staff:create',
  update: 'staff:update',
  delete: 'staff:delete',
  login: 'staff:login',
  clockIn: 'staff:clockIn',
  clockOut: 'staff:clockOut',
  getAttendance: 'staff:getAttendance',
} as const;

export const CUSTOMERS = {
  getAll: 'customers:getAll',
  getById: 'customers:getById',
  search: 'customers:search',
  create: 'customers:create',
  update: 'customers:update',
  getLoyalty: 'customers:getLoyalty',
  addLoyalty: 'customers:addLoyalty',
  findByPhone: 'customers:findByPhone',
  recordVisit: 'customers:recordVisit',
} as const;

export const PAYMENTS = {
  create: 'payments:create',
  getByOrder: 'payments:getByOrder',
  getReconciliation: 'payments:getReconciliation',
} as const;

export const KOT = {
  create: 'kot:create',
  getActive: 'kot:getActive',
  updateStatus: 'kot:updateStatus',
  getByStation: 'kot:getByStation',
  printReceipt: 'kot:printReceipt',
  testPrint: 'kot:testPrint',
  getLatestByOrder: 'kot:getLatestByOrder',
} as const;

export const BILL = {
  printReceipt: 'bill:printReceipt',
  testPrint: 'bill:testPrint',
} as const;

export const REPORTS = {
  dailySales: 'reports:dailySales',
  itemWiseSales: 'reports:itemWiseSales',
  categoryWiseSales: 'reports:categoryWiseSales',
  paymentSummary: 'reports:paymentSummary',
  cashFlow: 'reports:cashFlow',
  inventoryConsumption: 'reports:inventoryConsumption',
  gstReport: 'reports:gstReport',
  staffPerformance: 'reports:staffPerformance',
  dayEndSummary: 'reports:dayEndSummary',
  kitchenPrepTime: 'reports:kitchenPrepTime',
  shiftHandover: 'reports:shiftHandover',
  busyHours: 'reports:busyHours',
} as const;

export const SETTINGS = {
  get: 'settings:get',
  set: 'settings:set',
  getRestaurant: 'settings:getRestaurant',
  updateRestaurant: 'settings:updateRestaurant',
  saveLogo: 'settings:saveLogo',
  getLogoDataUrl: 'settings:getLogoDataUrl',
  getRoles: 'settings:getRoles',
  updateRole: 'settings:updateRole',
  getPrinters: 'settings:getPrinters',
} as const;

export const DAY_SESSION = {
  open: 'daySession:open',
  close: 'daySession:close',
  getCurrent: 'daySession:getCurrent',
} as const;

export const BACKUP = {
  create: 'backup:create',
  restore: 'backup:restore',
  reset: 'backup:reset',
  archiveOldOrders: 'backup:archiveOldOrders',
} as const;

export const LICENSE = {
  getStatus: 'license:getStatus',
  activate: 'license:activate',
  clear: 'license:clear',
} as const;

export const WHATSAPP = {
  initialize: 'whatsapp:initialize',
  getStatus: 'whatsapp:getStatus',
  getLastQr: 'whatsapp:getLastQr',
  disconnect: 'whatsapp:disconnect',
  sendBill: 'whatsapp:sendBill',
} as const;

export const WHATSAPP_EVENTS = {
  qrCode: 'whatsapp:event:qr',
  statusChange: 'whatsapp:event:statusChange',
} as const;

export const GDRIVE = {
  signIn: 'gdrive:signIn',
  signOut: 'gdrive:signOut',
  getAccount: 'gdrive:getAccount',
  uploadBackup: 'gdrive:uploadBackup',
  listBackups: 'gdrive:listBackups',
  restoreBackup: 'gdrive:restoreBackup',
} as const;

export const CLOUD = {
  getStatus: 'cloud:getStatus',
  connect: 'cloud:connect',
  disconnect: 'cloud:disconnect',
  syncNow: 'cloud:syncNow',
} as const;

export const KITCHEN_NETWORK = {
  getInfo: 'kitchenNetwork:getInfo',
  start: 'kitchenNetwork:start',
  stop: 'kitchenNetwork:stop',
  setEnabled: 'kitchenNetwork:setEnabled',
  setPort: 'kitchenNetwork:setPort',
  regenerateToken: 'kitchenNetwork:regenerateToken',
} as const;

export const WAITER_NETWORK = {
  getInfo: 'waiterNetwork:getInfo',
  setEnabled: 'waiterNetwork:setEnabled',
  regenerateToken: 'waiterNetwork:regenerateToken',
} as const;
