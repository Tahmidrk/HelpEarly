// Single-instance limits. A replicated deployment needs a shared limiter.
const jwt = require('jsonwebtoken');
const { createHash } = require('node:crypto');
const buckets=new Map();
const timer=setInterval(()=>{const now=Date.now();for(const [key,value] of buckets) if(value.reset<=now) buckets.delete(key);},60000);timer.unref();
module.exports=(name,limit,windowMs)=>(req,res,next)=>{
  let identity = req.ip;
  if (name === 'api' || name === 'ai') {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (token) {
      try {
        const claims = jwt.verify(token, process.env.JWT_SECRET);
        identity = `${req.ip}:${claims.id}:${createHash('sha256').update(token).digest('hex')}`;
      } catch { /* Invalid credentials remain in the unauthenticated IP bucket. */ }
    }
  }
  const key=`${name}:${identity}`,now=Date.now();
  let bucket=buckets.get(key);
  if(!bucket || bucket.reset<=now) {bucket={count:0,reset:now+windowMs};buckets.set(key,bucket);}
  if(++bucket.count>limit) {res.set('Retry-After',String(Math.ceil((bucket.reset-now)/1000)));return res.status(429).json({message:'Too many requests; try again later'});}
  next();
};
