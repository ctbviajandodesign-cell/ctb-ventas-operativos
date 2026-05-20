// Custom toast dispatcher utility
export function showToast(message, type = 'success') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('toast-notification', { detail: { message, type } }))
  }
}
