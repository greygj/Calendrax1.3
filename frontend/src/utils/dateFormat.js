/**
 * Format a date string from YYYY-MM-DD to DD-MM-YYYY
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Date string in DD-MM-YYYY format
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  
  // Handle ISO date strings (e.g., "2026-02-08T00:00:00.000Z")
  const datePart = dateStr.split('T')[0];
  
  // Split and rearrange from YYYY-MM-DD to DD-MM-YYYY
  const parts = datePart.split('-');
  if (parts.length !== 3) return dateStr;
  
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

/**
 * Format a Date object to DD-MM-YYYY string
 * @param {Date} date - Date object
 * @returns {string} Date string in DD-MM-YYYY format
 */
export const formatDateObject = (date) => {
  if (!date || !(date instanceof Date)) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}-${month}-${year}`;
};

/**
 * Format date for display with options
 * @param {string|Date} date - Date string or Date object
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
export const formatDateDisplay = (date, options = {}) => {
  const { includeDay = false, includeYear = true } = options;
  
  let dateObj;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }
  
  if (isNaN(dateObj.getTime())) return '';
  
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[dateObj.getDay()];
  
  let result = `${day}-${month}`;
  if (includeYear) result += `-${year}`;
  if (includeDay) result = `${dayName}, ${result}`;
  
  return result;
};
