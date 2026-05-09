import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Shield, ShieldCheck, ShieldX, Monitor,
  Clock, Search, RefreshCw, CheckCircle, XCircle
} from 'lucide-react';

interface TrustedDevice {
  id: string;
  user_id: string;
  device_fingerprint: string;
  device_name: string;
  ip_address: string | null;
  status: 'pending' | 'approved' | 'blocked';
  first_seen_at: string;
  last_seen_at: string;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  profiles?: {
    full_name: string | null;
    display_name: string | null;
  };
}

const AdminTrustedDevices = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'blocked'>('all');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const { data: devicesData, error } = await supabase
        .from('trusted_devices')
        .select('*')
        .order('first_seen_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately (no FK relationship)
      const userIds = Array.from(new Set((devicesData || []).map((d) => d.user_id)));
      let profilesMap: Record<string, { full_name: string | null; display_name: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, display_name')
          .in('user_id', userIds);
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = { full_name: p.full_name, display_name: p.display_name };
          return acc;
        }, {} as Record<string, { full_name: string | null; display_name: string | null }>);
      }

      const merged = (devicesData || []).map((d) => ({
        ...d,
        profiles: profilesMap[d.user_id],
      })) as TrustedDevice[];

      setDevices(merged);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast.error(language === 'el' ? 'Σφάλμα φόρτωσης συσκευών' : 'Error loading devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();

    const channel = supabase
      .channel('trusted_devices_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trusted_devices' }, () => {
        fetchDevices();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('trusted_devices')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', deviceId);

      if (error) throw error;
      toast.success(language === 'el' ? 'Συσκευή εγκρίθηκε' : 'Device approved');
      fetchDevices();
    } catch (error) {
      toast.error(language === 'el' ? 'Σφάλμα έγκρισης' : 'Approval error');
    }
  };

  const handleBlock = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('trusted_devices')
        .update({ status: 'blocked' })
        .eq('id', deviceId);

      if (error) throw error;
      toast.success(language === 'el' ? 'Συσκευή αποκλείστηκε' : 'Device blocked');
      fetchDevices();
    } catch (error) {
      toast.error(language === 'el' ? 'Σφάλμα αποκλεισμού' : 'Block error');
    }
  };

  const handleRevoke = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('trusted_devices')
        .update({ status: 'pending' })
        .eq('id', deviceId);

      if (error) throw error;
      toast.success(language === 'el' ? 'Έγκριση ανακλήθηκε' : 'Approval revoked');
      fetchDevices();
    } catch (error) {
      toast.error(language === 'el' ? 'Σφάλμα ανάκλησης' : 'Revoke error');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'pending')
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
          <Clock className="h-3 w-3 mr-1" />
          {language === 'el' ? 'Αναμονή' : 'Pending'}
        </Badge>
      );
    if (status === 'approved')
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
          <ShieldCheck className="h-3 w-3 mr-1" />
          {language === 'el' ? 'Εγκεκριμένη' : 'Approved'}
        </Badge>
      );
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">
        <ShieldX className="h-3 w-3 mr-1" />
        {language === 'el' ? 'Αποκλεισμένη' : 'Blocked'}
      </Badge>
    );
  };

  const pendingCount = devices.filter((d) => d.status === 'pending').length;

  const filtered = devices.filter((d) => {
    const matchesStatus = filterStatus === 'all' || d.status === filterStatus;
    const userName = d.profiles?.full_name || d.profiles?.display_name || '';
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      d.device_name.toLowerCase().includes(q) ||
      userName.toLowerCase().includes(q) ||
      (d.ip_address || '').includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card/95 backdrop-blur-md p-6 rounded-lg shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            {language === 'el' ? 'Αξιόπιστες Συσκευές' : 'Trusted Devices'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === 'el'
              ? 'Διαχείριση πρόσβασης συσκευών χρηστών'
              : 'Manage user device access'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="bg-yellow-500 text-white hover:bg-yellow-500">
              <Clock className="h-3 w-3 mr-1" />
              {pendingCount} {language === 'el' ? 'σε αναμονή' : 'pending'}
            </Badge>
          )}
          <Button variant="outline" onClick={fetchDevices} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {language === 'el' ? 'Ανανέωση' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: language === 'el' ? 'Σε Αναμονή' : 'Pending',
            count: devices.filter((d) => d.status === 'pending').length,
            color: 'text-yellow-600',
            icon: Clock,
          },
          {
            label: language === 'el' ? 'Εγκεκριμένες' : 'Approved',
            count: devices.filter((d) => d.status === 'approved').length,
            color: 'text-green-600',
            icon: ShieldCheck,
          },
          {
            label: language === 'el' ? 'Αποκλεισμένες' : 'Blocked',
            count: devices.filter((d) => d.status === 'blocked').length,
            color: 'text-red-600',
            icon: ShieldX,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-4 bg-card/95 backdrop-blur-md p-4 rounded-lg shadow-sm"
          >
            <stat.icon className={`h-8 w-8 ${stat.color}`} />
            <div>
              <p className="text-2xl font-bold tabular-nums">{stat.count}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-card/95 backdrop-blur-md p-4 rounded-lg shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              language === 'el'
                ? 'Αναζήτηση συσκευής, χρήστη ή IP...'
                : 'Search device, user, or IP...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'approved', 'blocked'] as const).map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(status)}
            >
              {status === 'all'
                ? language === 'el'
                  ? 'Όλες'
                  : 'All'
                : status === 'pending'
                ? language === 'el'
                  ? 'Αναμονή'
                  : 'Pending'
                : status === 'approved'
                ? language === 'el'
                  ? 'Εγκεκριμένες'
                  : 'Approved'
                : language === 'el'
                ? 'Αποκλεισμένες'
                : 'Blocked'}
            </Button>
          ))}
        </div>
      </div>

      {/* Devices List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-card/95 backdrop-blur-md p-8 rounded-lg text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" />
            {language === 'el' ? 'Φόρτωση...' : 'Loading...'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card/95 backdrop-blur-md p-8 rounded-lg text-center text-muted-foreground">
            <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{language === 'el' ? 'Δεν βρέθηκαν συσκευές' : 'No devices found'}</p>
          </div>
        ) : (
          filtered.map((device) => (
            <div
              key={device.id}
              className="bg-card/95 backdrop-blur-md p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center gap-4"
            >
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Monitor className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold truncate">{device.device_name}</p>
                    {getStatusBadge(device.status)}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {language === 'el' ? 'Χρήστης: ' : 'User: '}
                    <span className="font-medium text-foreground">
                      {device.profiles?.full_name ||
                        device.profiles?.display_name ||
                        device.user_id.slice(0, 8)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'el' ? 'Πρώτη είσοδος: ' : 'First seen: '}
                    {formatDate(device.first_seen_at)}
                    {device.ip_address && ` · IP: ${device.ip_address}`}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 shrink-0">
                {device.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(device.id)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {language === 'el' ? 'Έγκριση' : 'Approve'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleBlock(device.id)}>
                      <XCircle className="h-4 w-4" />
                      {language === 'el' ? 'Αποκλεισμός' : 'Block'}
                    </Button>
                  </>
                )}
                {device.status === 'approved' && (
                  <Button size="sm" variant="outline" onClick={() => handleRevoke(device.id)}>
                    <ShieldX className="h-4 w-4" />
                    {language === 'el' ? 'Ανάκληση' : 'Revoke'}
                  </Button>
                )}
                {device.status === 'blocked' && (
                  <Button
                    size="sm"
                    onClick={() => handleApprove(device.id)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {language === 'el' ? 'Έγκριση' : 'Approve'}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="text-xs text-muted-foreground text-center">
        {language === 'el' ? 'Τελευταία ανανέωση: ' : 'Last refresh: '}
        {lastRefresh.toLocaleTimeString('el-GR')}
      </div>
    </div>
  );
};

export default AdminTrustedDevices;
