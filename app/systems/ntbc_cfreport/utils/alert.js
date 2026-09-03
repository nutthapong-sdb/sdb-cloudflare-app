import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

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
        popup: 'ntbc-top-toast rounded-xl border border-gray-800 shadow-2xl backdrop-blur-md',
        title: 'text-sm font-semibold text-gray-100',
        htmlContainer: 'text-xs text-gray-300'
    },
    didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
    }
});

const customSwal = {
    ...Swal,
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

    fire: (...args) => {
        // String shorthand: Swal.fire('Title', 'Message', 'icon')
        if (args.length >= 2 && typeof args[0] === 'string' && typeof args[1] === 'string') {
            const [title, text, icon] = args;
            return Toast.fire({
                icon: icon || 'info',
                title,
                text
            });
        }

        // Single string: Swal.fire('Message')
        if (args.length === 1 && typeof args[0] === 'string') {
            return Toast.fire({
                icon: 'info',
                title: args[0]
            });
        }

        // Object options: Swal.fire({ ... })
        if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
            const options = args[0];

            // If it's a confirmation / prompt requiring user interaction
            if (options.showCancelButton || options.input || options.position === 'center' || (typeof options.html === 'string' && options.html.includes('<input'))) {
                return Swal.fire({
                    position: options.position || 'center',
                    background: '#111827',
                    color: '#f3f4f6',
                    customClass: {
                        popup: 'rounded-2xl border border-gray-800 shadow-2xl',
                        ...options.customClass
                    },
                    ...options
                });
            }

            // Normal notification/alert -> ALWAYS Top-Right Toast
            return Toast.fire({
                ...options,
                toast: true,
                position: 'top-end',
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
