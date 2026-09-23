import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
  switchUser: (user: User) => void;
  availableUsers: User[];
  canManageStreamers: boolean;
  canDeleteReports: boolean;
  canEditReports: boolean;
  canImportReports: boolean;
}

const DEFAULT_USERS: User[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Budi Santoso',
    email: 'admin@sra-analytics.com',
    role: 'admin',
    status: 'active',
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Siti Rahma',
    email: 'manager@sra-analytics.com',
    role: 'manager',
    status: 'active',
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    name: 'Andi Pratama',
    email: 'operator@sra-analytics.com',
    role: 'operator',
    status: 'active',
    created_at: '2026-09-01T00:00:00Z',
  },
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('sra_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_USERS[0];
      }
    }
    return DEFAULT_USERS[0]; // default to Admin for easy initial access
  });

  const [availableUsers, setAvailableUsers] = useState<User[]>(DEFAULT_USERS);

  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setAvailableUsers(json.data);
          // If current user is in new list, update it
          if (currentUser) {
            const found = json.data.find((u: User) => u.id === currentUser.id);
            if (found) setCurrentUser(found);
          }
        }
      })
      .catch(() => {
        // use default fallback
      });
  }, []);

  const login = (role: UserRole) => {
    const user = availableUsers.find((u) => u.role === role) || DEFAULT_USERS.find((u) => u.role === role);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('sra_user', JSON.stringify(user));
    }
  };

  const switchUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('sra_user', JSON.stringify(user));
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sra_user');
  };

  const role = currentUser?.role || 'operator';
  const canManageStreamers = role === 'admin' || role === 'manager';
  const canDeleteReports = role === 'admin' || role === 'manager';
  const canEditReports = role === 'admin' || role === 'manager';
  const canImportReports = true; // all roles can import reports

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        login,
        logout,
        switchUser,
        availableUsers,
        canManageStreamers,
        canDeleteReports,
        canEditReports,
        canImportReports,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
