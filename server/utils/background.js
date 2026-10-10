function startCleanup() {
  let running=false;
  const tick=async()=>{ if(running)return; running=true; try { await require('./storage').cleanupOrphans(); } catch(error) {console.error('Media cleanup unavailable:',error.code || error.name);} finally {running=false;} };
  tick(); const timer=setInterval(tick,60000); timer.unref();
  return ()=>clearInterval(timer);
}
module.exports={startCleanup};
