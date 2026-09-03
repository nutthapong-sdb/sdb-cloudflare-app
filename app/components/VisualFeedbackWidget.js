'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Crosshair, Copy, Check, X, Sparkles, Pin, Compass } from 'lucide-react';

export default function VisualFeedbackWidget() {
  const [isInspectActive, setIsInspectActive] = useState(false);
  const [hoveredEl, setHoveredEl] = useState(null);
  const [selectedEl, setSelectedEl] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [copied, setCopied] = useState(false);
  const [targetInfo, setTargetInfo] = useState(null);

  const overlayRef = useRef(null);

  // Toggle inspect via keyboard shortcut (Alt+F or Option+F)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) {
        e.preventDefault();
        setIsInspectActive(prev => {
          if (prev) {
            setHoveredEl(null);
            setSelectedEl(null);
            setTargetInfo(null);
          }
          return !prev;
        });
      } else if (e.key === 'Escape' && isInspectActive) {
        setIsInspectActive(false);
        setHoveredEl(null);
        setSelectedEl(null);
        setTargetInfo(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInspectActive]);

  // Handle Mouse Over & Click during Inspect Mode
  useEffect(() => {
    if (!isInspectActive || selectedEl) return;

    const handleMouseOver = (e) => {
      if (e.target.closest('[data-feedback-widget="true"]')) {
        setHoveredEl(null);
        return;
      }
      setHoveredEl(e.target);
    };

    const handleClick = (e) => {
      if (e.target.closest('[data-feedback-widget="true"]')) return;

      e.preventDefault();
      e.stopPropagation();

      const el = e.target;
      setSelectedEl(el);
      setHoveredEl(null);

      const tagName = el.tagName ? el.tagName.toLowerCase() : 'element';
      const textContent = (el.innerText || el.textContent || '').trim().slice(0, 100);
      const testId = el.getAttribute('data-testid') || el.getAttribute('id') || '';
      const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title') || '';
      const classList = Array.from(el.classList || []).slice(0, 4).join(' ');

      let selector = tagName;
      if (testId) selector += `[id/testId="${testId}"]`;
      if (ariaLabel) selector += `[title="${ariaLabel}"]`;
      if (classList) selector += `.${classList.replace(/\s+/g, '.')}`;

      setTargetInfo({
        path: window.location.pathname + window.location.search,
        hash: window.location.hash || '',
        tagName,
        selector,
        textContent,
        testId,
        ariaLabel
      });
      setFeedbackText('');
      setCopied(false);
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isInspectActive, selectedEl]);

  // Update hover bounding box position
  const activeEl = selectedEl || hoveredEl;
  let overlayStyle = null;
  if (isInspectActive && activeEl) {
    try {
      const rect = activeEl.getBoundingClientRect();
      overlayStyle = {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      };
    } catch {
      overlayStyle = null;
    }
  }

  const handleCopyPrompt = () => {
    if (!targetInfo) return;

    const formattedPrompt = `
<EDIT_REQUEST>
📍 หน้าเว็บ (URL): \`${window.location.origin}${targetInfo.path}${targetInfo.hash}\`
🎯 ตำแหน่ง/Element: \`<${targetInfo.tagName}>\` ${targetInfo.selector ? `(${targetInfo.selector})` : ''}
${targetInfo.textContent ? `💬 ข้อความปัจจุบัน: "${targetInfo.textContent}"\n` : ''}
🛠️ สิ่งที่ต้องการแก้ไข:
${feedbackText || '(ระบุสิ่งที่ต้องการให้แก้ไข)'}
</EDIT_REQUEST>
`.trim();

    const copyFallback = (text) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textarea);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(formattedPrompt)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        })
        .catch(() => copyFallback(formattedPrompt));
    } else {
      copyFallback(formattedPrompt);
    }
  };

  const handleCloseModal = () => {
    setSelectedEl(null);
    setTargetInfo(null);
    setIsInspectActive(false);
  };

  const handlePickAnother = () => {
    setSelectedEl(null);
    setTargetInfo(null);
    setIsInspectActive(true);
  };

  return (
    <>
      {/* Highlight Box Overlay */}
      {isInspectActive && overlayStyle && (
        <div
          ref={overlayRef}
          data-feedback-widget="true"
          style={overlayStyle}
          className={`fixed pointer-events-none z-[99998] transition-all duration-75 rounded ${
            selectedEl 
              ? 'border-2 border-pink-500 bg-pink-500/20 shadow-[0_0_20px_rgba(236,72,153,0.5)] ring-4 ring-pink-500/30' 
              : 'border-2 border-indigo-400 bg-indigo-500/15 ring-2 ring-indigo-400/40 animate-pulse'
          }`}
        >
          <div className="absolute -top-6 left-0 bg-indigo-950/90 text-indigo-200 border border-indigo-500/50 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg flex items-center gap-1 backdrop-blur-sm whitespace-nowrap">
            <Crosshair className="w-3 h-3 text-indigo-400" />
            <span>&lt;{activeEl.tagName ? activeEl.tagName.toLowerCase() : 'element'}&gt;</span>
            {selectedEl && <span className="text-pink-400 font-bold ml-1">● Pinned</span>}
          </div>
        </div>
      )}

      {/* Floating Status Banner */}
      {isInspectActive && !selectedEl && (
        <div
          data-feedback-widget="true"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] bg-slate-900/95 border-2 border-indigo-500 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md animate-bounce font-sans text-xs font-bold"
        >
          <Crosshair className="w-4 h-4 text-indigo-400 animate-spin" />
          <span>โหมดชี้จุดแก้ไข: คลิกเลือกปุ่ม/ตาราง/ข้อความที่ต้องการแก้ได้เลย (หรือกด Esc เพื่อยกเลิก)</span>
          <button
            onClick={() => setIsInspectActive(false)}
            className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white cursor-pointer ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Element Feedback Dialog */}
      {selectedEl && targetInfo && (
        <div
          data-feedback-widget="true"
          className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-slate-100">
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <Pin className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <span>ระบุคำสั่งแก้ไขสำหรับจุดนี้</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {targetInfo.path} &gt; &lt;{targetInfo.tagName}&gt;
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-bold text-indigo-300 flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-indigo-400" />
                    พิกัด Element:
                  </span>
                  <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                    &lt;{targetInfo.tagName}&gt;
                  </span>
                </div>
                {targetInfo.textContent && (
                  <div className="text-slate-300 text-xs bg-slate-900/80 p-2 rounded border border-slate-800 line-clamp-2">
                    <span className="text-slate-500 text-[10px] block font-bold mb-0.5">ข้อความปัจจุบันบนหน้าจอ:</span>
                    "{targetInfo.textContent}"
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  พิมพ์คำสั่งหรือสิ่งที่ต้องการให้แก้ไข: <span className="text-rose-400">*</span>
                </label>
                <textarea
                  autoFocus
                  rows={4}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="เช่น: อยากให้เปลี่ยนสีปุ่มนี้เป็นสีเขียวมรกต และถ้าเป็น user ทั่วไปให้ disable พร้อม tooltip ชี้แจงสิทธิ์..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handlePickAnother}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                >
                  ชี้จุดอื่น (Pick Another)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                      copied
                        ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>คัดลอกคำสั่งเรียบร้อย!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>คัดลอกคำสั่ง (Copy Prompt)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {copied && (
                <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-center text-xs text-emerald-300 font-medium">
                  ✅ คัดลอกพิกัดและคำสั่งแล้ว! สามารถนำไป Paste ในช่องแชท Antigravity ได้ทันที
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom-Right Trigger Button */}
      <div
        data-feedback-widget="true"
        className="fixed bottom-5 right-5 z-[99990] flex items-center gap-2 font-sans select-none"
      >
        <button
          onClick={() => {
            setIsInspectActive(prev => {
              if (prev) {
                setHoveredEl(null);
                setSelectedEl(null);
                setTargetInfo(null);
              }
              return !prev;
            });
          }}
          title="คลิกเพื่อเปิดโหมดชี้จุดแก้ไขบนหน้าเว็บ (Shortcut: Alt+F / Option+F)"
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-full font-bold text-xs shadow-2xl transition-all border cursor-pointer ${
            isInspectActive
              ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white border-pink-400 ring-4 ring-pink-500/30 scale-105 animate-pulse'
              : 'bg-slate-900/90 hover:bg-slate-800 text-indigo-300 border-indigo-500/40 hover:border-indigo-400 hover:text-white backdrop-blur-md'
          }`}
        >
          <Crosshair className={`w-4 h-4 ${isInspectActive ? 'animate-spin text-pink-200' : 'text-indigo-400'}`} />
          <span>{isInspectActive ? 'กำลังชี้จุด... (กด Esc ปิด)' : '📌 ชี้จุดสั่งแก้ (Alt+F)'}</span>
        </button>
      </div>
    </>
  );
}
