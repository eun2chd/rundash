import toast from 'react-hot-toast'

// One place for transient feedback ("saved", "deleted", "failed") shown as top-right toasts.
// Field-level validation and loading states stay inline next to the controls they describe.
export const notify = {
  success: (message, options) => toast.success(message, options),
  error: (message, options) => toast.error(message, { duration: 5000, ...options }),
  info: (message, options) => toast(message, options),
}
