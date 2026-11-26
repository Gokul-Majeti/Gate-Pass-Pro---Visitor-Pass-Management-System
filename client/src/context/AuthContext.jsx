import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getStoredToken, setStoredToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setOrganization(null);
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      setOrganization(data.organization);
    } catch {
      setStoredToken('');
      setUser(null);
      setOrganization(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setStoredToken(data.token);
    setUser(data.user);
    setOrganization(data.organization);
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setStoredToken(data.token);
    setUser(data.user);
    setOrganization(data.organization);
    return data;
  };

  const logout = () => {
    setStoredToken('');
    setUser(null);
    setOrganization(null);
  };

  const updateOrganizationState = (org) => {
    setOrganization(org);
  };

  const updateUserState = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        loading,
        login,
        register,
        logout,
        refreshProfile,
        updateOrganizationState,
        updateUserState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
