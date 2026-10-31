import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { timeAgo } from '@/components/test/ResultRow';
import api from '@/services/api';
import { AuthImage } from './AuthImage';

interface DiscussionMessage {
  id: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  author: { name: string; avatarUrl: string | null; isStaff: boolean };
  isMine: boolean;
  underReview: boolean;
}

interface Limits { maxChars: number; imagesPerDay: number; maxImageMb: number }

const POLL_MS = 10_000;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ERRORS: Record<string, { en: string; hi: string }> = {
  SLOW_DOWN: { en: 'Please wait a few seconds before the next message.', hi: 'अगला मैसेज भेजने से पहले कुछ सेकंड रुकें।' },
  TOO_LONG: { en: 'That message is too long.', hi: 'मैसेज बहुत लंबा है।' },
  EMPTY: { en: 'Write something or add an image.', hi: 'कुछ लिखें या तस्वीर जोड़ें।' },
  IMAGE_TOO_LARGE: { en: 'The image must be smaller than 2 MB.', hi: 'तस्वीर 2 MB से छोटी होनी चाहिए।' },
  IMAGE_TYPE: { en: 'Only JPG, PNG or WebP images are allowed.', hi: 'सिर्फ़ JPG, PNG या WebP तस्वीर चलेगी।' },
  IMAGE_INVALID: { en: 'That file is not a valid image.', hi: 'यह फ़ाइल सही तस्वीर नहीं है।' },
  IMAGE_LIMIT: { en: 'You can upload 4 images a day. You can still write messages.', hi: 'एक दिन में 4 तस्वीरें ही डाल सकते हैं। मैसेज लिख सकते हैं।' },
  DAILY_LIMIT: { en: "You have reached today's message limit.", hi: 'आज की मैसेज सीमा पूरी हो गई।' },
  NOT_ALLOWED: { en: 'You cannot post in this discussion.', hi: 'आप इस चर्चा में नहीं लिख सकते।' },
};

function errorText(err: unknown, isHi: boolean): string {
  const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
  const e = code ? ERRORS[code] : undefined;
  return e ? (isHi ? e.hi : e.en) : (isHi ? 'कुछ गड़बड़ हुई, फिर कोशिश करें।' : 'Something went wrong. Please try again.');
}

