'use client';

import { useEffect, useRef, useState } from 'react';
import { X, RotateCcw, RefreshCw } from 'lucide-react';
import { applyCropOffsets, cropOffsetsFromRect } from '@/lib/ntbc-smart-crop';

// Drag-to-crop editor for one capture type. Shows the full-page screenshot the last capture was
// cut from (saved by /api/ntbc-capture) with the crop as a box you move and resize; saving turns
// the box back into the preset's offsets (relative to the auto box) and re-cuts the image on the
// server — no new capture needed.
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_POS = {
    nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
    n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
    ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
    e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
    se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
    s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
    sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
    w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
};
const MIN_SIZE = 50;


export default function CropEditorModal({ type, label, offsets, onApply, onClose }) {
    const [source, setSource] = useState(undefined); // undefined = loading, null = none
    const [natural, setNatural] = useState(null);
    const [displayWidth, setDisplayWidth] = useState(0);
    const [rect, setRect] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const frameRef = useRef(null);
    const scrollRef = useRef(null);
    const imgUrl = useRef(`/api/ntbc-capture?action=crop-source-image&type=${encodeURIComponent(type)}&page=0&t=${Date.now()}`);

    useEffect(() => {
        fetch(`/api/ntbc-capture?action=crop-source&type=${encodeURIComponent(type)}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(d => setSource(d?.source || null))
            .catch(() => setSource(null));
    }, [type]);

    const box = source?.boxes?.[0] || null;
    // How offsets move the box ('box' or 'edges', see applyCropOffsets) and image px per CSS px.
    const semantics = source?.semantics || 'box';
    const srcScale = source?.scale || 1;
    const legacy = box && !applyCropOffsets(box, offsets, semantics);

    useEffect(() => {
        if (!box) return;
        setRect(applyCropOffsets(box, offsets, semantics) || { ...box });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source]);

    // Fit the screenshot to the panel width; the panel scrolls vertically.
    useEffect(() => {
        const el = frameRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setDisplayWidth(el.clientWidth));
        ro.observe(el);
        setDisplayWidth(el.clientWidth);
        return () => ro.disconnect();
    }, [natural]);

    // Page size in the same CSS px as the boxes (the screenshot may be at a higher pixel ratio).
    const pageSize = natural ? { width: natural.width / srcScale, height: natural.height / srcScale } : null;
    const scale = pageSize && displayWidth ? displayWidth / pageSize.width : 0;

    // Bring the crop box into view once the image is laid out.
    useEffect(() => {
        if (!scale || !rect || !scrollRef.current) return;
        scrollRef.current.scrollTop = Math.max(0, rect.y * scale - 80);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scale > 0]);

    // Handlers are made per drag (they close over this drag's start, scale and image size),
    // so the same functions are added and removed.
    const startDrag = (e, mode) => {
        if (!pageSize || !scale) return;
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const start = { ...rect };
        const onMove = (ev) => {
            const dx = (ev.clientX - startX) / scale;
            const dy = (ev.clientY - startY) / scale;
            let { x, y, width, height } = start;
            if (mode === 'move') {
                x = Math.min(Math.max(0, x + dx), pageSize.width - width);
                y = Math.min(Math.max(0, y + dy), pageSize.height - height);
            } else {
                if (mode.includes('w')) { const nx = Math.min(Math.max(0, x + dx), x + width - MIN_SIZE); width += x - nx; x = nx; }
                if (mode.includes('e')) width = Math.min(Math.max(MIN_SIZE, width + dx), pageSize.width - x);
                if (mode.includes('n')) { const ny = Math.min(Math.max(0, y + dy), y + height - MIN_SIZE); height += y - ny; y = ny; }
                if (mode.includes('s')) height = Math.min(Math.max(MIN_SIZE, height + dy), pageSize.height - y);
            }
            setRect({ x, y, width, height });
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    const current = box && rect ? cropOffsetsFromRect(box, rect, semantics) : null;

    const save = async () => {
        if (!current) return;
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/ntbc-capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'recrop', type, offsets: current }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'ตัดรูปไม่สำเร็จ');
            onApply(current, data);
        } catch (e) {
            setError(e.message);
            setSaving(false);
        }
    };

    const px = (v) => `${v * scale}px`;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70" onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-950/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-base font-bold text-white">✂️ ลากปรับกรอบตัดรูป · {label}</h2>
                        <p className="text-xs text-gray-400 mt-0.5">ลากกรอบแดงเพื่อย้าย · ลากจุดขาวที่มุม/ขอบเพื่อย่อขยาย</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs">
                            <span className="flex items-center gap-1.5 text-rose-300"><span className="inline-block w-4 h-3 border-2 border-rose-500" /> กรอบแดง = รูปที่จะได้ (ตาม offset) — ตรงกับรูปพรีวิวและรูปในรายงาน</span>
                            <span className="flex items-center gap-1.5 text-cyan-300"><span className="inline-block w-4 h-3 border-2 border-dashed border-cyan-400" /> เส้นประฟ้า = กรอบอัตโนมัติ (offset 0) ใช้เทียบเท่านั้น</span>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} disabled={saving} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer" aria-label="ปิด">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-auto p-4 bg-gray-950">
                    {source === undefined && <p className="text-sm text-gray-400 py-10 text-center">กำลังโหลดภาพเต็มหน้า…</p>}
                    {source === null && (
                        <p className="text-sm text-amber-300 py-10 text-center">
                            ยังไม่มีภาพเต็มหน้าของหัวข้อนี้ — กด <strong>📸 Capture This Page Now</strong> หนึ่งครั้ง แล้วเปิดตัวลากนี้อีกครั้ง
                        </p>
                    )}
                    {legacy && (
                        <p className="text-sm text-amber-300 mb-3">ค่าเดิมเป็นพิกัดแบบเก่า (เกิน 500) — กรอบเริ่มที่กรอบอัตโนมัติแทน</p>
                    )}
                    {box && (
                        <div ref={frameRef} className="relative w-full select-none overflow-hidden rounded-lg" style={{ height: pageSize ? pageSize.height * scale : undefined }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={imgUrl.current}
                                alt=""
                                draggable={false}
                                onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
                                className="absolute left-0 top-0 w-full h-auto pointer-events-none"
                            />
                            {scale > 0 && rect && (
                                <>
                                    <div className="absolute border-2 border-dashed border-cyan-400/70 pointer-events-none" style={{ left: px(box.x), top: px(box.y), width: px(box.width), height: px(box.height) }} />
                                    <div
                                        onPointerDown={(e) => startDrag(e, 'move')}
                                        className="absolute border-2 border-rose-500 cursor-move touch-none"
                                        style={{ left: px(rect.x), top: px(rect.y), width: px(rect.width), height: px(rect.height), boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
                                    >
                                        {HANDLES.map(h => (
                                            <span
                                                key={h}
                                                onPointerDown={(e) => startDrag(e, h)}
                                                className={`absolute w-3.5 h-3.5 bg-white border-2 border-rose-500 rounded-sm touch-none ${HANDLE_POS[h]}`}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-gray-700">
                    <div className="text-xs text-gray-400 font-mono">
                        {current && <>Xstart {current.xStart} · Xend {current.xEnd} · Ystart {current.yStart} · Yend {current.yEnd}</>}
                        {source?.boxes?.length > 1 && <span className="ml-2 text-gray-500">(ใช้กรอบเดียวกันทั้ง {source.boxes.length} หน้า)</span>}
                        {error && <span className="ml-2 text-rose-400 font-sans">{error}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={!box || saving}
                            onClick={() => setRect({ ...box })}
                            className="h-9 px-3 rounded-lg text-xs font-semibold border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> กลับเป็นกรอบอัตโนมัติ
                        </button>
                        <button type="button" onClick={onClose} disabled={saving} className="h-9 px-3 rounded-lg text-xs font-semibold border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer">
                            ยกเลิก
                        </button>
                        <button
                            type="button"
                            disabled={!current || saving}
                            onClick={save}
                            className="h-9 px-4 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />} ตัดรูปตามกรอบนี้
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
