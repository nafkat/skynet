import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Lock, Unlock, UserPlus, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface LockedPeriod {
  id: string;
  start_date: string;
  end_date: string;
  locked_at: string;
  is_active: boolean;
}

export default function Settings() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [lockedPeriods, setLockedPeriods] = useState<LockedPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Lock period form
  const [lockStartDate, setLockStartDate] = useState('');
  const [lockEndDate, setLockEndDate] = useState('');
  const [isLockDialogOpen, setIsLockDialogOpen] = useState(false);
  
  // User creation form
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'hr' | 'timekeeper'>('timekeeper');
  const [newUserName, setNewUserName] = useState('');
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    fetchLockedPeriods();
  }, []);

  const fetchLockedPeriods = async () => {
    try {
      const { data } = await supabase
        .from('locked_periods')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: false });

      setLockedPeriods((data as LockedPeriod[]) || []);
    } catch (error) {
      console.error('Error fetching locked periods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLockPeriod = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!lockStartDate || !lockEndDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    try {
      const { error } = await supabase.from('locked_periods').insert({
        start_date: lockStartDate,
        end_date: lockEndDate,
        locked_by: user?.id,
      });

      if (error) throw error;

      toast.success('Period locked successfully');
      setIsLockDialogOpen(false);
      setLockStartDate('');
      setLockEndDate('');
      fetchLockedPeriods();
    } catch (error: any) {
      console.error('Error locking period:', error);
      toast.error(error.message || 'Error locking period');
    }
  };

  const handleUnlockPeriod = async (periodId: string) => {
    try {
      const { error } = await supabase
        .from('locked_periods')
        .update({
          is_active: false,
          unlocked_by: user?.id,
          unlocked_at: new Date().toISOString(),
        })
        .eq('id', periodId);

      if (error) throw error;

      toast.success('Period unlocked successfully');
      fetchLockedPeriods();
    } catch (error: any) {
      console.error('Error unlocking period:', error);
      toast.error(error.message || 'Error unlocking period');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUserEmail || !newUserPassword || !newUserName) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreatingUser(true);

    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            full_name: newUserName,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Assign role
        const { error: roleError } = await supabase.from('user_roles').insert({
          user_id: authData.user.id,
          role: newUserRole,
        });

        if (roleError) throw roleError;
      }

      toast.success('User created successfully');
      setIsUserDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('timekeeper');
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Error creating user');
    } finally {
      setCreatingUser(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">{t('common.loading')}</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">{t('nav.settings')}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Management */}
        <div className="card-elevated p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-semibold">User Management</h2>
          </div>

          <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full btn-tablet">
                <UserPlus className="h-5 w-5 mr-2" />
                Create New User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="input-tablet"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('auth.email')}</Label>
                  <Input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="input-tablet"
                    placeholder="user@shipyard.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('auth.password')}</Label>
                  <Input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="input-tablet"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as any)}>
                    <SelectTrigger className="input-tablet">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="timekeeper">{t('role.timekeeper')}</SelectItem>
                      <SelectItem value="hr">{t('role.hr')}</SelectItem>
                      <SelectItem value="admin">{t('role.admin')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsUserDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" className="flex-1" disabled={creatingUser}>
                    {creatingUser ? t('common.loading') : t('common.save')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lock Periods */}
        <div className="card-elevated p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Locked Periods</h2>
          </div>

          <Dialog open={isLockDialogOpen} onOpenChange={setIsLockDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full btn-tablet mb-6">
                <Lock className="h-5 w-5 mr-2" />
                Lock Date Range
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Lock Date Range</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleLockPeriod} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('common.from')}</Label>
                    <Input
                      type="date"
                      value={lockStartDate}
                      onChange={(e) => setLockStartDate(e.target.value)}
                      className="input-tablet"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('common.to')}</Label>
                    <Input
                      type="date"
                      value={lockEndDate}
                      onChange={(e) => setLockEndDate(e.target.value)}
                      className="input-tablet"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsLockDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" className="flex-1">
                    <Lock className="h-4 w-4 mr-2" />
                    Lock Period
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {lockedPeriods.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No locked periods</p>
          ) : (
            <div className="space-y-3">
              {lockedPeriods.map((period) => (
                <div
                  key={period.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30"
                >
                  <div>
                    <p className="font-mono text-sm">
                      {format(new Date(period.start_date), 'MMM d, yyyy')} -{' '}
                      {format(new Date(period.end_date), 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Locked on {format(new Date(period.locked_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnlockPeriod(period.id)}
                  >
                    <Unlock className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
