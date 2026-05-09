import { Shield, Clock, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useState } from 'react';
import { getDailyWallpaper } from '@/hooks/useWallpaper';
import { generateDeviceFingerprint } from '@/utils/deviceFingerprint';
import { toast } from 'sonner';

const DevicePending = () => {
  const { language } = useLanguage();
  const [checking, setChecking] = useState(false);
  const wallpaperUrl = getDailyWallpaper();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const { fingerprint } = await generateDeviceFingerprint();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        await supabase.auth.signOut();
        window.location.href = '/';
        return;
      }
      const { data } = await supabase
        .from('trusted_devices')
        .select('status')
        .eq('user_id', user.id)
        .eq('device_fingerprint', fingerprint)
        .maybeSingle();

      if (data?.status === 'approved') {
        window.location.href = '/home';
      } else if (data?.status === 'blocked') {
        toast.error(language === 'el' ? 'Η συσκευή σας έχει αποκλειστεί' : 'Your device has been blocked');
      } else {
        toast.info(language === 'el' ? 'Ακόμα σε αναμονή έγκρισης' : 'Still awaiting approval');
      }
    } catch (error) {
      toast.error(language === 'el' ? 'Σφάλμα ελέγχου' : 'Check error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-4"
      style={{
        backgroundImage: `url(${wallpaperUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/60 z-0" />

      <div className="relative z-10 w-full max-w-md bg-card/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 space-y-6 animate-fade-in">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-8 w-8 text-primary" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {language === 'el' ? 'Αναμονή Έγκρισης' : 'Awaiting Approval'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'el'
              ? 'Η συσκευή σας δεν έχει εγκριθεί ακόμα. Ο διαχειριστής θα επαληθεύσει την πρόσβασή σας σύντομα.'
              : 'This device has not been approved yet. The administrator will verify your access shortly.'}
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {language === 'el'
                ? 'Αυτή η συσκευή αναγνωρίστηκε ως νέα. Για λόγους ασφαλείας, απαιτείται έγκριση διαχειριστή.'
                : 'This device was recognized as new. For security reasons, admin approval is required.'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Button onClick={handleCheckStatus} disabled={checking} className="w-full">
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            {language === 'el' ? 'Έλεγχος Κατάστασης' : 'Check Status'}
          </Button>
          <Button onClick={handleSignOut} variant="outline" className="w-full">
            <LogOut className="h-4 w-4" />
            {language === 'el' ? 'Αποσύνδεση' : 'Sign Out'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DevicePending;
