import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n';
import { canPromptInstall, isIosSafari, isStandalone, promptInstall, subscribeInstall } from '@/services/installPrompt';

/**
 * "Install the app" button. Android / desktop Chrome: opens the browser's install prompt.
 * iPhone Safari: shows the manual steps (Share → Add to Home Screen). Hidden once the app is installed.
 * `card` is the wide version for Profile, `pill` the small one for the landing page.
 */
export function InstallApp({ variant = 'card' }: { variant?: 'card' | 'pill' }) {
  const { language } = useTranslation();
  const isHi = language === 'hi';
  const [, force] = useState(0);
  const [steps, setSteps] = useState(false);

  useEffect(() => subscribeInstall(() => force((n) => n + 1)), []);

  if (isStandalone()) return null;
  const ios = isIosSafari();
  if (!canPromptInstall() && !ios) return null;

  const onClick = async () => {
    if (canPromptInstall()) await promptInstall();
    else setSteps(true);
  };

  return (
    <>
      {variant === 'pill' ? (
        <button type="button" onClick={onClick} className="px-3 py-2 rounded-full bg-secondary text-primary-800 text-xs font-extrabold active:scale-95 transition-transform">
          📲 {isHi ? 'ऐप इंस्टॉल करें' : 'Install app'}
        </button>
      ) : (
        <button type="button" onClick={onClick} className="w-full p-card p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
          <span className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-secondary-100 to-secondary-300 flex items-center justify-center text-xl">📲</span>
          <span className="flex-1 min-w-0">
            <span className="block p-title">{isHi ? 'ऐप इंस्टॉल करें' : 'Install the app'}</span>
            <span className="block p-sub mt-0.5">{isHi ? 'होम स्क्रीन पर Chayan का आइकन, पूरी स्क्रीन में खुलेगा।' : 'Chayan icon on your home screen, opens full screen.'}</span>
          </span>
          <span className="text-primary-300 text-lg">›</span>
        </button>
      )}

      {steps && (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setSteps(false)} role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-extrabold text-primary">📲 {isHi ? 'iPhone पर ऐप जोड़ें' : 'Add the app on iPhone'}</p>
            <ol className="mt-3 space-y-2 text-sm text-gray-700 list-decimal pl-5">
              <li>{isHi ? 'Safari में नीचे बीच का Share बटन (⬆️) दबाएं।' : 'In Safari, tap the Share button (⬆️) at the bottom.'}</li>
              <li>{isHi ? '"Add to Home Screen" चुनें।' : 'Choose "Add to Home Screen".'}</li>
              <li>{isHi ? 'ऊपर "Add" दबाएं। बस, Chayan आपकी होम स्क्रीन पर आ जाएगा।' : 'Tap "Add". Chayan now sits on your home screen.'}</li>
            </ol>
            <button type="button" onClick={() => setSteps(false)} className="mt-4 w-full p-btn-navy py-2.5">{isHi ? 'ठीक है' : 'Got it'}</button>
          </div>
        </div>
      )}
    </>
  );
}
