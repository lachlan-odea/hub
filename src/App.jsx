import React, { useState, useEffect, useRef } from 'react';

const _getEnvKey = () => {
  try { const k = import.meta.env.VITE_GEMINI_API_KEY; if (k) return k; } catch (_) {}
  try { const k = process.env.REACT_APP_GEMINI_API_KEY; if (k) return k; } catch (_) {}
  return '';
};
const API_KEY = _getEnvKey();
const MODEL = 'gemini-2.5-flash';
const buildApiUrl = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

const DEFAULT_STYLE_SOURCES = [
  { id: 'cw-brand', label: 'CargoWise Brand Voice', url: '' },
  { id: 'cw-tone',  label: 'CargoWise Tone of Voice', url: '' },
];

const adCopySchema = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      style:          { type: 'STRING' },
      headline:       { type: 'STRING' },
      bodyCopy:       { type: 'STRING' },
      callToAction:   { type: 'STRING' },
      imageHero:      { type: 'STRING', description: 'Short punchy hero message to display large on the social image. Max 8 words.' },
      imageTagline:   { type: 'STRING', description: 'Supporting tagline displayed smaller beneath the hero on the image. 1–2 sentences.' },
      imageCta:       { type: 'STRING', description: 'Short CTA button text for the image overlay. Max 6 words, uppercase style.' },
    },
    required: ['style', 'headline', 'bodyCopy', 'callToAction', 'imageHero', 'imageTagline', 'imageCta'],
  },
};

const CONTENT_TYPES = [
  { label: 'LinkedIn Post (Short)',       value: 'LinkedIn Post (Executive Summary/Short Form)' },
  { label: 'Blog Post Outline',           value: 'Detailed Blog Post Outline (5 main sections)' },
  { label: 'Newsletter Article (Medium)', value: 'Newsletter Article (300–500 words)' },
  { label: 'Email Subject Lines & Body',  value: 'High-Converting Email Draft and 5 Subject Line Options' },
  { label: 'Whitepaper / eBook Section',  value: 'Detailed Draft of a Whitepaper Section (500–750 words)' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return await res.json();
      let body; try { body = await res.json(); } catch (_) { body = {}; }
      if (res.status === 429) {
        const exhausted = body?.error?.status === 'RESOURCE_EXHAUSTED' || body?.error?.message?.includes('quota');
        if (exhausted) throw new Error('API quota exhausted. Check your plan at ai.google.dev.');
        if (i < retries - 1) { await sleep(Math.pow(2, i) * 1000 + Math.random() * 500); continue; }
      }
      throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
    } catch (e) {
      const clean = e.message.startsWith('API quota') || e.message.startsWith('Request failed');
      if (clean || i >= retries - 1) throw e;
      await sleep(Math.pow(2, i) * 1000 + Math.random() * 500);
    }
  }
};

const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result.split(',')[1]);
  r.onerror = () => rej(new Error('Failed to read file'));
  r.readAsDataURL(file);
});

