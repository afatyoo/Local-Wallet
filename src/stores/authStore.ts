import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/lib/api';

interface User {
  id: string;
  username: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const { data, error } = await authApi.login(username, password);
          
          if (error) {
            set({ 
              error: error === 'Invalid credentials' ? 'Username atau password salah' : error, 
              isLoading: false 
            });
            return false;
          }

          if (data) {
            const user: User = {
              id: data.id,
              username: data.username,
              createdAt: data.createdAt,
            };
            set({ user, isAuthenticated: true, isLoading: false, error: null });
            return true;
          }

          set({ error: 'Terjadi kesalahan saat login', isLoading: false });
          return false;
        } catch (error) {
          set({ error: 'Terjadi kesalahan saat login', isLoading: false });
          return false;
        }
      },

      register: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const { data, error } = await authApi.register(username, password);
          
          if (error) {
            set({ 
              error: error === 'Username already exists' ? 'Username sudah digunakan' : error, 
              isLoading: false 
            });
            return false;
          }

          if (data) {
            const user: User = {
              id: data.id,
              username: data.username,
              createdAt: data.createdAt,
            };
            set({ user, isAuthenticated: true, isLoading: false, error: null });
            return true;
          }

          set({ error: 'Terjadi kesalahan saat registrasi', isLoading: false });
          return false;
        } catch (error) {
          set({ error: 'Terjadi kesalahan saat registrasi', isLoading: false });
          return false;
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, error: null });
      },

      clearError: () => {
        set({ error: null });
      },

      checkSession: async () => {
        // Session is managed via persisted state
        // User remains authenticated as long as their data is in localStorage
        const { user } = get();
        if (!user) {
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'finance-auth',
      partialize: (state) => ({ 
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
