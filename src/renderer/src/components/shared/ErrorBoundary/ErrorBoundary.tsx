import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@renderer/components/ui';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level React error boundary. Catches render-time crashes anywhere in the
 * tree, logs them (electron-log captures console.error from the renderer), and
 * shows a recoverable fallback instead of a blank white window.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer crash captured by ErrorBoundary', error, info.componentStack);
  }

  private readonly handleReload = (): void => {
    this.setState({ error: null });
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className={styles.wrapper}>
        <AlertTriangle size={48} className={styles.icon} />
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.message}>{this.state.error.message}</p>
        <Button onClick={this.handleReload}>Reload application</Button>
      </div>
    );
  }
}
