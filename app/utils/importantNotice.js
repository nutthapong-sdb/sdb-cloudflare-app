'use client';

import Swal from 'sweetalert2';

// Centered modal for warnings the user must not skip past: every button (and Esc / outside
// click) stays locked for `lockSeconds` while a countdown shows on the confirm button.
// Resolves true when the user confirms, false when they cancel.
export async function showImportantNotice({
    title,
    html,
    confirmText = 'รับทราบ',
    cancelText = null,
    lockSeconds = 5,
    icon = 'warning',
}) {
    let timer = null;
    const result = await Swal.fire({
        title,
        html,
        icon,
        position: 'center',
        width: 640,
        showCancelButton: !!cancelText,
        confirmButtonText: `${confirmText} (${lockSeconds})`,
        cancelButtonText: cancelText || undefined,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#4B5563',
        allowOutsideClick: false,
        allowEscapeKey: false,
        background: '#111827',
        color: '#fff',
        didOpen: () => {
            const confirmBtn = Swal.getConfirmButton();
            const cancelBtn = Swal.getCancelButton();
            confirmBtn.disabled = true;
            if (cancelBtn) cancelBtn.disabled = true;
            let left = lockSeconds;
            timer = setInterval(() => {
                left -= 1;
                if (left > 0) {
                    confirmBtn.textContent = `${confirmText} (${left})`;
                    return;
                }
                clearInterval(timer);
                confirmBtn.textContent = confirmText;
                confirmBtn.disabled = false;
                if (cancelBtn) cancelBtn.disabled = false;
            }, 1000);
        },
        willClose: () => clearInterval(timer),
    });
    return !!result.isConfirmed;
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
