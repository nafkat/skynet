import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Base roles are now only Admin and Employee
type BaseRole = 'admin' | 'employee';

// Legacy role type for backward compatibility
type AppRole = 'admin' | 'hr' | 'timekeeper';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  baseRole: BaseRole | null;
  loading: boolean;
  isActive: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  hasPermission: (permissionKey: string) => boolean;
  permissions: string[];
  refreshPermissions: () => Promise<void>;
  role: AppRole | null;
  isHR: boolean;
  isTimekeeper: boolean;
  hasElevatedRole: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [baseRole, setBaseRole] = useState<BaseRole | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);

  const fetchUserData = async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('user_id', userId)
        .maybeSingle();

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      const { data: permissionsData } = await supabase
        .from('user_permissions')
        .select('permission_key')
        .eq('user_id', userId)
        .eq('allowed', true);

      const role = roleData?.role;
      const baseRole: BaseRole = role === 'admin' ? 'admin' : 'employee';

      return {
        baseRole,
        isActive: profileData?.is_active ?? true,
        permissions: (permissionsData || []).map(p => p.permission_key),
      };
    } catch (err) {
      console.error('Error fetching user data:', err);
      return { baseRole: 'employee' as BaseRole, isActive: true, permissions: [] };
    }
  };

  const refreshPermissions = async () => {
    if (!user) return;
    const { data: permissionsData } = await supabase
      .from('user_permissions')
      .select('permission_key')
      .eq('user_id', user.id)
      .eq('allowed', true);
    setPermissions((permissionsData || []).map(p => p.permission_key));
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          setTimeout(async () => {
            const userData = await fetchUserData(currentSession.user.id);
            setBaseRole(userData.baseRole);
            setIsActive(userData.isActive);
            setPermissions(userData.permissions);
            setLoading(false);
          }, 0);
        } else {
          setBaseRole(null);
          setIsActive(true);
          setPermissions([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        fetchUserData(initialSession.user.id).then((userData) => {
          setBaseRole(userData.baseRole);
          setIsActive(userData.isActive);
          setPermissions(userData.permissions);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const clearAuthState = () => {
    setSession(null);
    setUser(null);
    setBaseRole(null);
    setIsActive(true);
    setPermissions([]);
    setLoading(false);
  };

  const signOut = async () => {
    clearAuthState();
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } finally {
      clearAuthState();
    }
  };

  const isAdmin = baseRole === 'admin';

  const hasPermission = (permissionKey: string): boolean => {
    if (isAdmin) return true;
    return permissions.includes(permissionKey);
  };

  const getLegacyRole = (): AppRole | null => {
    if (isAdmin) return 'admin';
    if (hasPermission('timekeeping.employees.manage') || hasPermission('timekeeping.reports.export')) {
      return 'hr';
    }
    if (hasPermission('module.timekeeping')) return 'timekeeper';
    return 'timekeeper';
  };

  const role = getLegacyRole();
  const isHR = hasPermission('timekeeping.employees.manage') || hasPermission('timekeeping.reports.export');
  const isTimekeeper = hasPermission('module.timekeeping') && !isAdmin && !isHR;
  const hasElevatedRole = isAdmin || isHR;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        baseRole,
        loading,
        isActive,
        signIn,
        signOut,
        isAdmin,
        hasPermission,
        permissions,
        refreshPermissions,
        role,
        isHR,
        isTimekeeper,
        hasElevatedRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
