import { create } from 'zustand';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: number;
}

export type Theme = 'light' | 'dark' | 'black';

interface UIState {
  sidebarCollapsed: boolean;
  activeModal: string | null;
  modalData: any;
  notifications: Notification[];
  theme: Theme;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  showModal: (modalId: string, data?: any) => void;
  hideModal: () => void;
  addNotification: (type: Notification['type'], message: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setTheme: (theme: Theme) => void;
}

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || saved === 'light' || saved === 'black') return saved;
  return 'light';
}

function applyThemeClasses(theme: Theme) {
  const root = document.documentElement.classList;
  const isAnyDark = theme === 'dark' || theme === 'black';
  root.toggle('dark', isAnyDark);
  root.toggle('theme-dark', theme === 'dark');
  root.toggle('theme-black', theme === 'black');
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarCollapsed: true,
  activeModal: null,
  modalData: null,
  notifications: [],
  theme: getInitialTheme(),

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed });
  },

  showModal: (modalId: string, data?: any) => {
    set({ activeModal: modalId, modalData: data ?? null });
  },

  hideModal: () => {
    set({ activeModal: null, modalData: null });
  },

  addNotification: (type: Notification['type'], message: string) => {
    const notification: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      message,
      timestamp: Date.now(),
    };
    set((state) => ({
      notifications: [...state.notifications, notification],
    }));

    // Auto-remove after 5 seconds
    setTimeout(() => {
      get().removeNotification(notification.id);
    }, 5000);
  },

  removeNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },

  setTheme: (theme: Theme) => {
    localStorage.setItem('theme', theme);
    applyThemeClasses(theme);
    set({ theme });
  },
}));

// Apply theme on load
(() => {
  const theme = getInitialTheme();
  applyThemeClasses(theme);
})();
