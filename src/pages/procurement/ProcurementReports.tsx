import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
      
      let data: Record<string, unknown>[] = [];
      let filename = '';

      if (reportType === 'ro') {
        const { data: roData, error } = await supabase
          .from('request_offers')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (roData || []).map(ro => ({
          'RO Number': ro.ro_number,
          'Type': ro.type,
          'Title': ro.title,
          'Description': ro.description,
          'Qty': ro.qty,
          'UOM': ro.uom,
          'Priority': ro.priority,
          'Status': ro.status,
          'Project': ro.project_name,
          'Needed By': ro.needed_by,
          'Created': ro.created_at,
        }));
        filename = 'request_offers.csv';
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
          'Type': s.supplier_type,
          'VAT': s.vat_number,
          'Preferred': s.is_preferred ? 'Yes' : 'No',
        }));
        filename = 'suppliers.csv';
      }

      if (data.length === 0) {
        toast.info(language === 'el' ? 'Δεν υπάρχουν δεδομένα' : 'No data available');
        return;
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
      ].join('\n');

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
      id: 'ro',
      title: language === 'el' ? 'Αιτήματα Προσφορών' : 'Request Offers',
      description: language === 'el' 
        ? 'Λίστα όλων των αιτημάτων προσφορών με κατάσταση' 
        : 'List of all request offers with status',
      icon: FileText,
    },
    {
      id: 'suppliers',
      title: language === 'el' ? 'Προμηθευτές' : 'Suppliers',
      description: language === 'el' 
        ? 'Κατάλογος προμηθευτών με στοιχεία επικοινωνίας' 
        : 'Supplier directory with contact details',
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
