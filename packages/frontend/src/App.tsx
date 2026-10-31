import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { I18nProvider } from '@/i18n';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { router } from '@/router';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <I18nProvider>
          <RouterProvider router={router} />
        </I18nProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