const fetchFileAsBase64 = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch style file: ${url} (${res.status})`);
  const blob = await res.blob();
  const mimeType = blob.type || (url.endsWith('.md') ? 'text/plain' : 'application/pdf');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ base64: reader.result.split(',')[1], mimeType });
    reader.onerror = () => reject(new Error('Failed to read fetched file'));
    reader.readAsDataURL(blob);
  });
};

// ── Shared UI ────────────────────────────────────────────────────────────────
const Label = ({ children }) => (
  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{children}</p>
);
const Input = (props) => (
  <input {...props} className="w-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white dark:focus:bg-gray-700 transition" />
);
const Textarea = (props) => (
  <textarea {...props} className="w-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white dark:focus:bg-gray-700 transition resize-none" />
);
const Select = ({ children, ...props }) => (
  <select {...props} className="w-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white dark:focus:bg-gray-700 transition">
    {children}
  </select>
);
const PrimaryBtn = ({ loading, loadingText, children, color = 'indigo', ...props }) => {
  const colors = { indigo: 'bg-indigo-600 hover:bg-indigo-700', green: 'bg-green-600 hover:bg-green-700', red: 'bg-red-600 hover:bg-red-700' };
  return (
    <button {...props} disabled={loading || props.disabled}
      className={`w-full ${colors[color]} text-white py-3 rounded-lg font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2`}>
      {loading && <Spinner />}
      {loading ? loadingText : children}
    </button>
  );
};
const Spinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);
const ErrorBox = ({ msg }) => msg ? (
  <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex gap-2">
    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    {msg}
  </div>
) : null;

const CopyBtn = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return (
    <button onClick={copy}
      className={`flex items-center gap-1 text-xs font-medium rounded-md px-2.5 py-1.5 border transition
        ${copied
          ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'}`}>
      {copied
        ? <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied</>
        : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>Copy</>}
    </button>
  );
};
const SendToGenBtn = ({ text, onClick }) => (
  <button onClick={() => onClick(text)}
    className="flex items-center gap-1 text-xs font-medium rounded-md px-2.5 py-1.5 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 transition">
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
    Send to Content Generator
  </button>
);
const Card = ({ children, accent }) => {
  const accents = { indigo: 'border-t-indigo-500', green: 'border-t-green-500', red: 'border-t-red-500' };
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden ${accent ? 'border-t-2 ' + accents[accent] : ''}`}>
      {children}
    </div>
  );
};
const SectionCard = ({ children }) => (
  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">{children}</div>
);
const PageHeader = ({ title, subtitle, color }) => (
  <div className="mb-6">
    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
    <p className={`text-sm mt-1 ${color}`}>{subtitle}</p>
  </div>
);

// ── Collapsible section ───────────────────────────────────────────────────────
const Collapsible = ({ title, badge, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</span>
          {badge && <span className="text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">{badge}</span>}
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="p-5 border-t border-gray-100 dark:border-gray-700">{children}</div>}
    </div>
  );
};

// ── File upload zone ──────────────────────────────────────────────────────────
const FileUploadZone = ({ files, onAdd, onRemove, accept, helpText }) => {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => accept.some(a => f.name.endsWith(a) || f.type.includes(a.replace('.', ''))));
    if (dropped.length) onAdd(dropped);
  };

  const fmt = (bytes) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
        className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition
          ${dragging
            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950'
            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
        <svg className="w-7 h-7 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
        </svg>
        <p className="text-sm text-gray-500 dark:text-gray-400">Drop files here or <span className="text-indigo-600 dark:text-indigo-400 font-medium">browse</span></p>
        {helpText && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{helpText}</p>}
        <input ref={inputRef} type="file" multiple accept={accept.join(',')} className="hidden"
          onChange={e => { if (e.target.files.length) onAdd(Array.from(e.target.files)); e.target.value = ''; }} />
      </div>
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5l5 5v15a2 2 0 01-2 2z" />
                </svg>
                <span className="truncate text-gray-700 dark:text-gray-300 font-medium">{f.name}</span>
                <span className="text-gray-400 dark:text-gray-500 shrink-0">{fmt(f.size)}</span>
              </div>
              <button onClick={() => onRemove(i)} className="ml-3 text-gray-300 dark:text-gray-600 hover:text-red-500 transition shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ── Style sources manager ─────────────────────────────────────────────────────
const StyleSourcesManager = ({ sources, onChange }) => {
  const add = () => onChange([...sources, { id: Date.now().toString(), label: '', url: '' }]);
  const remove = (id) => onChange(sources.filter(s => s.id !== id));
  const update = (id, field, val) => onChange(sources.map(s => s.id === id ? { ...s, [field]: val } : s));
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        Add public URLs to PDF or Markdown files. The AI will fetch and mirror the writing style automatically.
      </p>
      {sources.map((s) => (
        <div key={s.id} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
          <input value={s.label} onChange={e => update(s.id, 'label', e.target.value)}
            placeholder="Label (e.g. Brand Voice)"
            className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white dark:focus:bg-gray-700 transition" />
          <input value={s.url} onChange={e => update(s.id, 'url', e.target.value)}
            placeholder="https://..."
            className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white dark:focus:bg-gray-700 transition" />
          <button onClick={() => remove(s.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add style source
      </button>
    </div>
  );
};

// ── Markdown renderer ─────────────────────────────────────────────────────────
const inlineFmt = (t) => t.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>');
let _k = 0;
const MarkdownOutput = ({ text }) => {
  if (!text) return null;
  const nodes = []; let listItems = [];
  const flushList = () => { if (!listItems.length) return; nodes.push(<ul key={_k++} className="list-disc ml-5 space-y-1 mb-3">{listItems}</ul>); listItems = []; };
  text.split('\n').forEach(raw => {
    const line = raw.trim();
    if (!line) { flushList(); return; }
    if (/^#{1,4}\s/.test(line)) {
      flushList();
      const [, hashes, content] = line.match(/^(#+)\s+(.*)/);
      const lvl = Math.min(hashes.length, 4);
      const cls = [
        'text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-gray-100',
        'text-lg font-semibold mt-5 mb-1.5 text-gray-900 dark:text-gray-100',
        'text-base font-semibold mt-4 mb-1 text-gray-800 dark:text-gray-200',
        'text-sm font-semibold mt-3 mb-1 text-gray-800 dark:text-gray-200',
      ][lvl-1];
      nodes.push(<div key={_k++} className={cls} dangerouslySetInnerHTML={{ __html: inlineFmt(content) }} />);
    } else if (/^(\*|-|\d+\.)\s/.test(line)) {
      listItems.push(<li key={_k++} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFmt(line.replace(/^(\*|-|\d+\.)\s/,'')) }} />);
    } else {
      flushList();
      nodes.push(<p key={_k++} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: inlineFmt(line) }} />);
    }
  });
  flushList();
  return <div className="space-y-0.5">{nodes}</div>;
};

// ── Insight card ──────────────────────────────────────────────────────────────
const InsightCard = ({ text, onSend }) => {
  const raw = text.replace(/^[*\-]\s*/, '').trim();
  const labelRx = /(Action \/ Insight:|Recommendation \/ Marketing Strategy:|Action:|Recommendation:|Insight:|Marketing Strategy:)/i;
  const parts = raw.split(labelRx).map(s => s.trim()).filter(Boolean);
  let title = '', pairs = [];
  let i = labelRx.test(parts[0]) ? 0 : (title = parts[0], 1);
  while (i < parts.length - 1) {
    if (labelRx.test(parts[i])) { pairs.push({ label: parts[i], body: parts[i+1]||'' }); i += 2; } else i++;
  }
  const fullText = [title, ...pairs.map(p => `${p.label} ${p.body}`)].join('\n\n');
  return (
    <Card>
      <div className="p-5">
        {title && <p className="font-semibold text-gray-900 dark:text-gray-100 mb-3" dangerouslySetInnerHTML={{ __html: inlineFmt(title) }} />}
        {pairs.length > 0 && (
          <div className="border-l-2 border-gray-200 dark:border-gray-700 pl-4 space-y-3">
            {pairs.map((p, idx) => (
              <div key={idx}>
                <span className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">{p.label} </span>
                <span className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFmt(p.body) }} />
              </div>
            ))}
          </div>
        )}
        {!title && !pairs.length && <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFmt(raw) }} />}
      </div>
      <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-5 py-3 flex justify-end gap-2">
        <CopyBtn text={fullText} />
        {onSend && <SendToGenBtn text={fullText} onClick={onSend} />}
      </div>
    </Card>
  );
};

// ── Collapsible header ────────────────────────────────────────────────────────
const CollapsibleHeader = ({ title, badge, open, onToggle }) => (
  <button onClick={onToggle}
    className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left">
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</span>
      {badge && <span className="text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">{badge}</span>}
    </div>
    <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  </button>
);

// ── Selectable card ───────────────────────────────────────────────────────────
const SelectableCard = ({ children, selected, onToggle, accent }) => {
  const accents = { indigo: 'border-t-indigo-500', green: 'border-t-green-500', red: 'border-t-red-500' };
  return (
    <div className={`relative bg-white dark:bg-gray-900 rounded-xl border shadow-sm overflow-hidden transition-all
      ${selected
        ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-600'
        : 'border-gray-100 dark:border-gray-800'}
      ${accent ? 'border-t-2 ' + accents[accent] : ''}`}>
      {/* Selection toggle */}
      <button onClick={onToggle}
        className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors z-10
          ${selected
            ? 'bg-indigo-600 border-indigo-600'
            : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 hover:border-indigo-400'}`}>
        {selected && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      {children}
    </div>
  );
};

