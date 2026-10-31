import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global ErrorBoundary — catches any unhandled render errors
 * and shows a user-friendly fallback instead of a white screen.
 * Bilingual support via localStorage preferred_language.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isHi = localStorage.getItem('preferred_language') === 'hi';

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="text-6xl">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900">
            {isHi ? 'कुछ गलत हो गया' : 'Something went wrong'}
          </h1>
          <p className="text-sm text-gray-500">
            {isHi
              ? 'एक अप्रत्याशित त्रुटि हुई। कृपया पुनः प्रयास करें।'
              : 'An unexpected error occurred. Please try again.'}
          </p>
          {this.state.error?.message && (
            <pre className="text-left text-[10px] leading-snug bg-gray-100 rounded-xl p-3 whitespace-pre-wrap break-words text-red-700">{this.state.error.message}</pre>
          )}
          <div className="flex flex-col gap-3">
            <button
              onClick={this.handleRetry}
              className="w-full px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {isHi ? 'पुनः प्रयास करें' : 'Try Again'}
            </button>
            <button
              onClick={this.handleGoHome}
              className="w-full px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              {isHi ? 'होम पर जाएं' : 'Go Home'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
