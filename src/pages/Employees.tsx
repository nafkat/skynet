import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
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
import { Plus, Search, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Specialty {
  id: string;
  name_en: string;
  name_el: string;
  code: string;
}

interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  specialty_id: string;
  status: 'active' | 'inactive';
  regular_hourly_rate: number;
  overtime_hourly_rate: number;
  regular_start_time: string;
  regular_end_time: string;
  specialties?: Specialty;
}

export default function Employees() {
  const { t, language } = useLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [regularRate, setRegularRate] = useState('0');
  const [overtimeRate, setOvertimeRate] = useState('0');
  const [regularStart, setRegularStart] = useState('07:00');
  const [regularEnd, setRegularEnd] = useState('14:00');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: specialtiesData } = await supabase
        .from('specialties')
        .select('*')
        .order('code');

      const { data: employeesData } = await supabase
        .from('employees')
        .select(`
          *,
          specialties (id, name_en, name_el, code)
        `)
        .order('employee_code');

      setSpecialties(specialtiesData || []);
      setEmployees((employeesData as Employee[]) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setSpecialtyId('');
    setStatus('active');
    setRegularRate('0');
    setOvertimeRate('0');
    setRegularStart('07:00');
    setRegularEnd('14:00');
    setEditingEmployee(null);
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    setFirstName(employee.first_name);
    setLastName(employee.last_name);
    setSpecialtyId(employee.specialty_id);
    setStatus(employee.status);
    setRegularRate(employee.regular_hourly_rate.toString());
    setOvertimeRate(employee.overtime_hourly_rate.toString());
    setRegularStart(employee.regular_start_time.slice(0, 5));
    setRegularEnd(employee.regular_end_time.slice(0, 5));
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName || !lastName || !specialtyId) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const employeeData = {
        first_name: firstName,
        last_name: lastName,
        specialty_id: specialtyId,
        status,
        regular_hourly_rate: parseFloat(regularRate) || 0,
        overtime_hourly_rate: parseFloat(overtimeRate) || 0,
        regular_start_time: regularStart,
        regular_end_time: regularEnd,
      };

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id);

        if (error) throw error;
        toast.success('Employee updated successfully');
      } else {
        const { error } = await supabase
          .from('employees')
          .insert([employeeData]);
        if (error) throw error;
        toast.success('Employee created successfully');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast.error(error.message || 'Error saving employee');
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employee_code.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getSpecialtyName = (specialty: Specialty | undefined) => {
    if (!specialty) return '';
    return language === 'el' ? specialty.name_el : specialty.name_en;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">{t('employees.title')}</h1>
            <p className="page-subtitle">
              {filteredEmployees.length} {t('employees.title').toLowerCase()}
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="btn-tablet">
                <Plus className="h-5 w-5 mr-2" />
                {t('employees.addNew')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingEmployee ? t('common.edit') : t('employees.addNew')}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('employees.firstName')}</Label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="input-tablet"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('employees.lastName')}</Label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="input-tablet"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('employees.specialty')}</Label>
                  <Select value={specialtyId} onValueChange={setSpecialtyId} disabled={!!editingEmployee}>
                    <SelectTrigger className="input-tablet">
                      <SelectValue placeholder={t('employees.specialty')} />
                    </SelectTrigger>
                    <SelectContent>
                      {specialties.map((spec) => (
                        <SelectItem key={spec.id} value={spec.id}>
                          {spec.code} - {getSpecialtyName(spec)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('common.status')}</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'inactive')}>
                    <SelectTrigger className="input-tablet">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t('common.active')}</SelectItem>
                      <SelectItem value="inactive">{t('common.inactive')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('employees.regularRate')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={regularRate}
                      onChange={(e) => setRegularRate(e.target.value)}
                      className="input-tablet"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('employees.overtimeRate')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={overtimeRate}
                      onChange={(e) => setOvertimeRate(e.target.value)}
                      className="input-tablet"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('employees.workSchedule')}</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="time"
                      value={regularStart}
                      onChange={(e) => setRegularStart(e.target.value)}
                      className="input-tablet"
                    />
                    <Input
                      type="time"
                      value={regularEnd}
                      onChange={(e) => setRegularEnd(e.target.value)}
                      className="input-tablet"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" className="flex-1">
                    {t('common.save')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-tablet pl-12"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 input-tablet">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="active">{t('common.active')}</SelectItem>
            <SelectItem value="inactive">{t('common.inactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Employees Table */}
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="table-cell text-left">{t('employees.code')}</th>
                <th className="table-cell text-left">{t('employees.firstName')}</th>
                <th className="table-cell text-left">{t('employees.lastName')}</th>
                <th className="table-cell text-left">{t('employees.specialty')}</th>
                <th className="table-cell text-left">{t('employees.workSchedule')}</th>
                <th className="table-cell text-left">{t('common.status')}</th>
                <th className="table-cell text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="table-row">
                  <td className="table-cell font-mono">{employee.employee_code}</td>
                  <td className="table-cell">{employee.first_name}</td>
                  <td className="table-cell">{employee.last_name}</td>
                  <td className="table-cell">{getSpecialtyName(employee.specialties)}</td>
                  <td className="table-cell font-mono text-sm">
                    {employee.regular_start_time.slice(0, 5)} - {employee.regular_end_time.slice(0, 5)}
                  </td>
                  <td className="table-cell">
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
                      employee.status === 'active' ? 'badge-active' : 'badge-inactive'
                    )}>
                      {employee.status === 'active' ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(employee)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredEmployees.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {t('common.noData')}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
