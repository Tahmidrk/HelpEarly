const pool = require('../config/db');
const { getIO } = require('../socket/chat');
const EXPO_URL = 'https://exp.host/--/api/v2/push/';

async function expoRequest(endpoint,body) {
  const response=await fetch(EXPO_URL+endpoint,{
    method:'POST',signal:AbortSignal.timeout(10000),
    headers:{'Content-Type':'application/json',...(process.env.EXPO_ACCESS_TOKEN ? {Authorization:`Bearer ${process.env.EXPO_ACCESS_TOKEN}`} : {})},
    body:JSON.stringify(body),
  });
  const data=await response.json();
  return {response,data};
}

async function flushNotifications() {
  const db=await pool.connect();
  let locked=false;
  try {
    locked=(await db.query('SELECT pg_try_advisory_lock(724032) AS locked')).rows[0].locked;
    if (!locked) return;
    await db.query('SELECT expire_emergency_notifications()');
    const unsent=await db.query('SELECT id,user_id,type,title,data,created_at FROM notifications WHERE socket_sent_at IS NULL ORDER BY id LIMIT 100');
    for(const notification of unsent.rows) {
      getIO()?.to(`user_${notification.user_id}`).emit('notification',notification);
      await db.query('UPDATE notifications SET socket_sent_at=CURRENT_TIMESTAMP WHERE id=$1',[notification.id]);
    }
    // Do not deliver old notifications when a user signs into a new installation.
    await db.query(`INSERT INTO push_deliveries(notification_id,device_id,token)
      SELECT n.id,d.id,d.token FROM notifications n JOIN push_devices d ON d.user_id=n.user_id AND d.active
      JOIN users u ON u.id=n.user_id AND u.is_active
      WHERE n.created_at>=d.updated_at AND n.created_at>CURRENT_TIMESTAMP-INTERVAL '1 day'
      ON CONFLICT(notification_id,device_id) DO NOTHING`);
    if (process.env.PUSH_ENABLED!=='true') return;
    const pending=await db.query(`SELECT p.*,n.type,n.data FROM push_deliveries p JOIN notifications n ON n.id=p.notification_id
      JOIN push_devices d ON d.id=p.device_id AND d.active AND d.user_id=n.user_id AND d.token=p.token
      JOIN users u ON u.id=n.user_id AND u.is_active
      WHERE p.status='pending' AND p.attempts<5 AND p.next_attempt_at<=CURRENT_TIMESTAMP ORDER BY p.id LIMIT 50`);
    if(pending.rows.length) {
      // At-most-once on uncertain network outcomes: never blindly resend accepted pushes.
      const ids=pending.rows.map(row=>row.id);
      await db.query("UPDATE push_deliveries SET status='unknown',attempts=attempts+1,last_error='Awaiting provider response' WHERE id=ANY($1::int[])",[ids]);
      const {response,data}=await expoRequest('send',pending.rows.map(row=>({to:row.token,title:'HelpEarly',body:'You have a new marketplace update.',sound:'default',channelId:'marketplace',data:{notification_id:row.notification_id,type:row.type,...row.data}})));
      if(!response.ok) {
        const retry=response.status===429 || response.status>=500;
        await db.query(`UPDATE push_deliveries SET status=$1,last_error=$2,next_attempt_at=CURRENT_TIMESTAMP+INTERVAL '1 minute' WHERE id=ANY($3::int[])`,[retry?'pending':'failed',`Provider HTTP ${response.status}`,ids]);
      } else {
        const tickets=Array.isArray(data.data)?data.data:[data.data];
        for(let index=0;index<pending.rows.length;index++) {
          const row=pending.rows[index],ticket=tickets[index];
          if(ticket?.status==='ok' && ticket.id) await db.query("UPDATE push_deliveries SET status='ticket',ticket_id=$1,last_error=NULL,next_attempt_at=CURRENT_TIMESTAMP+INTERVAL '15 minutes' WHERE id=$2",[ticket.id,row.id]);
          else {
            const code=ticket?.details?.error || 'Invalid provider response';
            await db.query("UPDATE push_deliveries SET status='failed',last_error=$1 WHERE id=$2",[code,row.id]);
            if(code==='DeviceNotRegistered') await db.query('UPDATE push_devices SET active=false WHERE id=$1 AND token=$2',[row.device_id,row.token]);
          }
        }
      }
    }
    const waiting=await db.query("SELECT * FROM push_deliveries WHERE status='ticket' AND next_attempt_at<=CURRENT_TIMESTAMP ORDER BY id LIMIT 100");
    if(waiting.rows.length) {
      const {response,data}=await expoRequest('getReceipts',{ids:waiting.rows.map(row=>row.ticket_id)});
      if(response.ok) for(const row of waiting.rows) {
        const receipt=data.data?.[row.ticket_id];
        if(!receipt) { await db.query("UPDATE push_deliveries SET status=CASE WHEN created_at<CURRENT_TIMESTAMP-INTERVAL '24 hours' THEN 'unknown' ELSE 'ticket' END,next_attempt_at=CURRENT_TIMESTAMP+INTERVAL '15 minutes' WHERE id=$1",[row.id]); continue; }
        await db.query('UPDATE push_deliveries SET status=$1,last_error=$2 WHERE id=$3',[receipt.status==='ok'?'delivered':'failed',receipt.details?.error || null,row.id]);
        if(receipt.details?.error==='DeviceNotRegistered') await db.query('UPDATE push_devices SET active=false WHERE id=$1 AND token=$2',[row.device_id,row.token]);
      }
    }
    await db.query("UPDATE push_deliveries SET status='failed',last_error='Retry limit reached' WHERE status='pending' AND attempts>=5");
  } finally {
    if(locked) await db.query('SELECT pg_advisory_unlock(724032)');
    db.release();
  }
}

function startNotifications() {
  let running=false;
  const tick=async()=>{if(running)return; running=true;try{await flushNotifications();}catch(error){console.error('Notification dispatcher unavailable:',error.code || error.name);}finally{running=false;}};
  tick();
  const timer=setInterval(tick,2000);
  timer.unref();
  return ()=>clearInterval(timer);
}
module.exports={startNotifications,flushNotifications};
