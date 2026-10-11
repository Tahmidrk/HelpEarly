const pool = require('../config/db');
const { getIO } = require('../socket/chat');
const { activeRole, conversationScope } = require('../utils/marketplaceRole');
const fail = (status,message) => Object.assign(new Error(message),{status});
const respond = (res,error) => res.status(error.status || 503).json({message:error.status ? error.message : 'Chat is temporarily unavailable'});
// Discovery is limited to an actual booking or job application; no private directory.
const relationship = `EXISTS(SELECT 1 FROM bookings b JOIN helpers h ON h.id=b.helper_id WHERE b.user_id=u.id AND h.user_id=$1)
 OR EXISTS(SELECT 1 FROM job_applications a JOIN helpers h ON h.id=a.helper_id JOIN jobs j ON j.id=a.job_id WHERE j.user_id=u.id AND h.user_id=$1)`;
async function conversationFor(req,targetId) {
 const role=activeRole(req), otherRole=role==='helper'?'household':'helper';
 if (!['household','helper'].includes(role)) throw fail(403,'Marketplace chat requires a household or worker role');
 if (!Number.isInteger(Number(targetId)) || Number(targetId)<=0) throw fail(400,'Valid contact is required');
 if (Number(targetId)===Number(req.user.id)) throw fail(400,'You cannot message yourself');
 const target=(await pool.query(`SELECT u.id,u.name,u.avatar_url,u.role,h.id AS helper_profile_id FROM users u LEFT JOIN helpers h ON h.user_id=u.id
 WHERE u.id=$1 AND u.is_active AND u.role IN($2,'both')
 AND ($2='household' OR h.id IS NOT NULL)`,[targetId,otherRole])).rows[0];
 if (!target) throw fail(403,'Contact is unavailable for this role');
 const db=await pool.connect();
 try {
  await db.query('BEGIN');
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[[Number(req.user.id),Number(targetId)].sort((a,b)=>a-b).join(':')]);
  let conversation=(await db.query(`SELECT c.* FROM conversations c WHERE ${conversationScope('c','$1','$3')} AND (c.user1_id=$2 OR c.user2_id=$2) LIMIT 1`,[req.user.id,targetId,role])).rows[0];
  if (!conversation) {
   if(role==='household' && !(await db.query('SELECT 1 FROM helper_categories hc JOIN categories cat ON cat.id=hc.category_id WHERE hc.helper_id=$1 AND cat.is_visible',[target.helper_profile_id])).rows.length)throw fail(403,'Worker has no available service category');
   if (role==='helper' && !(await db.query(`SELECT 1 FROM users u WHERE u.id=$2 AND (${relationship})`,[req.user.id,targetId])).rows.length) throw fail(403,'Contact households through an existing booking or job interaction');
   conversation=(await db.query('INSERT INTO conversations(user1_id,user2_id,user1_role,user2_role) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,targetId,role,otherRole])).rows[0];
  }
  await db.query('COMMIT');
  return {...conversation,other_id:target.id,other_name:target.name,other_avatar:target.avatar_url,other_role:otherRole,other_helper_profile_id:target.helper_profile_id,is_other_active:true};
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
exports.getContacts=async(req,res)=>{
 try{
  if(activeRole(req)!=='helper') throw fail(403,'Worker contact search only');
  const q=typeof req.query.q==='string'?req.query.q.trim().slice(0,100):'';
  res.json((await pool.query(`SELECT u.id,u.name,u.avatar_url FROM users u WHERE u.id<>$1 AND u.is_active AND u.role IN('household','both') AND (${relationship}) AND u.name ILIKE $2 ORDER BY u.name LIMIT 30`,[req.user.id,'%'+q+'%'])).rows);
 }catch(error){respond(res,error);}
};
exports.getConversations=async(req,res)=>{
 try{res.json((await pool.query(`SELECT c.*,CASE WHEN c.user1_id=$1 THEN c.user2_id ELSE c.user1_id END AS other_id,
 CASE WHEN u.is_active THEN u.name ELSE 'Unavailable' END AS other_name,u.avatar_url AS other_avatar,
 CASE WHEN c.user1_id=$1 THEN c.user2_role ELSE c.user1_role END AS other_role,h.id AS other_helper_profile_id,u.is_active AS is_other_active,
 (SELECT content FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1) AS last_message,
 (SELECT COUNT(*) FROM messages WHERE conversation_id=c.id AND sender_id<>$1 AND NOT is_read) AS unread_count
 FROM conversations c JOIN users u ON u.id=CASE WHEN c.user1_id=$1 THEN c.user2_id ELSE c.user1_id END LEFT JOIN helpers h ON h.user_id=u.id
 WHERE ${conversationScope()} ORDER BY c.last_message_at DESC,c.id DESC`,[req.user.id,activeRole(req)])).rows);}catch(error){respond(res,error);}
};
exports.getMessages=async(req,res)=>{
 try{
  const id=Number(req.params.conversationId),limit=Math.min(1000,Math.max(1,Number(req.query.limit)||50)),page=Math.max(1,Number(req.query.page)||1);
  if(!Number.isInteger(id)||!Number.isInteger(limit)||!Number.isInteger(page)) throw fail(400,'Invalid conversation or pagination');
  if(!(await pool.query(`SELECT c.id FROM conversations c WHERE c.id=$3 AND ${conversationScope()}`,[req.user.id,activeRole(req),id])).rows.length) throw fail(403,'Conversation is unavailable for this role');
  await pool.query('UPDATE messages SET is_read=true WHERE conversation_id=$1 AND sender_id<>$2 AND NOT is_read',[id,req.user.id]);
  res.json((await pool.query(`SELECT * FROM(SELECT m.*,u.name AS sender_name,u.avatar_url AS sender_avatar FROM messages m JOIN users u ON u.id=m.sender_id WHERE conversation_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3) recent ORDER BY created_at,id`,[id,limit,(page-1)*limit])).rows);
 }catch(error){respond(res,error);}
};
exports.getOrCreateConversation=async(req,res)=>{try{res.json(await conversationFor(req,req.params.userId));}catch(error){respond(res,error);}};
exports.sendMessage=async(req,res)=>{
 try{
  const {recipient_id,content}=req.body;
  if(typeof content!=='string'||!content.trim()||content.length>10000) throw fail(400,'Message must contain 1–10000 characters');
  const conv=await conversationFor(req,recipient_id);
  const db=await pool.connect();let message;
  try{await db.query('BEGIN');message=(await db.query('INSERT INTO messages(conversation_id,sender_id,content) VALUES($1,$2,$3) RETURNING *',[conv.id,req.user.id,content.trim()])).rows[0];await db.query('UPDATE conversations SET last_message_at=CURRENT_TIMESTAMP WHERE id=$1',[conv.id]);await db.query('COMMIT');}
  catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  const role=activeRole(req),other=role==='helper'?'household':'helper';
  getIO()?.to(`user_${req.user.id}_${role}`).to(`user_${recipient_id}_${other}`).emit('new_message',message);
  res.status(201).json({message,conversationId:conv.id});
 }catch(error){respond(res,error);}
};
