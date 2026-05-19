/**
 * Formats a number as USD currency.
 * 
 * @param {number|string} amount - The amount to format.
 * @returns {string} Formatted currency string.
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0
  return `$${num.toLocaleString('en-US')}`
}

/**
 * Formats a date string into DD/MM/YYYY format.
 * 
 * @param {string|Date} dateStr - The date to format.
 * @returns {string} Formatted date string.
 */
export function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toISOString().split('T')[0]
  } catch (e) {
    return dateStr
  }
}

/**
 * Formats a date string into 'DD Month YYYY' format (e.g. 15 Ene 2024).
 * Expects input format YYYY-MM-DD.
 * 
 * @param {string} dateStr - Date string in YYYY-MM-DD format.
 * @returns {string} Formatted simple date.
 */
export function formatSimpleDate(dateStr) {
  if (!dateStr) return 'No definida'
  try {
    const parts = dateStr.split('-')
    if (parts.length !== 3) return dateStr
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return `${parts[2]} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`
  } catch (e) {
    return dateStr
  }
}
