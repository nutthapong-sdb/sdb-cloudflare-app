import Swal from 'sweetalert2';

// Base toast configuration for top-right notifications
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#111827',
    color: '#f3f4f6',
    customClass: {
        popup: 'rounded-xl border border-gray-800 shadow-2xl backdrop-blur-md',
        title: 'text-sm font-semibold text-gray-100',
        htmlContainer: 'text-xs text-gray-300'
    },
    didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
    }
});

/**
 * Custom Swal wrapper for NTBC application
 * Automatically positions non-modal alerts as top-right toasts.
 */
const customSwal = {
    ...Swal,
    // Direct notification helpers
    toast: (icon, title, text) => {
        return Toast.fire({
            icon,
            title: title || (icon === 'success' ? 'Success' : icon === 'error' ? 'Error' : 'Notification'),
            text: typeof text === 'string' ? text : undefined,
            html: typeof text !== 'string' ? text : undefined
        });
    },
    success: (title, text) => Toast.fire({ icon: 'success', title: title || 'Success', text }),
    error: (title, text) => Toast.fire({ icon: 'error', title: title || 'Error', text }),
    warning: (title, text) => Toast.fire({ icon: 'warning', title: title || 'Warning', text }),
    info: (title, text) => Toast.fire({ icon: 'info', title: title || 'Info', text }),
    
    // Override fire to route alerts to top-right toast by default unless explicitly a modal dialog (like confirmations)
    fire: (...args) => {
        // Handle Swal.fire('Title', 'Text', 'icon') shorthand
        if (args.length >= 2 && typeof args[0] === 'string' && typeof args[1] === 'string') {
            const [title, text, icon] = args;
            return Toast.fire({
                icon: icon || 'info',
                title: title,
                text: text
            });
        }
        
        // Handle Swal.fire(options)
        if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
            const options = args[0];
            // If it has showCancelButton, input, or explicitly modal with custom buttons, keep modal
            if (options.showCancelButton || options.input || (typeof options.html === 'string' && options.html.includes('<input')) || options.isModal) {
                return Swal.fire({
                    background: '#111827',
                    color: '#f3f4f6',
                    customClass: {
                        popup: 'rounded-2xl border border-gray-800 shadow-2xl'
                    },
                    ...options
                });
            }
            // For standard notification popups, turn into top-end toast
            return Toast.fire({
                ...options,
                toast: true,
                position: options.position || 'top-end',
                showConfirmButton: options.showConfirmButton ?? false,
                timer: options.timer ?? 3000,
                timerProgressBar: options.timerProgressBar ?? true
            });
        }

        return Swal.fire(...args);
    },
    showValidationMessage: (...args) => Swal.showValidationMessage(...args),
    close: (...args) => Swal.close(...args),
    isVisible: (...args) => Swal.isVisible(...args)
};

export default customSwal;
export { Toast };