// ── Copy selected button ──────────────────────────────────────────────────────
const CopySelectedBtn = ({ copies, selected }) => {
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    if (!selected.size) return;
    const text = [...selected].sort().map(i => {
      const c = copies[i];
      return [
        `── Variant ${i + 1}: ${c.style} ──`,
        `HEADLINE: ${c.headline}`,
        `BODY: ${c.bodyCopy}`,
        `CTA: ${c.callToAction}`,
        ``,
        `IMAGE OVERLAY`,
        `Hero: ${c.imageHero}`,
        `Tagline: ${c.imageTagline}`,
        `Image CTA: ${c.imageCta}`,
      ].join('\n');
    }).join('\n\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button onClick={copyAll} disabled={!selected.size}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition
        ${selected.size
          ? copied
            ? 'bg-green-600 text-white'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'}`}>
      {copied
        ? <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</>
        : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>Copy selected social posts</>}
    </button>
  );
};

// ── Module: Social Generator ──────────────────────────────────────────────────
const SocialGenerator = () => {
  const [form, setForm] = useState({
    product: 'CargoWise', benefit: 'Enhanced operational efficiency through automation and real-time visibility across the supply chain.',
    audience: 'Logistics and Freight Forwarding Companies', tone: 'Professional and innovative', variants: 3,
  });
  const [refFiles, setRefFiles] = useState([]);
  const [styleSources, setStyleSources] = useState(DEFAULT_STYLE_SOURCES);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [copies, setCopies] = useState([]);
  const [error, setError] = useState('');
  const [refOpen, setRefOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const toggleSelect = (i) => setSelected(s => {
    const next = new Set(s);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const addFiles = (newFiles) => setRefFiles(f => [...f, ...newFiles]);
  const removeFile = (i) => setRefFiles(f => f.filter((_, idx) => idx !== i));
  const activeStyleSources = styleSources.filter(s => s.url.trim());

  const generate = async () => {
    setLoading(true); setCopies([]); setError(''); setLoadingStage('Preparing…'); setSelected(new Set());
    try {
      const parts = [];
      parts.push({ text: `Generate exactly ${form.variants} social copy variants for:\n- Product: ${form.product}\n- Benefit: ${form.benefit}\n- Target: ${form.audience}\n- Tone: ${form.tone}` });

      if (refFiles.length > 0) {
        setLoadingStage('Reading reference files…');
        parts.push({ text: '\n\n--- PRODUCT REFERENCE MATERIALS ---\nUse the following documents to inform product accuracy:' });
        for (const file of refFiles) {
          const b64 = await fileToBase64(file);
          const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain');
          parts.push({ inlineData: { mimeType, data: b64 } });
          parts.push({ text: `[End of: ${file.name}]` });
        }
      }

      if (activeStyleSources.length > 0) {
        setLoadingStage('Fetching style references…');
        parts.push({ text: '\n\n--- WRITING STYLE REFERENCES ---\nAnalyse the tone, vocabulary, sentence structure, and style of the following documents and mirror them closely in your output:' });
        for (const src of activeStyleSources) {
          try {
            const { base64, mimeType } = await fetchFileAsBase64(src.url);
            parts.push({ text: `[Style reference: ${src.label}]` });
            parts.push({ inlineData: { mimeType, data: base64 } });
          } catch (e) {
            parts.push({ text: `[Could not load style reference "${src.label}": ${e.message}]` });
          }
        }
      }

      setLoadingStage('Generating copy…');
      const res = await fetchWithRetry(buildApiUrl(API_KEY), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          systemInstruction: {
            parts: [{
              text: `You are a world-class social media copywriter.
${activeStyleSources.length > 0 ? 'Carefully study any writing style reference documents provided and mirror their tone, vocabulary, and sentence structure.' : ''}
${refFiles.length > 0 ? 'Use any product reference documents for accurate product details.' : ''}
For each variant, generate both the social post copy AND the image overlay copy.
Image overlay copy consists of:
- imageHero: a short, bold, punchy hero message (max 8 words) displayed large on the image
- imageTagline: a supporting 1–2 sentence tagline shown smaller beneath the hero
- imageCta: a short CTA button label (max 6 words, written in uppercase style e.g. "LEARN MORE ABOUT THIS →")
Generate distinct social copy variants in JSON format. Use Australian English.`
            }]
          },
          generationConfig: { responseMimeType: 'application/json', responseSchema: adCopySchema },
        }),
      });
      setCopies(JSON.parse(res.candidates[0].content.parts[0].text));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setLoadingStage(''); }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <PageHeader title="Social Generator" subtitle="Generate distinct social copy variants for A/B testing." color="text-indigo-600" />
      <div className="space-y-4">
        <SectionCard>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Product name</Label><Input value={form.product} onChange={set('product')} /></div>
            <div><Label>Target audience</Label><Input value={form.audience} onChange={set('audience')} /></div>
          </div>
          <div className="mt-4"><Label>Key benefit</Label><Input value={form.benefit} onChange={set('benefit')} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div><Label>Tone</Label><Input value={form.tone} onChange={set('tone')} /></div>
            <div>
              <Label>Variants</Label>
              <Select value={form.variants} onChange={set('variants')}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} variant{n > 1 ? 's' : ''}</option>)}
              </Select>
            </div>
          </div>
        </SectionCard>

        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <CollapsibleHeader title="Product Reference Materials" badge={refFiles.length > 0 ? `${refFiles.length} file${refFiles.length > 1 ? 's' : ''}` : undefined} open={refOpen} onToggle={() => setRefOpen(o => !o)} />
          {refOpen && (
            <div className="p-5 border-t border-gray-100 dark:border-gray-700">
              <FileUploadZone files={refFiles} onAdd={addFiles} onRemove={removeFile} accept={['.pdf', '.txt']} helpText="PDF or TXT — used to inform product accuracy" />
            </div>
          )}
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <CollapsibleHeader title="Writing Style References" badge={activeStyleSources.length > 0 ? `${activeStyleSources.length} source${activeStyleSources.length > 1 ? 's' : ''}` : undefined} open={styleOpen} onToggle={() => setStyleOpen(o => !o)} />
          {styleOpen && (
            <div className="p-5 border-t border-gray-100 dark:border-gray-700">
              <StyleSourcesManager sources={styleSources} onChange={setStyleSources} />
            </div>
          )}
        </div>

        <PrimaryBtn loading={loading} loadingText={loadingStage || 'Generating…'} color="indigo" onClick={generate}>
          Generate Social Copy
        </PrimaryBtn>
      </div>

      <ErrorBox msg={error} />

      {copies.length > 0 && (
        <div className="mt-6">
          {/* Selection toolbar */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              {selected.size > 0 ? `${selected.size} selected` : 'Select variants to copy'}
            </p>
            <CopySelectedBtn copies={copies} selected={selected} />
          </div>

          <div className="space-y-4">
            {copies.map((c, i) => (
              <SelectableCard key={i} selected={selected.has(i)} onToggle={() => toggleSelect(i)} accent="indigo">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-800 px-2.5 py-1 rounded-full">{c.style}</span>
                  </div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-2">{c.headline}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{c.bodyCopy}</p>
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-5">{c.callToAction}</p>

                  <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Image Overlay Copy</p>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Hero</p>
                        <p className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug">{c.imageHero}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Tagline</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{c.imageTagline}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">CTA Button</p>
                        <span className="inline-block bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded tracking-wide">{c.imageCta}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </SelectableCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Module: Marketing Trend Analysis ─────────────────────────────────────────
const NewsAnalyser = ({ sendToContentGenerator }) => {
  const [topic, setTopic] = useState('Digital trends within the logistics industry');
  const [loading, setLoading] = useState(false);
  const [intro, setIntro] = useState('');
  const [bullets, setBullets] = useState([]);
  const [error, setError] = useState('');

  const analyse = async () => {
    setLoading(true); setIntro(''); setBullets([]); setError('');
    try {
      const res = await fetchWithRetry(buildApiUrl(API_KEY), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Analyse recent trends for "${topic}" and provide actionable marketing strategies.` }] }],
          tools: [{ google_search: {} }],
          systemInstruction: { parts: [{ text: `You are a market analyst. Structure your response exactly:\n- One short intro paragraph (no bullets).\n- Then each trend as "* " bullet on ONE line: <Title>  Action / Insight: <text>  Recommendation / Marketing Strategy: <text>\n- No sub-bullets or line breaks inside a bullet.\n- Australian English.` }] },
        }),
      });
      const raw = res.candidates[0].content.parts[0].text;
      const introLines = [], bulletLines = [];
      for (const l of raw.split('\n')) {
        if (l.trim().startsWith('* ') || l.trim().startsWith('- ')) bulletLines.push(l.trim());
        else if (!bulletLines.length) introLines.push(l);
      }
      setIntro(introLines.join('\n').trim());
      setBullets(bulletLines);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <PageHeader title="Marketing Trend Analysis" subtitle="Get real-time, actionable marketing insights." color="text-green-600" />
      <SectionCard>
        <Label>Topic</Label>
        <Input value={topic} onChange={e => setTopic(e.target.value)} />
        <div className="mt-4">
          <PrimaryBtn loading={loading} loadingText="Analysing…" color="green" onClick={analyse}>Analyse Marketing Trends</PrimaryBtn>
        </div>
      </SectionCard>
      <ErrorBox msg={error} />
      {(intro || bullets.length > 0) && (
        <div className="mt-6 space-y-4">
          {intro && <SectionCard><MarkdownOutput text={intro} /></SectionCard>}
          {bullets.map((b, i) => <InsightCard key={i} text={b} onSend={sendToContentGenerator} />)}
        </div>
      )}
    </div>
  );
};

// ── Module: Content Generator ─────────────────────────────────────────────────
const ContentGenerator = ({ initialPrompt, setInitialPrompt }) => {
  const [contentType, setContentType] = useState(CONTENT_TYPES[0].value);
  const [prompt, setPrompt] = useState(initialPrompt || 'Draft a LinkedIn post about supply chain visibility.');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [transferred, setTransferred] = useState(false);

  useEffect(() => {
    if (initialPrompt) { setPrompt(initialPrompt); setTransferred(true); setInitialPrompt(''); }
  }, [initialPrompt]);

  const generate = async () => {
    setLoading(true); setResult(''); setTransferred(false);
    try {
      const res = await fetchWithRetry(buildApiUrl(API_KEY), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Create a ${contentType} based on this: ${prompt}` }] }],
          systemInstruction: { parts: [{ text: 'You are an expert B2B copywriter for CargoWise. Use Australian English.' }] },
        }),
      });
      setResult(res.candidates[0].content.parts[0].text);
    } catch (e) { setResult('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <PageHeader title="Content Generator" subtitle="Draft high-impact marketing content for logistics executives." color="text-red-600" />
      <SectionCard>
        {transferred && (
          <div className="mb-4 flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Insight transferred from Trend Analysis
          </div>
        )}
        <div className="mb-4"><Label>Content type</Label>
          <Select value={contentType} onChange={e => setContentType(e.target.value)}>
            {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </div>
        <div><Label>Prompt / brief</Label><Textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={6} /></div>
        <div className="mt-4">
          <PrimaryBtn loading={loading} loadingText="Drafting…" color="red" onClick={generate}>Generate Content Draft</PrimaryBtn>
        </div>
      </SectionCard>
      {result && (
        <div className="mt-6">
          <Card accent="red">
            <div className="p-5"><MarkdownOutput text={result} /></div>
            <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-5 py-3 flex justify-end"><CopyBtn text={result} /></div>
          </Card>
        </div>
      )}
    </div>
  );
};

// ── Home ──────────────────────────────────────────────────────────────────────
const HomeView = ({ setActiveModule }) => {
  const mods = [
    { id: 'SocialGenerator',        label: 'Social Generator',        desc: 'Generate distinct social copy variants for A/B testing.',        color: 'border-indigo-500', text: 'text-indigo-600' },
    { id: 'MarketingTrendAnalysis', label: 'Marketing Trend Analysis', desc: 'Real-time insights and actionable strategies from industry news.', color: 'border-green-500',  text: 'text-green-600'  },
    { id: 'ContentGenerator',       label: 'Content Generator',        desc: 'Draft high-impact marketing content for logistics executives.',   color: 'border-red-500',    text: 'text-red-600'    },
  ];
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Welcome to AI Marketing Toolkit</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Select a module below to get started.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mods.map(m => (
          <button key={m.id} onClick={() => setActiveModule(m.id)}
            className={`bg-white dark:bg-gray-900 text-left p-5 rounded-xl border-t-2 ${m.color} border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow`}>
            <p className={`font-semibold text-base mb-1 ${m.text}`}>{m.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{m.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Missing key ───────────────────────────────────────────────────────────────
const MissingKeyBanner = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-red-100 dark:border-red-900 w-full max-w-lg p-8">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">API Key Not Configured</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Add a Gemini API key as an environment variable.</p>
      <div className="space-y-3 text-sm">
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Vite</p>
          <pre className="bg-gray-900 text-green-400 rounded p-3 text-xs">VITE_GEMINI_API_KEY=your_key_here</pre>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Create React App</p>
          <pre className="bg-gray-900 text-green-400 rounded p-3 text-xs">REACT_APP_GEMINI_API_KEY=your_key_here</pre>
        </div>
      </div>
    </div>
  </div>
);

// ── App shell ─────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'Home',                   label: 'Home' },
  { id: 'SocialGenerator',        label: 'Social Generator' },
  { id: 'MarketingTrendAnalysis', label: 'Marketing Trend Analysis' },
  { id: 'ContentGenerator',       label: 'Content Generator' },
];

const App = () => {
  const [active, setActive] = useState('Home');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [transfer, setTransfer] = useState('');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  if (!API_KEY) return <><style>{css}</style><MissingKeyBanner /></>;

  const sendToGenerator = (txt) => { setTransfer(txt); setActive('ContentGenerator'); };

  const views = {
    Home:                   <HomeView setActiveModule={setActive} />,
    SocialGenerator:        <SocialGenerator />,
    MarketingTrendAnalysis: <NewsAnalyser sendToContentGenerator={sendToGenerator} />,
    ContentGenerator:       <ContentGenerator initialPrompt={transfer} setInitialPrompt={setTransfer} />,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      <style>{css}</style>
      <aside className={`bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-col flex-shrink-0 transition-all duration-200 hidden md:flex ${sidebarOpen ? 'w-56' : 'w-0 overflow-hidden'}`}>
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <span className="text-lg font-bold text-indigo-600">AI Toolkit</span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setActive(n.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active === n.id ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'}`}>
              {n.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(o => !o)}
            className="hidden md:flex p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex-1">{NAV.find(n => n.id === active)?.label}</span>
          <button onClick={() => setDark(d => !d)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition">
            {dark
              ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m15.07-6.07-.7.7M6.34 17.66l-.7.7m12.73 0-.7-.7M6.34 6.34l-.7-.7M12 7a5 5 0 100 10A5 5 0 0012 7z" /></svg>
              : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" /></svg>
            }
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">{views[active]}</main>
      </div>
    </div>
  );
};

const css = `*{box-sizing:border-box} .dark{color-scheme:dark}`;
export default App;