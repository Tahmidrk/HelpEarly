// Single-instance limits. A replicated deployment needs a shared limiter.
const buckets=new Map();
const timer=setInterval(()=>{const now=Date.now();for(const [key,value] of buckets) if(value.reset<=now) buckets.delete(key);},60000);timer.unref();
module.exports=(name,limit,windowMs)=>(req,res,next)=>{
  const key=`${name}:${req.ip}`,now=Date.now();
  let bucket=buckets.get(key);
  if(!bucket || bucket.reset<=now) {bucket={count:0,reset:now+windowMs};buckets.set(key,bucket);}
  if(++bucket.count>limit) {res.set('Retry-After',String(Math.ceil((bucket.reset-now)/1000)));return res.status(429).json({message:'Too many requests; try again later'});}
  next();
};
