import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * Landing page for Google's redirect (?code=...). Exchanges the code for a
 * session, then routes by nextStep exactly like the OTP flow.
 */
export function GoogleCallbackPage() {
  const { completeGoogleLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [failed, setFailed] = useState(false);
  // A Google code is single-use and StrictMode runs effects twice in dev.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get('code');
    if (!code || params.get('error')) {
      setFailed(true);
      return;
    }

    completeGoogleLogin(code)
      .then((response) => {
        switch (response.nextStep) {
          case 'exam_selection':
          case 'profile_setup':
            navigate('/onboarding', { replace: true });
            break;
          case 'account_link':
            navigate('/onboarding', {
              replace: true,
              state: { linkingInfo: response.linkingInfo },
            });
            break;
          default:
            navigate('/dashboard', { replace: true });
        }
      })
      .catch(() => setFailed(true));
  }, [completeGoogleLogin, navigate, params]);

  if (failed) {
    return (
      <div className="text-center space-y-3 p-6">
        <p className="text-red-600">Google login nahi ho paya. Dobara try karein.</p>
        <Link to="/login" className="underline">
          Login page par jayein
        </Link>
      </div>
    );
  }

  return <p className="text-center p-6">Google se login ho raha hai…</p>;
}
