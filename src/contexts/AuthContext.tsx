import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { generateDeviceFingerprint } from '@/utils/deviceFingerprint';

type DeviceStatus = 'checking' | 'approved' | 'pending' | 'blocked' | null;

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
  // For permission checking (fetched from user_permissions table)
  hasPermission: (permissionKey: string) => boolean;
  permissions: string[];
  refreshPermissions: () => Promise<void>;
  // Backward compatibility - these map to permission checks
  role: AppRole | null;
  isHR: boolean;
  isTimekeeper: boolean;
  hasElevatedRole: boolean;
  deviceStatus: DeviceStatus;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [baseRole, setBaseRole] = useState<BaseRole | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(null);

  const checkDeviceTrust = async (
    userId: string,
    isAdminUser: boolean
  ): Promise<'approved' | 'pending' | 'blocked'> => {
    try {
      // Admins always have access — never lock them out
      if (isAdminUser) return 'approved';

      const { fingerprint, deviceName } = await generateDeviceFingerprint();

      const { data: existing } = await supabase
        .from('trusted_devices')
        .select('id, status')
        .eq('user_id', userId)
        .eq('device_fingerprint', fingerprint)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('trusted_devices')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', existing.id);
        return existing.status as 'approved' | 'pending' | 'blocked';
      }

      await supabase.from('trusted_devices').insert({
        user_id: userId,
        device_fingerprint: fingerprint,
        device_name: deviceName,
        status: 'pending',
      });
      return 'pending';
    } catch (error) {
      console.error('Device check error:', error);
      // Fail open to avoid lockouts
      return 'approved';
    }
  };

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch active status from profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }
      
      // Fetch role from user_roles table (secure location)
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (roleError) {
        console.error('Error fetching role:', roleError);
      }
      
      // Fetch effective permissions from user_permissions cache
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('permission_key')
        .eq('user_id', userId)
        .eq('allowed', true);
      
      if (permissionsError) {
        console.error('Error fetching permissions:', permissionsError);
      }
      
      // Map the role: admin stays admin, anything else becomes employee
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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          // Use setTimeout to avoid potential deadlocks
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

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      
      if (initialSession?.user) {
        fetchUserData(initialSession.user.id).then(userData => {
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setBaseRole(null);
    setIsActive(true);
    setPermissions([]);
  };

  const isAdmin = baseRole === 'admin';
  
  // Check if user has a specific permission
  // Admin always has all permissions
  const hasPermission = (permissionKey: string): boolean => {
    if (isAdmin) return true;
    return permissions.includes(permissionKey);
  };

  // Backward compatibility mappings
  // Map to legacy role based on permissions
  const getLegacyRole = (): AppRole | null => {
    if (isAdmin) return 'admin';
    // Check if has HR-like permissions
    if (hasPermission('timekeeping.employees.manage') || hasPermission('timekeeping.reports.export')) {
      return 'hr';
    }
    // Default to timekeeper if they have timekeeping access
    if (hasPermission('module.timekeeping')) {
      return 'timekeeper';
    }
    return 'timekeeper'; // Default
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
        // Backward compatibility
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
