const pool = require('../config/db');
const { fail, fields, text, mutation } = require('../utils/admin');
const roles = ['household','helper','both','admin'];
const target = req => req.params.id || 'new';
const wrap = work => async (req,res,next) => { try { res.json(await work(req)); } catch(error) { next(error); } };
function pagination(req) { return { limit: Number(req.query.limit || 20), offset: (Number(req.query.page || 1)-1)*Number(req.query.limit || 20) }; }

exports.getStats = wrap(async () => {
  const { rows:[stats] } = await pool.query(`SELECT
    (SELECT count(*)::int FROM users) users,
    (SELECT count(*)::int FROM helpers) helpers,
    (SELECT count(*)::int FROM reviews) reviews_total,
    (SELECT avg(rating) FROM reviews WHERE NOT is_hidden) avg_rating,
    (SELECT count(*)::int FROM complaints) complaints,
    (SELECT count(*)::int FROM emergency_requests) emergencies,
    (SELECT count(*)::int FROM job_applications) proposals,
    (SELECT coalesce(sum(amount),0) FROM payments WHERE status='completed') revenue`);
  const userBreakdown = (await pool.query(`SELECT count(*)::int total,
    count(*) FILTER(WHERE is_active)::int active, count(*) FILTER(WHERE NOT is_active)::int banned,
    count(*) FILTER(WHERE role='household')::int households, count(*) FILTER(WHERE role='helper')::int helpers,
    count(*) FILTER(WHERE role='both')::int dual, count(*) FILTER(WHERE role='admin')::int admins FROM users`)).rows[0];
  const bookings = (await pool.query("SELECT count(*)::int total,count(*) FILTER(WHERE status='pending')::int pending,count(*) FILTER(WHERE status='completed')::int completed FROM bookings")).rows[0];
  const jobs = (await pool.query("SELECT count(*)::int total,count(*) FILTER(WHERE status='open' AND NOT is_hidden)::int open FROM jobs")).rows[0];
  return { ...stats, userBreakdown, bookings, jobs, reviews:{total:stats.reviews_total,avgRating:stats.avg_rating===null?null:Number(stats.avg_rating)} };
});
exports.getUsers = wrap(async req => {
  const params=[], where=[];
  if (req.query.role) { if(!roles.includes(req.query.role)) throw fail(400,'Invalid role'); params.push(req.query.role);where.push(`u.role=$${params.length}`); }
  if (req.query.search) { params.push(`%${text(req.query.search,200)}%`);where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
  if (req.query.active) { if(!['true','false'].includes(req.query.active)) throw fail(400,'Invalid account filter');params.push(req.query.active==='true');where.push(`u.is_active=$${params.length}`); }
  const from=`FROM users u LEFT JOIN helpers h ON h.user_id=u.id ${where.length?'WHERE '+where.join(' AND '):''}`;
  const total=Number((await pool.query(`SELECT count(*) ${from}`,params)).rows[0].count);
  const {limit,offset}=pagination(req);
  const users=(await pool.query(`SELECT u.id,u.name,u.email,u.role,u.is_active,u.created_at,h.id helper_profile_id,h.is_verified ${from} ORDER BY u.id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,limit,offset])).rows;
  return {users,total};
});
exports.updateUser = mutation('user.update',target,async(db,req)=>{
  fields(req.body,['is_active','role']); const {is_active,role}=req.body;
  if((is_active!==undefined && typeof is_active!=='boolean') || (role!==undefined && !roles.includes(role))) throw fail(400,'Invalid account update');
  if(Number(req.params.id)===req.user.id && (is_active===false || (role && role!=='admin'))) throw fail(409,'You cannot remove your own admin access');
  if(['helper','both'].includes(role) && !(await db.query('SELECT 1 FROM helpers WHERE user_id=$1',[req.params.id])).rows.length) throw fail(409,'Worker roles require an existing worker profile');
  const row=(await db.query('UPDATE users SET is_active=COALESCE($1,is_active),role=COALESCE($2,role),updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING id,name,role,is_active',[is_active,role,req.params.id])).rows[0];
  if(!row) throw fail(404,'User not found');return {data:row,disconnectUser:row.id};
});
exports.deleteUser = mutation('user.delete',target,async()=>{throw fail(409,'User deletion is disabled to preserve history; deactivate the account instead');});
exports.verifyHelper = mutation('worker.verify',target,async(db,req)=>{
  fields(req.body,['is_verified']);if(typeof req.body.is_verified!=='boolean') throw fail(400,'Verification must be true or false');
  const row=(await db.query('UPDATE helpers SET is_verified=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING id,user_id,is_verified',[req.body.is_verified,req.params.id])).rows[0];
  if(!row) throw fail(404,'Worker not found');return row;
});
exports.updateHelper = mutation('worker.moderate',target,async(db,req)=>{
  fields(req.body,['bio','is_available']);
  if(req.body.bio!==undefined) text(req.body.bio,5000);
  if(req.body.is_available!==undefined && typeof req.body.is_available!=='boolean') throw fail(400,'Availability must be boolean');
  const row=(await db.query('UPDATE helpers SET bio=COALESCE($1,bio),is_available=COALESCE($2,is_available),updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING id,user_id,bio,is_available',[req.body.bio,req.body.is_available,req.params.id])).rows[0];
  if(!row) throw fail(404,'Worker not found');
  await db.query("SELECT enqueue_notification($1,$2,'moderation_updated','Worker profile moderation updated','{}')",[row.user_id,'admin:'+req.requestId]);
  return row;
});
// Read models exclude chat, AI history, NID, addresses and contact details.
const monitors={
  workers:{sql:'SELECT h.id,u.name,u.id user_id,u.is_active,h.is_verified,h.is_available,h.bio,h.hourly_rate,h.experience_years FROM helpers h JOIN users u ON u.id=h.user_id',search:'u.name'},
  categories:{sql:'SELECT c.id,c.name,c.icon,c.description,c.is_visible FROM categories c',search:'c.name'},
  services:{sql:'SELECT s.id,s.helper_id,u.name worker_name,s.service_name,s.description,s.price,s.is_hidden,c.name category_name,c.id category_id FROM helper_services s JOIN helpers h ON h.id=s.helper_id JOIN users u ON u.id=h.user_id JOIN categories c ON c.id=s.category_id',search:'s.service_name'},
  bookings:{sql:'SELECT b.id,b.status,b.total_price,b.booking_date,b.created_at,u.name client_name,hu.name worker_name FROM bookings b JOIN users u ON u.id=b.user_id JOIN helpers h ON h.id=b.helper_id JOIN users hu ON hu.id=h.user_id',search:'u.name',status:'b.status',values:['pending','confirmed','in_progress','completed','cancelled']},
  jobs:{sql:'SELECT j.id,j.title,j.description,j.status,j.budget,j.is_hidden,j.created_at,u.name poster_name,(SELECT count(*)::int FROM job_applications a WHERE a.job_id=j.id) proposal_count FROM jobs j JOIN users u ON u.id=j.user_id',search:'j.title',status:'j.status',values:['open','in_progress','completed','cancelled']},
  proposals:{sql:'SELECT a.id,a.job_id,j.title,a.status,a.proposed_price,u.name worker_name,a.created_at FROM job_applications a JOIN jobs j ON j.id=a.job_id JOIN helpers h ON h.id=a.helper_id JOIN users u ON u.id=h.user_id',search:'j.title',status:'a.status',values:['pending','accepted','rejected']},
  emergencies:{sql:"SELECT e.id,CASE WHEN e.status='pending' AND e.expires_at<=CURRENT_TIMESTAMP THEN 'expired' ELSE e.status END status,e.category_id,c.name category_name,e.helper_id,e.booking_id,e.created_at,e.expires_at,u.name household_name FROM emergency_requests e JOIN users u ON u.id=e.household_id LEFT JOIN categories c ON c.id=e.category_id",search:'u.name',status:"CASE WHEN e.status='pending' AND e.expires_at<=CURRENT_TIMESTAMP THEN 'expired' ELSE e.status END",values:['pending','accepted','cancelled','expired']},
  reviews:{sql:'SELECT r.id,r.helper_id,r.rating,r.comment,r.is_hidden,r.created_at,u.name reviewer_name FROM reviews r JOIN users u ON u.id=r.user_id',search:'r.comment'},
  complaints:{sql:'SELECT c.id,c.subject,c.description,c.status,c.admin_notes,c.created_at,cu.name complainant_name,au.name accused_name FROM complaints c JOIN users cu ON cu.id=c.complainant_id JOIN users au ON au.id=c.accused_id',search:'c.subject',status:'c.status',values:['open','reviewing','resolved','dismissed']},
  audit:{sql:'SELECT a.id,a.actor_id,u.name actor_name,a.action,a.target,a.outcome,a.created_at,a.request_id FROM admin_audit_logs a LEFT JOIN users u ON u.id=a.actor_id',search:'a.action',status:'a.outcome',values:['SUCCESS','REJECTED','DENIED','FAILED']},
};
exports.monitor = wrap(async req=>{
  const config=monitors[req.params.resource];if(!config) throw fail(404,'Unknown admin resource');
  const where=[],params=[];
  if(req.query.search){params.push(`%${text(req.query.search,200)}%`);where.push(`${config.search} ILIKE $${params.length}`);}
  if(req.query.status){if(!config.values?.includes(req.query.status))throw fail(400,'Invalid status filter');params.push(req.query.status);where.push(`${config.status}=$${params.length}`);}
  const query=config.sql+(where.length?' WHERE '+where.join(' AND '):'');
  const total=Number((await pool.query(`SELECT count(*) FROM (${query}) records`,params)).rows[0].count);
  const {limit,offset}=pagination(req);
  return {rows:(await pool.query(query+` ORDER BY 1 DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,limit,offset])).rows,total};
});
exports.saveCategory = mutation('category.save',target,async(db,req)=>{
  fields(req.body,['name','description','icon','is_visible']);const {name,description,icon,is_visible}=req.body;
  if(name!==undefined)text(name,100,true);if(description!==undefined)text(description,5000);if(icon!==undefined)text(icon,10);
  if(is_visible!==undefined && typeof is_visible!=='boolean')throw fail(400,'Visibility must be boolean');
  if(name!==undefined && (await db.query('SELECT 1 FROM categories WHERE lower(trim(name))=lower($1) AND id<>COALESCE($2,0)',[name.trim(),req.params.id||null])).rows.length)throw fail(409,'A category with that name already exists');
  let row;
  if(req.params.id)row=(await db.query('UPDATE categories SET name=COALESCE($1,name),description=COALESCE($2,description),icon=COALESCE($3,icon),is_visible=COALESCE($4,is_visible) WHERE id=$5 RETURNING *',[name,description,icon,is_visible,req.params.id])).rows[0];
  else {text(name,100,true);row=(await db.query('INSERT INTO categories(name,description,icon,is_visible) VALUES($1,$2,$3,COALESCE($4,true)) RETURNING *',[name.trim(),description||'',icon||'',is_visible])).rows[0];}
  if(!row)throw fail(404,'Category not found');return row;
});
function moderate(table) { return mutation(`${table}.visibility`,target,async(db,req)=>{
  fields(req.body,['is_hidden']);if(typeof req.body.is_hidden!=='boolean')throw fail(400,'Visibility must be boolean');
  const row=(await db.query(`UPDATE ${table} SET is_hidden=$1 WHERE id=$2 RETURNING id,is_hidden`,[req.body.is_hidden,req.params.id])).rows[0];
  if(!row)throw fail(404,'Content not found');
  const owner=(await db.query(`SELECT user_id FROM ${table} WHERE id=$1`,[row.id])).rows[0];
  await db.query("SELECT enqueue_notification($1,$2,'moderation_updated','Content visibility updated','{}')",[owner.user_id,'admin:'+req.requestId]);
  return row;
}); }
exports.moderateJob=moderate('jobs');exports.moderateReview=moderate('reviews');
exports.updateService=mutation('service.moderate',target,async(db,req)=>{
  fields(req.body,['service_name','description','is_hidden']);const {service_name,description,is_hidden}=req.body;
  if(service_name!==undefined)text(service_name,200,true);if(description!==undefined)text(description,5000);
  if(is_hidden!==undefined && typeof is_hidden!=='boolean')throw fail(400,'Visibility must be boolean');
  const row=(await db.query('UPDATE helper_services SET service_name=COALESCE($1,service_name),description=COALESCE($2,description),is_hidden=COALESCE($3,is_hidden) WHERE id=$4 RETURNING id,service_name,description,is_hidden',[service_name,description,is_hidden,req.params.id])).rows[0];
  if(!row)throw fail(404,'Service not found');
  const owner=(await db.query('SELECT h.user_id FROM helpers h JOIN helper_services s ON s.helper_id=h.id WHERE s.id=$1',[row.id])).rows[0];
  await db.query("SELECT enqueue_notification($1,$2,'moderation_updated','Worker service moderation updated','{}')",[owner.user_id,'admin:'+req.requestId]);
  return row;
});
exports.deleteJob=mutation('jobs.delete',target,async()=>{throw fail(409,'Deletion disabled; use reversible content visibility');});
exports.deleteReview=mutation('reviews.delete',target,async()=>{throw fail(409,'Deletion disabled; use reversible content visibility');});
exports.updateComplaint=mutation('complaint.update',target,async(db,req)=>{
  fields(req.body,['status','admin_notes']);const {status,admin_notes}=req.body;
  if(status!==undefined && !['open','reviewing','resolved','dismissed'].includes(status))throw fail(400,'Invalid complaint status');
  if(admin_notes!==undefined)text(admin_notes,5000);
  const row=(await db.query('UPDATE complaints SET status=COALESCE($1,status),admin_notes=COALESCE($2,admin_notes),updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING id,status,admin_notes',[status,admin_notes,req.params.id])).rows[0];
  if(!row)throw fail(404,'Complaint not found');return row;
});
