import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/lib/api';
import { setUnauthorizedHandler } from '@/lib/api';

interface User {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  token: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  tfaChallenge: string | null;
  
  login: (username: string, password: string) => Promise<'authenticated' | 'tfa-required' | 'error'>;
  verifyTwoFactor: (code: string) => Promise<boolean>;
  cancelTwoFactor: () => void;
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
      tfaChallenge: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const { data, error } = await authApi.login(username, password);

          if (error) {
            set({
              error: error === 'Invalid credentials' ? 'Username atau password salah' : error,
              isLoading: false
            });
            return 'error';
          }

          if (data) {
            if ('requiresTwoFactor' in data) {
              set({
                user: null,
                isAuthenticated: false,
                tfaChallenge: data.challenge,
                isLoading: false,
                error: null,
              });
              return 'tfa-required';
            }
            const user: User = {
              id: data.id,
              username: data.username,
              role: data.role,
              createdAt: data.createdAt,
              token: data.token,
            };
            set({
              user,
              isAuthenticated: true,
              tfaChallenge: null,
              isLoading: false,
              error: null,
            });
            return 'authenticated';
          }

          set({ error: 'Terjadi kesalahan saat login', isLoading: false });
          return 'error';
        } catch (error) {
          set({ error: 'Terjadi kesalahan saat login', isLoading: false });
          return 'error';
        }
      },

      verifyTwoFactor: async (code: string) => {
        const { tfaChallenge } = get();
        if (!tfaChallenge) {
          set({ error: 'Sesi verifikasi sudah berakhir' });
          return false;
        }

        set({ isLoading: true, error: null });
        const { data, error } = await authApi.verifyTwoFactor(tfaChallenge, code);
        if (!data || error) {
          set({ error: error || 'Kode verifikasi tidak valid', isLoading: false });
          return false;
        }

        const user: User = {
          id: data.id,
          username: data.username,
          role: data.role,
          createdAt: data.createdAt,
          token: data.token,
        };
        set({
          user,
          isAuthenticated: true,
          tfaChallenge: null,
          isLoading: false,
          error: null,
        });
        return true;
      },

      cancelTwoFactor: () => {
        set({ tfaChallenge: null, error: null, isLoading: false });
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
            set({ isLoading: false, error: null });
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
        set({ user: null, isAuthenticated: false, tfaChallenge: null, error: null });
      },

      clearError: () => {
        set({ error: null });
      },

      checkSession: async () => {
        const { user } = get();
        if (!user || !user.token) {
          set({ user: null, isAuthenticated: false });
          return;
        }

        // Decode JWT payload (base64) and check exp
        try {
          const payloadPart = user.token.split('.')[1];
          if (!payloadPart) throw new Error('Invalid token structure');
          const payload = JSON.parse(atob(payloadPart));
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < now) {
            // Token expired — log out
            set({ user: null, isAuthenticated: false, error: null });
          }
        } catch {
          // Malformed token — log out
          set({ user: null, isAuthenticated: false, error: null });
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

// Register logout handler untuk 401 responses
setUnauthorizedHandler(() => {
  useAuthStore.getState().logout();
});