function Avatar({ name, url, staff }: { name: string; url: string | null; staff: boolean }) {
  return url ? (
    <img src={url} alt="" className="w-8 h-8 lg:w-9 lg:h-9 rounded-full object-cover shrink-0" />
  ) : (
    <span className={`w-8 h-8 lg:w-9 lg:h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-extrabold ${staff ? 'bg-secondary text-primary-800' : 'bg-primary-100 text-primary'}`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * A chat room for students. Used under a test result and on the Study-tab community page.
 * New messages arrive by polling every 10 seconds while the tab is open.
 */
export function DiscussionThread({ room, isHi }: { room: string; isHi: boolean }) {
  const { user } = useAuth();
  const staff = user?.role === 'admin' || user?.role === 'super_admin';
  const language = isHi ? 'hi' : 'en';

  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [imagesLeft, setImagesLeft] = useState<number | null>(null);
  const [limits, setLimits] = useState<Limits>({ maxChars: 600, imagesPerDay: 4, maxImageMb: 2 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());

  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // First page
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setMessages([]);
    api.get('/api/discussions', { params: { room } })
      .then((res) => {
        if (cancelled) return;
        const d = res.data.data;
        setMessages(d.messages);
        setHasMore(d.hasMore);
        setImagesLeft(d.imagesLeftToday);
        setLimits(d.limits);
        stickToBottom.current = true;
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [room]);

  useEffect(() => {
    if (stickToBottom.current) scrollToBottom();
  }, [messages]);

  // New messages from other students
  useEffect(() => {
    if (failed) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const last = messages[messages.length - 1];
      api.get('/api/discussions', { params: { room, ...(last ? { after: last.createdAt } : {}) } })
        .then((res) => {
          const fresh: DiscussionMessage[] = res.data.data.messages;
          if (fresh.length === 0) return;
          setMessages((prev) => {
            const have = new Set(prev.map((m) => m.id));
            const add = last ? fresh.filter((m) => !have.has(m.id)) : fresh;
            return add.length ? [...prev, ...add] : prev;
          });
        })
        .catch(() => {});
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [room, messages, failed]);

  const loadOlder = useCallback(async () => {
    const first = messages[0];
    if (!first) return;
    stickToBottom.current = false;
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const res = await api.get('/api/discussions', { params: { room, before: first.createdAt } });
      const d = res.data.data;
      setMessages((prev) => [...d.messages, ...prev]);
      setHasMore(d.hasMore);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
    } catch { /* keep what we have */ }
  }, [messages, room]);

  const pickImage = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) return setError(isHi ? ERRORS.IMAGE_TYPE.hi : ERRORS.IMAGE_TYPE.en);
    if (file.size >= limits.maxImageMb * 1024 * 1024) return setError(isHi ? ERRORS.IMAGE_TOO_LARGE.hi : ERRORS.IMAGE_TOO_LARGE.en);
    if (imagesLeft !== null && imagesLeft <= 0) return setError(isHi ? ERRORS.IMAGE_LIMIT.hi : ERRORS.IMAGE_LIMIT.en);
    setImage(file);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
  };

  const clearImage = () => {
    setImage(null);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return null; });
    if (fileRef.current) fileRef.current.value = '';
  };

  const send = async () => {
    const body = text.trim();
    if (sending || (!body && !image)) return;
    setSending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('room', room);
      fd.append('body', body);
      if (image) fd.append('image', image);
      const res = await api.post('/api/discussions', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const d = res.data.data;
      stickToBottom.current = true;
      setMessages((prev) => (prev.some((m) => m.id === d.message.id) ? prev : [...prev, d.message]));
      setImagesLeft(d.imagesLeftToday);
      setText('');
      clearImage();
    } catch (err) {
      setError(errorText(err, isHi));
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(isHi ? 'यह मैसेज हटाएं?' : 'Delete this message?')) return;
    try {
      await api.delete(`/api/discussions/${id}`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) { setError(errorText(err, isHi)); }
  };

  const report = async (id: string) => {
    if (!window.confirm(isHi ? 'इस मैसेज की रिपोर्ट करें?' : 'Report this message?')) return;
    try {
      await api.post(`/api/discussions/${id}/report`);
      setReported((prev) => new Set(prev).add(id));
    } catch (err) { setError(errorText(err, isHi)); }
  };

  return (
    <div className="space-y-3">
      <div
        ref={listRef}
        onScroll={() => {
          const el = listRef.current;
          if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="max-h-[60vh] min-h-[200px] overflow-y-auto rounded-2xl bg-primary-50/50 border border-primary-100 p-3 space-y-3"
      >
        {loading && <p className="text-center text-xs text-gray-400 py-10">{isHi ? 'लोड हो रहा है…' : 'Loading…'}</p>}
        {failed && !loading && <p className="text-center text-xs text-gray-500 py-10">{isHi ? 'चर्चा लोड नहीं हो सकी' : 'Could not load the discussion'}</p>}
        {!loading && !failed && messages.length === 0 && (
          <div className="text-center py-10">
            <p className="text-3xl mb-1">💬</p>
            <p className="text-xs lg:text-sm text-gray-500">{isHi ? 'अभी कोई मैसेज नहीं। सबसे पहले आप लिखें!' : 'No messages yet. Be the first to write!'}</p>
          </div>
        )}
        {hasMore && (
          <div className="text-center">
            <button type="button" onClick={loadOlder} className="p-chip">{isHi ? 'पुराने मैसेज देखें' : 'Show older messages'}</button>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.isMine ? 'flex-row-reverse' : ''}`}>
            <Avatar name={m.author.name} url={m.author.avatarUrl} staff={m.author.isStaff} />
            <div className={`max-w-[82%] ${m.isMine ? 'items-end' : 'items-start'} flex flex-col`}>
              <p className="text-[10px] lg:text-xs text-gray-400 mb-0.5">
                <span className={`font-bold ${m.author.isStaff ? 'text-secondary-700' : 'text-primary-400'}`}>{m.isMine ? (isHi ? 'आप' : 'You') : m.author.name}{m.author.isStaff && ' ✓'}</span>
                {' · '}{timeAgo(m.createdAt, language)}
              </p>
              <div className={`rounded-2xl px-3 py-2 ${m.isMine ? 'bg-secondary-100 text-primary-800 rounded-tr-md' : 'bg-white border border-primary-100 text-gray-800 rounded-tl-md'}`}>
                {m.imageUrl && (
                  <button type="button" onClick={() => setZoom(m.imageUrl)} className="block mb-1.5">
                    <AuthImage src={m.imageUrl} alt={isHi ? 'साझा की गई तस्वीर' : 'Shared image'} loading="lazy" className="max-h-52 rounded-xl object-contain bg-primary-50" />
                  </button>
                )}
                {m.body && <p className="text-[13px] lg:text-sm leading-snug whitespace-pre-wrap break-words">{m.body}</p>}
              </div>
              <div className="mt-0.5 flex gap-3 text-[10px] lg:text-xs text-gray-400">
                {m.underReview && <span className="text-accent-500 font-semibold">{isHi ? 'समीक्षा में, दूसरों को नहीं दिख रहा' : 'Under review, hidden from others'}</span>}
                {(m.isMine || staff) && <button type="button" onClick={() => remove(m.id)} className="hover:text-accent-500">🗑 {isHi ? 'हटाएं' : 'Delete'}</button>}
                {!m.isMine && (reported.has(m.id)
                  ? <span>{isHi ? 'रिपोर्ट हो गई' : 'Reported'}</span>
                  : <button type="button" onClick={() => report(m.id)} className="hover:text-accent-500">⚑ {isHi ? 'रिपोर्ट' : 'Report'}</button>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="p-card p-3 space-y-2">
        {preview && (
          <div className="relative inline-block">
            <img src={preview} alt="" className="h-20 rounded-xl border border-primary-100 object-cover" />
            <button type="button" onClick={clearImage} aria-label={isHi ? 'तस्वीर हटाएं' : 'Remove image'} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold">×</button>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, limits.maxChars))}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }}
          rows={2}
          maxLength={limits.maxChars}
          placeholder={isHi ? 'अपना सवाल या जवाब लिखें…' : 'Write your question or answer…'}
          className="w-full resize-none rounded-xl border border-primary-100 bg-white px-3 py-2 text-[13px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        />
        {error && <p role="alert" className="text-xs lg:text-sm text-accent-600">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={imagesLeft !== null && imagesLeft <= 0}
              className="p-btn-ghost !px-3 disabled:opacity-40"
            >
              🖼 {isHi ? 'तस्वीर' : 'Photo'}
            </button>
            <span className="text-[10px] lg:text-xs text-gray-400 truncate">
              {imagesLeft !== null && (isHi ? `आज ${imagesLeft}/${limits.imagesPerDay} तस्वीरें बाकी · 2 MB तक` : `${imagesLeft}/${limits.imagesPerDay} photos left today · up to 2 MB`)}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] lg:text-xs text-gray-300 tabular-nums">{text.length}/{limits.maxChars}</span>
            <button type="button" onClick={() => void send()} disabled={sending || (!text.trim() && !image)} className="p-btn !px-5">
              {sending ? '…' : (isHi ? 'भेजें' : 'Send')}
            </button>
          </div>
        </div>
        <p className="text-[10px] lg:text-xs text-gray-400 leading-snug">
          {isHi ? 'सम्मान से बात करें। स्पैम, गाली-गलौज और निजी जानकारी (फ़ोन नंबर, पता) न डालें।' : 'Be respectful. No spam, abuse or personal details (phone numbers, addresses).'}
        </p>
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" onClick={() => setZoom(null)} role="dialog" aria-modal="true">
          <AuthImage src={zoom} alt={isHi ? 'तस्वीर' : 'Image'} className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
