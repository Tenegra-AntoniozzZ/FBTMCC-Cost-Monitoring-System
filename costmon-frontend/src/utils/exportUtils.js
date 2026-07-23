export function generateFilename(prefix, extension = 'xlsx') {
  const date = new Date();
  
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; 
  const hh = String(hours).padStart(2, '0');
  
  const timestamp = `${mm}-${dd}-${yy}_${hh}-${minutes}-${ampm}`;
  return `${prefix}_${timestamp}.${extension}`;
}
