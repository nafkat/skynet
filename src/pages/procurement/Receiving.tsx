import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Search, 
  Loader2,
  Package,
  CheckCircle
} from 'lucide-react';

interface POLine {
  id: string;
  po_id: string;
  description: string;
  qty: number | null;
  uom: string | null;
  purchase_order?: {
    po_number: string;
    status: string;
  };
  received_total?: number;
}

export default function Receiving() {
  const { user } = useAuth();
  const { language } = useLanguage();
  
  const [poLines, setPOLines] = useState<POLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Receive modal
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedLine, setSelectedLine] = useState<POLine | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPOLines();
  }, []);

  const fetchPOLines = async () => {
    try {
      setLoading(true);
      
      // Get PO lines with their POs
      const { data: linesData, error: linesError } = await supabase
        .from('po_lines')
        .select(`
          *,
          purchase_order:purchase_orders(po_number, status)
        `)
        .order('po_id');

      if (linesError) throw linesError;

      // Get receiving records to calculate totals
      const { data: receivingData } = await supabase
        .from('receiving')
        .select('po_line_id, received_qty');

      // Calculate received totals per line
      const receivedTotals: Record<string, number> = {};
      receivingData?.forEach(r => {
        receivedTotals[r.po_line_id] = (receivedTotals[r.po_line_id] || 0) + (r.received_qty || 0);
      });

      const linesWithTotals = (linesData || []).map(line => ({
        ...line,
        received_total: receivedTotals[line.id] || 0,
      }));

      // Filter to only show lines from issued POs
      const issuedLines = linesWithTotals.filter(
        l => l.purchase_order?.status === 'issued' || l.purchase_order?.status === 'partially_received'
      );

      setPOLines(issuedLines);
    } catch (error) {
      console.error('Error fetching PO lines:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης' : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const openReceiveModal = (line: POLine) => {
    setSelectedLine(line);
    setReceiveQty('');
    setReceiveNotes('');
    setShowReceiveModal(true);
  };

  const handleReceive = async () => {
    if (!selectedLine || !receiveQty) {
      toast.error(language === 'el' ? 'Εισάγετε ποσότητα' : 'Enter quantity');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('receiving')
        .insert({
          po_line_id: selectedLine.id,
          received_qty: parseFloat(receiveQty),
          received_by: user?.id,
          notes: receiveNotes || null,
        });

      if (error) throw error;

      toast.success(language === 'el' ? 'Παραλαβή καταχωρήθηκε' : 'Receiving recorded');
      setShowReceiveModal(false);
      fetchPOLines();
    } catch (error: any) {
      console.error('Error recording receiving:', error);
      toast.error(error.message || (language === 'el' ? 'Αποτυχία' : 'Failed'));
    } finally {
      setSaving(false);
    }
  };

  const filteredLines = poLines.filter(line =>
    line.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    line.purchase_order?.po_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {language === 'el' ? 'Παραλαβή / Αποδοχή' : 'Receiving / Acceptance'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'el' 
            ? 'Καταχώρηση παραλαβών υλικών και αποδοχής υπηρεσιών' 
            : 'Record material deliveries and service acceptance'}
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'el' ? 'Αναζήτηση...' : 'Search...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {language === 'el' ? 'Γραμμές Εντολών προς Παραλαβή' : 'PO Lines Pending Receiving'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>{language === 'el' ? 'Περιγραφή' : 'Description'}</TableHead>
                <TableHead className="text-right">{language === 'el' ? 'Ποσ. Εντολής' : 'Ordered Qty'}</TableHead>
                <TableHead className="text-right">{language === 'el' ? 'Παρελήφθη' : 'Received'}</TableHead>
                <TableHead className="text-right">{language === 'el' ? 'Υπόλοιπο' : 'Remaining'}</TableHead>
                <TableHead className="text-right">{language === 'el' ? 'Ενέργειες' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {language === 'el' ? 'Δεν υπάρχουν εκκρεμείς παραλαβές' : 'No pending deliveries'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLines.map((line) => {
                  const remaining = (line.qty || 0) - (line.received_total || 0);
                  const isComplete = remaining <= 0;
                  
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">
                        {line.purchase_order?.po_number}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate">
                        {line.description}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.qty} {line.uom}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.received_total || 0} {line.uom}
                      </TableCell>
                      <TableCell className="text-right">
                        {isComplete ? (
                          <Badge className="bg-green-500/10 text-green-600 border-0">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {language === 'el' ? 'Ολοκληρώθηκε' : 'Complete'}
                          </Badge>
                        ) : (
                          <span className="font-medium">{remaining} {line.uom}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isComplete && (
                          <Button
                            size="sm"
                            onClick={() => openReceiveModal(line)}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            {language === 'el' ? 'Παραλαβή' : 'Receive'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Receive Modal */}
      <Dialog open={showReceiveModal} onOpenChange={setShowReceiveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'el' ? 'Καταχώρηση Παραλαβής' : 'Record Receiving'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedLine && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">{selectedLine.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === 'el' ? 'Αναμενόμενο' : 'Expected'}: {selectedLine.qty} {selectedLine.uom} | 
                  {language === 'el' ? ' Παρελήφθη' : ' Received'}: {selectedLine.received_total || 0} {selectedLine.uom}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{language === 'el' ? 'Ποσότητα' : 'Quantity'} *</Label>
                <Input
                  type="number"
                  value={receiveQty}
                  onChange={(e) => setReceiveQty(e.target.value)}
                  placeholder={(((selectedLine.qty || 0) - (selectedLine.received_total || 0))).toString()}
                />
              </div>

              <div className="space-y-2">
                <Label>{language === 'el' ? 'Σημειώσεις' : 'Notes'}</Label>
                <Textarea
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  rows={3}
                  placeholder={language === 'el' ? 'Σημειώσεις παραλαβής...' : 'Receiving notes...'}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiveModal(false)}>
              {language === 'el' ? 'Ακύρωση' : 'Cancel'}
            </Button>
            <Button onClick={handleReceive} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {language === 'el' ? 'Καταχώρηση' : 'Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
