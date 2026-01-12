import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

        {/* Login Form */}
        <div className="card-elevated p-8">
          <form onSubmit={handleSignIn} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                {t('auth.email')}
              </Label>
              <Input
                id="email"
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
              <Label htmlFor="password" className="text-sm font-medium">
                {t('auth.password')}
              </Label>
              <Input
                id="password"
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
        </div>
      </div>
    </div>
  );
}
