const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
let io;
async function authenticate(socket) {
  const decoded = jwt.verify(socket.handshake.auth?.token,process.env.JWT_SECRET);
  const result = await pool.query('SELECT id FROM users WHERE id=$1 AND is_active=true',[decoded.id]);
  if (!result.rows.length) throw new Error('Account unavailable');
  socket.user = decoded;
}
function initializeChat(server) {
  const origins = (process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:8081').split(',').map(s=>s.trim());
  if(process.env.NODE_ENV!=='production') origins.push('http://localhost:8081','http://127.0.0.1:8081');
  io = new Server(server,{cors:{origin:origins,methods:['GET','POST'],credentials:true}});
  io.use((socket,next)=>authenticate(socket).then(()=>next()).catch(()=>next(new Error('Authentication required'))));
  io.on('connection',socket=>{
    const userId = socket.user.id;
    socket.join(`user_${userId}`);
    const expiry=setTimeout(()=>socket.disconnect(true),Math.max(0,socket.user.exp*1000-Date.now()));expiry.unref();
    socket.on('disconnect',()=>clearTimeout(expiry));
    socket.use((packet,next)=>authenticate(socket).then(()=>next()).catch(()=>{ next(new Error('Authentication required')); socket.disconnect(true); }));
    const conversation = async id => {
      if (!Number.isInteger(Number(id))) return null;
      const result = await pool.query('SELECT * FROM conversations WHERE id=$1 AND (user1_id=$2 OR user2_id=$2)',[id,userId]);
      return result.rows[0];
    };
    const handle = (event,fn) => socket.on(event,async(data,ack)=>{
      try { const value=await fn(data || {}); if(typeof ack==='function') ack(value || {ok:true}); }
      catch { if(typeof ack==='function') ack({error:'Conversation unavailable'}); }
    });
    handle('join_conversation',async id=>{ if(!await conversation(id)) throw new Error(); socket.join(`conversation_${id}`); });
    handle('send_message',async()=>({error:'Send messages through the authenticated messages API'}));
    handle('typing',async({conversationId})=>{
      if(!await conversation(conversationId)) throw new Error();
      socket.to(`conversation_${conversationId}`).emit('user_typing',{userId,conversationId});
    });
    handle('mark_read',async({conversationId})=>{
      if(!await conversation(conversationId)) throw new Error();
      await pool.query('UPDATE messages SET is_read=true WHERE conversation_id=$1 AND sender_id<>$2',[conversationId,userId]);
      socket.to(`conversation_${conversationId}`).emit('messages_read',{conversationId,readBy:userId});
    });
  });
  return io;
}
module.exports={initializeChat,getIO:()=>io};
