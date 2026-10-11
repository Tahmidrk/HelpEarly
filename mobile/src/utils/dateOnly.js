export function dateText(date) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function parseDate(value,allowPast=false,now=new Date()) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Use YYYY-MM-DD for date');
  const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d,12);
  if(date.getFullYear()!==y||date.getMonth()!==m-1||date.getDate()!==d)throw new Error('Enter a valid calendar date');
  if(!allowPast && value<dateText(now))throw new Error('Choose today or a future date');
  return date;
}
