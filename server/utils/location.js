function locationInput(body) {
  const provided=['latitude','longitude'].some(k=>body[k]!==undefined && body[k]!==null);
  if(body.location!==undefined && (typeof body.location!=='string' || body.location.trim().length<5 || body.location.length>500))throw Object.assign(new Error('Enter a service address or area of 5–500 characters'),{status:400});
  if(provided && (body.latitude===null || body.longitude===null || body.latitude==='' || body.longitude==='' || !Number.isFinite(Number(body.latitude)) || !Number.isFinite(Number(body.longitude)) || Math.abs(Number(body.latitude))>90 || Math.abs(Number(body.longitude))>180 || body.location_confirmed!==true || !body.location?.trim()))throw Object.assign(new Error('Confirm a valid mapped service area before saving coordinates'),{status:400});
  return {latitude:provided?Number(body.latitude):null,longitude:provided?Number(body.longitude):null,confirmed:provided};
}
module.exports={locationInput};
