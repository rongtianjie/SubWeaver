import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Header />
      <main className="max-w-[1800px] mx-auto px-4 lg:px-8 xl:px-12 py-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
