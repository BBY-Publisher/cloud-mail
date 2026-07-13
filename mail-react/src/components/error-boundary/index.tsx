import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopy = async () => {
    const { error } = this.state;
    if (!error) return;
    try {
      await navigator.clipboard.writeText(`${error.name}: ${error.message}\n${error.stack ?? ''}`);
    } catch {
      // clipboard may be unavailable in some contexts
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6">
        <div className="flex max-w-[480px] flex-col items-center gap-3 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <Icon icon="lucide:triangle-alert" width="20" height="20" />
          </span>
          <div className="text-h3 text-foreground">Something went wrong</div>
          <div className="text-[12px] text-muted-foreground">
            {error.message || 'An unexpected error occurred. Try reloading the page.'}
          </div>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" size="sm" onClick={this.handleCopy}>
              <Icon icon="lucide:copy" width="14" height="14" />
              Copy details
            </Button>
            <Button size="sm" onClick={this.handleReload}>
              <Icon icon="lucide:refresh-cw" width="14" height="14" />
              Reload
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;