import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  FileText, 
  Download,
  FileSpreadsheet,
  Loader2
} from 'lucide-react';

export default function ProcurementReports() {
  const { language } = useLanguage();
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExportCSV = async (reportType: string) => {
    try {
      setExporting(reportType);
      
      let data: any[] = [];
      let filename = '';

      if (reportType === 'pr') {
        const { data: prData, error } = await supabase
          .from('purchase_requests')
          .select(`
            pr_number,
            type,
            description,
            qty,
            uom,
            priority,
            status,
            created_at,
            project:projects(project_code, project_name)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (prData || []).map(pr => ({
          'PR Number': pr.pr_number,
          'Type': pr.type,
          'Project': pr.project?.project_code,
          'Description': pr.description,
          'Qty': pr.qty,
          'UOM': pr.uom,
          'Priority': pr.priority,
          'Status': pr.status,
          'Created': pr.created_at,
        }));
        filename = 'purchase_requests.csv';
      } else if (reportType === 'po') {
        const { data: poData, error } = await supabase
          .from('purchase_orders')
          .select(`
            po_number,
            status,
            created_at,
            purchase_request:purchase_requests(pr_number, description),
            supplier:suppliers(name)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (poData || []).map(po => ({
          'PO Number': po.po_number,
          'PR Number': po.purchase_request?.pr_number,
          'Supplier': po.supplier?.name,
          'Description': po.purchase_request?.description,
          'Status': po.status,
          'Created': po.created_at,
        }));
        filename = 'purchase_orders.csv';
      } else if (reportType === 'suppliers') {
        const { data: suppData, error } = await supabase
          .from('suppliers')
          .select('*')
          .order('name');

        if (error) throw error;
        data = (suppData || []).map(s => ({
          'Name': s.name,
          'Contact': s.contact_name,
          'Email': s.email,
          'Phone': s.phone,
          'Country': s.country,
          'Category': s.category,
        }));
        filename = 'suppliers.csv';
      }

      // Convert to CSV
      if (data.length === 0) {
        toast.info(language === 'el' ? 'Δεν υπάρχουν δεδομένα' : 'No data available');
        return;
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();

      toast.success(language === 'el' ? 'Εξαγωγή ολοκληρώθηκε' : 'Export completed');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(language === 'el' ? 'Αποτυχία εξαγωγής' : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const reports = [
    {
      id: 'pr',
      title: language === 'el' ? 'Αιτήματα Αγορών' : 'Purchase Requests',
      description: language === 'el' 
        ? 'Λίστα όλων των αιτημάτων με κατάσταση και έργο' 
        : 'List of all requests with status and project',
      icon: FileText,
    },
    {
      id: 'po',
      title: language === 'el' ? 'Εντολές Αγοράς' : 'Purchase Orders',
      description: language === 'el' 
        ? 'Λίστα εντολών με προμηθευτές και κατάσταση' 
        : 'List of orders with suppliers and status',
      icon: FileSpreadsheet,
    },
    {
      id: 'suppliers',
      title: language === 'el' ? 'Προμηθευτές' : 'Suppliers',
      description: language === 'el' 
        ? 'Κατάλογος προμηθευτών με στοιχεία επικοινωνίας' 
        : 'Supplier directory with contact details',
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {language === 'el' ? 'Αναφορές' : 'Reports'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'el' 
            ? 'Εξαγωγή αναφορών προμηθειών' 
            : 'Export procurement reports'}
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-primary/10">
                  <report.icon className="h-6 w-6 text-primary" />
                </div>
              </div>
              <CardTitle className="text-lg">{report.title}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={() => handleExportCSV(report.id)}
                disabled={exporting === report.id}
              >
                {exporting === report.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {language === 'el' ? 'Εξαγωγή CSV' : 'Export CSV'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
