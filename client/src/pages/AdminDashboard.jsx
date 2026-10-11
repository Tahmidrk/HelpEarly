import { useState, useEffect, useRef } from 'react';
import { adminAPI } from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';

export const adminTabs = {
  overview: {label:'Overview'},
  users: {label:'Accounts',columns:['id','name','email','role','is_active'],statuses:[]},
  workers: {label:'Workers',columns:['id','name','is_active','is_verified','is_available','bio','hourly_rate','experience_years']},
  categories: {label:'Categories',columns:['id','name','icon','description','is_visible']},
  services: {label:'Services',columns:['id','worker_name','category_name','service_name','description','price','is_hidden']},
  bookings: {label:'Bookings',columns:['id','client_name','worker_name','status','total_price','booking_date'],statuses:['pending','confirmed','in_progress','completed','cancelled']},
  jobs: {label:'Jobs',columns:['id','poster_name','title','description','status','budget','proposal_count','is_hidden'],statuses:['open','in_progress','completed','cancelled']},
  proposals: {label:'Proposals',columns:['id','job_id','title','worker_name','status','proposed_price'],statuses:['pending','accepted','rejected']},
  emergencies: {label:'Emergencies',columns:['id','household_name','category_name','status','helper_id','booking_id','expires_at'],statuses:['pending','accepted','cancelled','expired']},
  complaints: {label:'Complaints',columns:['id','complainant_name','accused_name','subject','description','status','admin_notes'],statuses:['open','reviewing','resolved','dismissed']},
  reviews: {label:'Reviews',columns:['id','reviewer_name','helper_id','rating','comment','is_hidden']},
  audit: {label:'Audit log',columns:['id','actor_id','actor_name','action','target','outcome','created_at'],statuses:['SUCCESS','REJECTED','DENIED','FAILED']},
};
const label = value => value.replaceAll('_',' ');
const display = value => value===true?'Yes':value===false?'No':value===null||value===undefined?'—':String(value);
function AdminDialog({children,label,onClose}) {
  const ref=useRef(null);
  useEffect(()=>{const previous=document.activeElement;ref.current?.querySelector('button,input,textarea,select')?.focus();return ()=>previous?.focus?.();},[]);
  const keys=e=>{
    if(e.key==='Escape'){e.preventDefault();onClose();}
    if(e.key==='Tab'){
      const items=[...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')];
      const first=items[0],last=items.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  };
  return <div ref={ref} role="dialog" aria-modal="true" aria-label={label} onKeyDown={keys} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}><div className="glass-card-static" style={{width:'100%',maxWidth:640,maxHeight:'90vh',overflowY:'auto'}}>{children}</div></div>;
}
export function AdminTable({tab,rows,busy,actorId,onAction,onEdit}) {
  const config=adminTabs[tab];
  return <div style={{overflowX:'auto'}}><table className="data-table"><thead><tr>{config.columns.map(key=><th key={key}>{label(key)}</th>)}<th>Actions</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.id}>{config.columns.map(key=><td key={key} style={{maxWidth:320,overflowWrap:'anywhere'}}>{display(row[key])}</td>)}<td>
      {tab==='users' && <><button className="btn btn-sm btn-secondary" disabled={busy||row.id===actorId} onClick={()=>onAction('account',row,{is_active:!row.is_active})}>{row.is_active?'Deactivate':'Activate'}</button><select aria-label={`Role for ${row.name}`} disabled={busy||row.id===actorId} value={row.role} onChange={e=>onAction('account',row,{role:e.target.value})}>{['household','helper','both','admin'].map(role=><option key={role}>{role}</option>)}</select></>}
      {tab==='workers' && <><button className="btn btn-sm btn-secondary" disabled={busy} onClick={()=>onAction('verify',row,{is_verified:!row.is_verified})}>{row.is_verified?'Unverify':'Verify'}</button><button className="btn btn-sm btn-secondary" disabled={busy} onClick={()=>onEdit(row)}>Moderate profile</button></>}
      {['categories','services','complaints'].includes(tab) && <button className="btn btn-sm btn-secondary" disabled={busy} onClick={()=>onEdit(row)}>Manage</button>}
      {['jobs','reviews'].includes(tab) && <button className="btn btn-sm btn-secondary" disabled={busy} onClick={()=>onAction('visibility',row,{is_hidden:!row.is_hidden})}>{row.is_hidden?'Restore visibility':'Hide content'}</button>}
      {['bookings','proposals','emergencies','audit'].includes(tab) && <span>Read only</span>}
    </td></tr>)}</tbody></table>{!rows.length && <p role="status" className="empty-state">No matching records.</p>}</div>;
}
export default function AdminDashboard() {
  const {user}=useAuth(); const revision=useSync('admin');
  const [tab,setTab]=useState('overview'),[rows,setRows]=useState([]),[total,setTotal]=useState(0),[stats,setStats]=useState(null);
  const [filters,setFilters]=useState({search:'',status:'',role:'',active:''}),[draftSearch,setDraftSearch]=useState(''),[page,setPage]=useState(1);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[editor,setEditor]=useState(null),[form,setForm]=useState({});
  const [confirmation,setConfirmation]=useState(null);
  useEffect(()=>{
    let current=true;setLoading(true);setError('');
    const params={page,limit:20,...Object.fromEntries(Object.entries(filters).filter(([,v])=>v))};
    const load=tab==='overview'?adminAPI.getStats():tab==='users'?adminAPI.getUsers(params):adminAPI.monitor(tab,params);
    load.then(data=>{if(!current)return;if(tab==='overview')setStats(data);else{setRows(data.users||data.rows);setTotal(data.total);}}).catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setLoading(false);});
    return ()=>{current=false;};
  },[tab,filters,page,revision,refresh]);
  const changeTab=key=>{setTab(key);setRows([]);setTotal(0);setPage(1);setFilters({search:'',status:'',role:'',active:''});setDraftSearch('');setEditor(null);};
  const run=async work=>{if(busy)return;setBusy(true);setError('');try{await work();setEditor(null);setRefresh(v=>v+1);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const act=(action,row,data)=>{
    setConfirmation({message:`Confirm ${action} change for record #${row.id}? Existing history will be preserved.`,work:()=>action==='account'?adminAPI.updateUser(row.id,data):action==='verify'?adminAPI.verifyHelper(row.id,data.is_verified):adminAPI.moderate(tab,row.id,data)});
  };
  const edit=row=>{setEditor(row);setForm(tab==='categories'?{name:row.name||'',description:row.description||'',icon:row.icon||'',is_visible:row.is_visible??true}:tab==='workers'?{bio:row.bio||'',is_available:row.is_available}:tab==='services'?{service_name:row.service_name,description:row.description||'',is_hidden:row.is_hidden}:{status:row.status,admin_notes:row.admin_notes||''});};
  const save=e=>{e.preventDefault();setConfirmation({message:'Save this administrative change?',work:()=>tab==='categories'?adminAPI.saveCategory(editor.id,form):tab==='workers'?adminAPI.updateHelper(editor.id,form):adminAPI.moderate(tab,editor.id,form)});};
  const filter=(key,value)=>{setPage(1);setFilters(old=>({...old,[key]:value}));};
  return <div className="page"><div className="container">
    <div className="page-header animate-fade-in"><h1>Admin Dashboard <i className="fas fa-shield-alt"></i></h1><p>Shared marketplace management · Web and Android records</p></div>
    <div className="tabs" style={{flexWrap:'wrap'}}>{Object.entries(adminTabs).map(([key,c])=><button key={key} className={`tab ${tab===key?'active':''}`} onClick={()=>changeTab(key)}>{c.label}</button>)}</div>
    {error && <p role="alert" className="alert alert-error">{error} <button onClick={()=>setRefresh(v=>v+1)}>Retry</button></p>}
    {tab!=='overview' && <form onSubmit={e=>{e.preventDefault();filter('search',draftSearch);}} style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:20}}>
      <input className="form-input" aria-label="Search records" placeholder="Search records" maxLength={200} value={draftSearch} onChange={e=>setDraftSearch(e.target.value)}/><button className="btn btn-secondary" type="submit">Search</button>
      {adminTabs[tab].statuses?.length>0 && <select aria-label="Status filter" value={filters.status} onChange={e=>filter('status',e.target.value)}><option value="">All statuses</option>{adminTabs[tab].statuses.map(s=><option key={s}>{s}</option>)}</select>}
      {tab==='users' && <><select aria-label="Role filter" value={filters.role} onChange={e=>filter('role',e.target.value)}><option value="">All roles</option>{['household','helper','both','admin'].map(r=><option key={r}>{r}</option>)}</select><select aria-label="Account state" value={filters.active} onChange={e=>filter('active',e.target.value)}><option value="">All accounts</option><option value="true">Active</option><option value="false">Inactive</option></select></>}
      {tab==='categories' && <button type="button" className="btn btn-primary" onClick={()=>edit({})}>Add category</button>}
    </form>}
    {loading ? <LoadingSpinner/> : tab==='overview' ? stats && <div className="grid grid-4 stagger-children">
      {Object.entries({Accounts:stats.users,Workers:stats.helpers,Bookings:stats.bookings.total,'Completed services':stats.bookings.completed,Jobs:stats.jobs.total,Proposals:stats.proposals,Complaints:stats.complaints,Reviews:stats.reviews.total,Emergencies:stats.emergencies,'Active accounts':stats.userBreakdown.active,'Dual accounts':stats.userBreakdown.dual,'Completed payments (৳)':stats.revenue}).map(([name,value])=><div className="stat-card" key={name}><div className="stat-info"><h3>{value}</h3><p>{name}</p></div></div>)}
    </div> : <><AdminTable tab={tab} rows={rows} busy={busy} actorId={user?.id} onAction={act} onEdit={edit}/><div style={{display:'flex',gap:16,marginTop:20}}><button disabled={page===1||busy} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} · {total} matching records</span><button disabled={page*20>=total||busy} onClick={()=>setPage(p=>p+1)}>Next</button></div></>}
    {editor && !confirmation && <AdminDialog label="Manage record" onClose={()=>{if(!busy)setEditor(null);}}><h2>Manage {adminTabs[tab].label} {editor.id?`#${editor.id}`:''}</h2>
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      {tab==='complaints' && <p>{editor.subject}: {editor.description}</p>}
      <form onSubmit={save}>{Object.entries(form).map(([key,value])=><label key={key} className="form-group" style={{display:'block',marginBottom:12}}>{label(key)}
        {typeof value==='boolean'?<input type="checkbox" checked={value} onChange={e=>setForm({...form,[key]:e.target.checked})}/>:key==='status'?<select value={value} onChange={e=>setForm({...form,[key]:e.target.value})}>{adminTabs.complaints.statuses.map(s=><option key={s}>{s}</option>)}</select>:['description','bio','admin_notes'].includes(key)?<textarea className="form-input" maxLength={5000} value={value} onChange={e=>setForm({...form,[key]:e.target.value})}/>:<input className="form-input" required={['name','service_name'].includes(key)} maxLength={key==='icon'?10:key==='name'?100:200} value={value} onChange={e=>setForm({...form,[key]:e.target.value})}/>}</label>)}
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Saving…':'Save'}</button> <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setEditor(null)}>Cancel</button>
      </form></AdminDialog>}
    {confirmation && <AdminDialog label="Confirm administrative change" onClose={()=>setConfirmation(null)}><h2>Confirm change</h2><p>{confirmation.message}</p><button className="btn btn-primary" onClick={()=>{const work=confirmation.work;setConfirmation(null);run(work);}}>Confirm</button> <button className="btn btn-secondary" onClick={()=>setConfirmation(null)}>Cancel</button></AdminDialog>}
  </div></div>;
}
