import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, Anchor } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const { t, language, setLanguage } = useLanguage();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error(t('auth.invalidCredentials'));
    } else {
      toast.success(t('auth.welcome'));
    }

    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('auth.accountCreated'));
    }

    setIsLoading(false);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'el' : 'en');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Language toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 right-4"
        onClick={toggleLanguage}
      >
        <Globe className="h-5 w-5" />
      </Button>

      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
            <Anchor className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('auth.shipyardSystem')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('auth.welcome')}
          </p>
        </div>

        {/* Auth Forms */}
        <div className="card-elevated p-8">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">{t('auth.signIn')}</TabsTrigger>
              <TabsTrigger value="signup">{t('auth.signUp')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-sm font-medium">
                    {t('auth.email')}
                  </Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-tablet"
                    placeholder="name@shipyard.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="text-sm font-medium">
                    {t('auth.password')}
                  </Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-tablet"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full btn-tablet"
                  disabled={isLoading}
                >
                  {isLoading ? t('auth.signingIn') : t('auth.signIn')}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-medium">
                    {t('auth.email')}
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-tablet"
                    placeholder="name@shipyard.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-medium">
                    {t('auth.password')}
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-tablet"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full btn-tablet"
                  disabled={isLoading}
                >
                  {isLoading ? t('common.loading') : t('auth.signUp')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
