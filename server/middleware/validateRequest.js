// Bound query inputs once so malformed pagination and identifiers never reach SQL.
module.exports=(req,res,next)=>{
  if(req.body && (typeof req.body!=='object' || Array.isArray(req.body))) return res.status(400).json({message:'Invalid request body'});
  for(const [key,value] of Object.entries(req.body || {})) {
    if(['name','email','password','current_password','new_password','phone','nid_number','role','location','address','title','description','subject','comment','content','message','notes','bio','service_description','category','booking_date','preferred_date','status','admin_notes','cover_message'].includes(key) && value!=null && typeof value!=='string') return res.status(400).json({message:`Invalid ${key}`});
    const maximum={name:100,email:255,phone:20,nid_number:50,location:255,subject:200,title:200,comment:5000,bio:5000,service_description:10000,description:10000,notes:10000,admin_notes:10000,cover_message:10000}[key];
    if(maximum && typeof value==='string' && value.length>maximum) return res.status(400).json({message:`${key} is too long`});
    if(['helper_id','service_id','recipient_id','accused_id','booking_id','category_id'].includes(key) && value!=null && (!Number.isInteger(Number(value)) || Number(value)<1 || Number(value)>2147483647)) return res.status(400).json({message:`Invalid ${key}`});
  }
  for(const [key,value] of Object.entries(req.query)) {
    if(typeof value!=='string' || value.length>500) return res.status(400).json({message:'Invalid query parameter'});
    if(['page','limit'].includes(key) && (!/^\d+$/.test(value) || Number(value)<1 || Number(value)>1000)) return res.status(400).json({message:'Invalid pagination'});
    if(['category','min_rating','max_rate'].includes(key) && (!Number.isFinite(Number(value)) || Number(value)<0)) return res.status(400).json({message:'Invalid numeric filter'});
  }
  const segments=req.path.split('/').filter(Boolean);
  if(segments.some(segment=>/^[-\d]+$/.test(segment) && (!/^\d+$/.test(segment) || Number(segment)<1 || Number(segment)>2147483647))) return res.status(400).json({message:'Invalid record identifier'});
  next();
};
