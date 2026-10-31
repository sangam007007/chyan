import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; onRetry?: () => void }
interface State { error: Error | null }

/**
 * Catches a render crash inside one screen and shows what went wrong (plus Retry) instead of the
 * generic router error page, so a problem on a student's phone can be read and reported.
 */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PageErrorBoundary]', error, info.componentStack);
  }

  retry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const hi = localStorage.getItem('preferred_language') === 'hi';
    return (
      <div className="px-4 py-16 text-center space-y-4">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-base font-bold text-primary">{hi ? 'यह पेज नहीं खुल सका' : 'This page could not open'}</h1>
        <p className="text-xs text-gray-500">{hi ? 'नीचे लिखी त्रुटि हमें भेज दें:' : 'Please share the error below:'}</p>
        <pre className="text-left text-[10px] leading-snug bg-primary-50 border border-primary-100 rounded-2xl p-3 whitespace-pre-wrap break-words text-accent-700">
          {String(this.state.error.message || this.state.error)}
        </pre>
        <div className="flex gap-2 justify-center">
          <button onClick={this.retry} className="p-btn">{hi ? 'फिर कोशिश करें' : 'Try again'}</button>
          <button onClick={() => window.location.reload()} className="p-btn-ghost">{hi ? 'रीलोड' : 'Reload'}</button>
        </div>
      </div>
    );
  }
}
