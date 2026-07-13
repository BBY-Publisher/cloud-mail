import { useEffect, useState } from 'react';
import { useUiStore } from '@/store/ui';
import { cn } from '@/lib/utils';
import Aside from './aside';
import Header from './header';
import Main from './main';
import Writer from './write';

export default function AppLayout() {
  const asideShow = useUiStore((s) => s.asideShow);
  const setAsideShow = useUiStore((s) => s.setAsideShow);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1025 : false,
  );

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 1025);
      setAsideShow(window.innerWidth > 1024);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [setAsideShow]);

  return (
    <div className="fixed inset-0 flex h-full w-full overflow-hidden bg-background text-foreground">
      <aside
        className={cn(
          'transition-transform duration-200 ease-expo',
          isMobile && 'fixed left-0 top-0 z-30 h-full',
          asideShow ? 'translate-x-0' : 'max-lg:-translate-x-full max-lg:fixed',
        )}
      >
        <Aside />
      </aside>

      {isMobile && asideShow && (
        <div
          className="fixed inset-0 z-20 bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-200"
          onClick={() => setAsideShow(false)}
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="h-12 shrink-0 border-b border-border bg-background">
          <Header />
        </header>
        <Main />
      </div>

      <Writer />
    </div>
  );
}