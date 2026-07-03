import { create } from 'zustand';
import { ipc } from '../lib/ipc';

interface Staff {
  id: number;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  roleId: number;
}

interface AuthState {
  currentUser: Staff | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (pin: string) => Promise<void>;
  logout: () => void;
  getCurrentUser: () => Staff | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (pin: string) => {
    set({ isLoading: true });
    try {
      const user: any = await ipc(window.electronAPI.staff.login(pin));
      const staff: Staff = {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        roleId: user.roleId,
        role: user.role?.name ?? '',
      };
      set({
        currentUser: staff,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    set({
      currentUser: null,
      isAuthenticated: false,
    });
  },

  getCurrentUser: () => {
    return get().currentUser;
  },
}));
