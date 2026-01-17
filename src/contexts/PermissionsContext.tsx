import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ModuleAccess {
  module_key: string;
  can_access: boolean;
}

interface ActionPermission {
  action_key: string;
  allowed: boolean;
}

interface PermissionsContextType {
  moduleAccess: ModuleAccess[];
  actionPermissions: ActionPermission[];
  loading: boolean;
  hasModuleAccess: (moduleKey: string) => boolean;
  hasActionPermission: (actionKey: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [moduleAccess, setModuleAccess] = useState<ModuleAccess[]>([]);
  const [actionPermissions, setActionPermissions] = useState<ActionPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setModuleAccess([]);
      setActionPermissions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch module access
      const { data: modules, error: modulesError } = await supabase
        .from('user_module_access')
        .select('module_key, can_access')
        .eq('user_id', user.id);

      if (modulesError) {
        console.error('Error fetching module access:', modulesError);
      } else {
        setModuleAccess(modules || []);
      }

      // Fetch action permissions
      const { data: actions, error: actionsError } = await supabase
        .from('user_module_actions')
        .select('action_key, allowed')
        .eq('user_id', user.id);

      if (actionsError) {
        console.error('Error fetching action permissions:', actionsError);
      } else {
        setActionPermissions(actions || []);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchPermissions();
    }
  }, [authLoading, fetchPermissions]);

  const hasModuleAccess = useCallback((moduleKey: string): boolean => {
    const access = moduleAccess.find(m => m.module_key === moduleKey);
    return access?.can_access ?? false;
  }, [moduleAccess]);

  const hasActionPermission = useCallback((actionKey: string): boolean => {
    const permission = actionPermissions.find(a => a.action_key === actionKey);
    return permission?.allowed ?? false;
  }, [actionPermissions]);

  const refreshPermissions = useCallback(async () => {
    await fetchPermissions();
  }, [fetchPermissions]);

  return (
    <PermissionsContext.Provider
      value={{
        moduleAccess,
        actionPermissions,
        loading,
        hasModuleAccess,
        hasActionPermission,
        refreshPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
