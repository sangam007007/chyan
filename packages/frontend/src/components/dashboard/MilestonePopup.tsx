import { useEffect, useRef, useCallback } from 'react';

interface MilestonePopupProps {
  streak: number;
  language: 'hi' | 'en';
  onClose: () => void;
}

/**
 * MilestonePopup - Congratulatory overlay shown when user reaches a streak milestone.
 * Implements focus trap, Escape key dismissal, and overlay click dismissal.
 * Requirements: 5.1, 5.3, 5.4
 */
export function MilestonePopup({ streak, language, onClose }: MilestonePopupProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Focus trap: get all focusable elements within the popup
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!popupRef.current) return [];
    const elements = popupRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return Array.from(elements);
  }, []);

  // Handle Escape key dismissal and focus trap (Tab/Shift+Tab cycling)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: if focus is on first element, wrap to last
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if focus is on last element, wrap to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, getFocusableElements]);

  // On mount, move focus into the popup
  useEffect(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, [getFocusableElements]);

  // Handle overlay click (dismiss when clicking outside popup)
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={language === 'hi' ? 'बधाई मिलस्टोन पॉपअप' : 'Congratulations milestone popup'}
    >
      <div
        ref={popupRef}
        className="bg-white rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl animate-bounce-in"
      >
        <div className="text-6xl mb-4">🔥</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {language === 'hi' ? 'बधाई हो! 🏆' : 'Congratulations! 🏆'}
        </h2>
        <p className="text-gray-600 mb-1">
          {language === 'hi'
            ? `आपने लगातार ${streak} दिन की स्ट्रीक हासिल की!`
            : `You've achieved a ${streak}-day streak!`}
        </p>
        <p className="text-sm text-gray-500 mb-6">
          {language === 'hi'
            ? 'आपकी मेहनत रंग लाएगी। ऐसे ही जारी रखें! 💪'
            : 'Your hard work will pay off. Keep going! 💪'}
        </p>
        <div className="flex items-center justify-center gap-1 mb-6">
          {Array.from({ length: Math.min(streak, 7) }).map((_, i) => (
            <span key={i} className="text-2xl">🔥</span>
          ))}
        </div>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
        >
          {language === 'hi' ? 'धन्यवाद! 🙏' : 'Thank You! 🙏'}
        </button>
      </div>
    </div>
  );
}
