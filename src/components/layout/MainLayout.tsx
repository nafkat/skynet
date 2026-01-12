import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-72 p-8">
        <div className="max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
