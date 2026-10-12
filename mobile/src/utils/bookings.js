// Reuse the two locale formatters for a batch, rather than constructing them per row.
export function formatBookings(rows) {
  const dates = new Intl.DateTimeFormat('en-CA');
  const times = new Intl.DateTimeFormat([], {hour:'2-digit',minute:'2-digit'});
  return rows.map(b => {
    const date = b.booking_date ? new Date(b.booking_date) : null;
    const valid = date && !Number.isNaN(date.getTime());
    return {
      ...b, rawId:b.id, id:`B-${b.id}`, service:b.service_description || b.service_name || 'Custom service',
      category:b.category_name || '', status:b.status.charAt(0).toUpperCase()+b.status.slice(1),
      date:date ? (valid ? dates.format(date) : 'Invalid Date') : '',
      time:date ? (valid ? times.format(date) : 'Invalid Date') : '',
      amount:b.total_price, location:b.address, photoUri:b.photo_urls?.[0] || null,
    };
  });
}
