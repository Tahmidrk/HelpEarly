// Reject JavaScript's silent rollover of impossible calendar dates.
function validCalendarDate(value) {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value))return false;
  const [year,month,day]=value.slice(0,10).split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year && date.getUTCMonth()===month-1 && date.getUTCDate()===day && Number.isFinite(new Date(value).getTime());
}
module.exports={validCalendarDate};
