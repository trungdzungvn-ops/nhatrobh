'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, X, RefreshCw, Save, Search, CreditCard, Pencil, UserRound, Receipt, Trash2 } from 'lucide-react'

type Room = {
  id:string; room_code:string; room_name:string|null; monthly_rent:number; deposit:number;
  status:'occupied'|'vacant'|'maintenance'; tenant?:string; phone?:string; tenant_id?:string; contract_id?:string
}
type Meter = { id?:string; room_id:string; billing_month:string; electricity_old:number; electricity_new:number; water_old:number; water_new:number; electricity_unit_price:number; water_unit_price:number; electricity_amount?:number; water_amount?:number }
type Invoice = { id:string; room_id:string; room_code?:string; billing_month:string; invoice_number:string|null; room_amount:number; electricity_amount:number; water_amount:number; service_amount:number; other_amount:number; discount_amount:number; total_amount:number; paid_amount:number; status:string; due_date:string|null }
type Setting = { setting_key:string; setting_value:string }
type Summary = {month:string; invoice_count:number; room_total:number; electricity_total:number; water_total:number; service_total:number; other_total:number; total_amount:number; paid_amount:number; debt_amount:number}
  type UserRole = 'admin'|'viewer'

const money=(n:number)=>Number(n||0).toLocaleString('vi-VN')+' ₫'
const monthKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
const monthLabel=(s:string)=>{const [y,m]=s.slice(0,10).split('-');return `${m}/${y}`}
const URL=process.env.NEXT_PUBLIC_SUPABASE_URL||''
const KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||''

function getAccessToken(){
  if(typeof window==='undefined') return ''
  return localStorage.getItem('nhatro_access_token')||''
}

async function sb(path:string, options:RequestInit={}){
  if(!URL||!KEY) throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trên Vercel.')
  const token=getAccessToken()
  if(!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
  const res=await fetch(`${URL}/rest/v1/${path}`,{...options,headers:{apikey:KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:options.method==='POST'?'return=representation':'return=minimal',...(options.headers||{})}})
  if(!res.ok) throw new Error(await res.text())
  const text=await res.text(); return text?JSON.parse(text):null
}

async function authLogin(email:string,password:string){
  const res=await fetch(`${URL}/auth/v1/token?grant_type=password`,{
    method:'POST',
    headers:{apikey:KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  })
  const data=await res.json()
  if(!res.ok) throw new Error(data.error_description||data.msg||data.message||'Email hoặc mật khẩu không đúng.')
  localStorage.setItem('nhatro_access_token',data.access_token)
  localStorage.setItem('nhatro_user_email',email)
  return data
}

async function authLogout(){
  const token=getAccessToken()
  if(token){
    await fetch(`${URL}/auth/v1/logout`,{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${token}`}})
  }
  localStorage.removeItem('nhatro_access_token')
  localStorage.removeItem('nhatro_user_email')
}

async function getMyRole(){
  const token=getAccessToken()
  if(!token) return 'viewer' as UserRole
  const res=await fetch(`${URL}/rest/v1/nhatro_user_roles?select=role&user_id=eq.${encodeURIComponent(getUserId())}&limit=1`,{
    headers:{apikey:KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'}
  })
  if(!res.ok) return 'viewer' as UserRole
  const rows=await res.json()
  return (rows?.[0]?.role==='admin'?'admin':'viewer') as UserRole
}

function getUserId(){
  if(typeof window==='undefined') return ''
  return localStorage.getItem('nhatro_user_id')||''
}

export default function App(){
  const [tab,setTab]=useState('dashboard'),[rooms,setRooms]=useState<Room[]>([]),[invoices,setInvoices]=useState<Invoice[]>([]),[meters,setMeters]=useState<Meter[]>([]),[settings,setSettings]=useState<Setting[]>([]),[summaries,setSummaries]=useState<Summary[]>([])
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState(''),[month,setMonth]=useState(monthKey())
  const [roomModal,setRoomModal]=useState<Room|null|false>(false),[payModal,setPayModal]=useState<Invoice|null>(null),[invoiceModal,setInvoiceModal]=useState<Room|null>(null)
  const [authReady,setAuthReady]=useState(false),[userEmail,setUserEmail]=useState(''),[userRole,setUserRole]=useState<UserRole>('viewer'),[loginEmail,setLoginEmail]=useState(''),[loginPassword,setLoginPassword]=useState(''),[loginLoading,setLoginLoading]=useState(false)
  const nav=[['dashboard','🏠','Dashboard'],['rooms','🚪','Phòng & người thuê'],['meters','⚡','Điện nước'],['invoices','🧾','Hóa đơn'],['payments','💰','Thu tiền'],['reports','📊','Báo cáo'],['settings','⚙️','Cài đặt']]

  async function loadAll(){
    setLoading(true);setError('')
    try{
      const [rs,cs,is,ms,ss,sum]=await Promise.all([
        sb('nhatro_rooms?select=*&order=room_code'),
        sb('nhatro_contracts?select=id,room_id,tenant_id,status,nhatro_tenants(id,full_name,phone)&status=eq.active'),
        sb(`nhatro_invoice_summary?select=*&billing_month=eq.${month}&order=room_code`),
        sb(`nhatro_meter_readings?select=*&billing_month=eq.${month}&order=created_at`),
        sb('nhatro_settings?select=setting_key,setting_value'),
        sb('nhatro_monthly_summary?select=*&order=month.desc')
      ])
      const map:Record<string,any>={};(cs||[]).forEach((c:any)=>map[c.room_id]=c)
      setRooms((rs||[]).map((r:any)=>({...r,tenant:map[r.id]?.nhatro_tenants?.full_name||'',phone:map[r.id]?.nhatro_tenants?.phone||'',tenant_id:map[r.id]?.tenant_id,contract_id:map[r.id]?.id})))
      setInvoices(is||[]);setMeters(ms||[]);setSettings(ss||[]);setSummaries(sum||[])
    }catch(e:any){setError(e.message||'Không tải được dữ liệu.')}finally{setLoading(false)}
  }
  useEffect(()=>{
    const token=typeof window!=='undefined'?localStorage.getItem('nhatro_access_token'):null
    const email=typeof window!=='undefined'?localStorage.getItem('nhatro_user_email')||'':''
    setUserEmail(email)
    if(token){ getMyRole().then(setUserRole).finally(()=>setAuthReady(true)); loadAll() }
    else {setAuthReady(true);setLoading(false)}
  },[])
  useEffect(()=>{if(authReady&&getAccessToken()) loadAll()},[month,authReady])

  const price=(key:string,fallback:number)=>Number(settings.find(x=>x.setting_key===key)?.setting_value??fallback)
  const canEdit=userRole==='admin'
  const stats=useMemo(()=>{const due=invoices.reduce((s,x)=>s+Number(x.total_amount||0),0),paid=invoices.reduce((s,x)=>s+Number(x.paid_amount||0),0);return{due,paid,debt:Math.max(due-paid,0),occupied:rooms.filter(r=>r.status==='occupied').length,vacant:rooms.filter(r=>r.status==='vacant').length}},[invoices,rooms])
  const filteredRooms=rooms.filter(r=>`${r.room_code} ${r.tenant||''} ${r.phone||''}`.toLowerCase().includes(search.toLowerCase()))

  async function saveRoom(e:React.FormEvent<HTMLFormElement>){if(!canEdit){setError('Tài khoản chỉ xem không được sửa phòng.');return}
    e.preventDefault();const f=new FormData(e.currentTarget);const existing=roomModal||null
    try{
      const code=String(f.get('code')||'').trim(),rent=Number(f.get('rent')||0),deposit=Number(f.get('deposit')||0),status=String(f.get('status')||'occupied')
      const tenantName=String(f.get('tenant')||'').trim(),phone=String(f.get('phone')||'').trim()
      let room:any
      if(existing){
        await sb(`nhatro_rooms?id=eq.${existing.id}`,{method:'PATCH',body:JSON.stringify({room_code:code,room_name:`Phòng ${code}`,monthly_rent:rent,deposit,status,updated_at:new Date().toISOString()})});room=existing
        if(existing.tenant_id){await sb(`nhatro_tenants?id=eq.${existing.tenant_id}`,{method:'PATCH',body:JSON.stringify({full_name:tenantName,phone,updated_at:new Date().toISOString()})})}
        else if(tenantName){const t:any=await sb('nhatro_tenants',{method:'POST',body:JSON.stringify({full_name:tenantName,phone})});await sb('nhatro_contracts',{method:'POST',body:JSON.stringify({room_id:existing.id,tenant_id:t[0].id,start_date:new Date().toISOString().slice(0,10),monthly_rent:rent,deposit,status:'active'})})}
        else if(existing.contract_id&&status!=='occupied'){await sb(`nhatro_contracts?id=eq.${existing.contract_id}`,{method:'PATCH',body:JSON.stringify({status:'ended',end_date:new Date().toISOString().slice(0,10)})})}
        else if(existing.contract_id){await sb(`nhatro_contracts?id=eq.${existing.contract_id}`,{method:'PATCH',body:JSON.stringify({monthly_rent:rent,deposit,status:'active'})})}
      }else{
        room=await sb('nhatro_rooms',{method:'POST',body:JSON.stringify({room_code:code,room_name:`Phòng ${code}`,monthly_rent:rent,deposit,status})});
        if(tenantName){const t:any=await sb('nhatro_tenants',{method:'POST',body:JSON.stringify({full_name:tenantName,phone})});await sb('nhatro_contracts',{method:'POST',body:JSON.stringify({room_id:room[0].id,tenant_id:t[0].id,start_date:new Date().toISOString().slice(0,10),monthly_rent:rent,deposit,status:'active'})})}
      }
      setRoomModal(false);await loadAll()
    }catch(e:any){setError(e.message||'Không lưu được phòng.')}
  }

  async function saveMeter(room:Room,e:React.FormEvent<HTMLFormElement>){if(!canEdit){setError('Tài khoản chỉ xem không được nhập điện nước.');return}e.preventDefault();const f=new FormData(e.currentTarget);try{const old=meters.find(m=>m.room_id===room.id);const payload={room_id:room.id,billing_month:month,electricity_old:Number(f.get('eo')||0),electricity_new:Number(f.get('en')||0),water_old:Number(f.get('wo')||0),water_new:Number(f.get('wn')||0),electricity_unit_price:price('electricity_price',3500),water_unit_price:price('water_price',20000)};if(old?.id)await sb(`nhatro_meter_readings?id=eq.${old.id}`,{method:'PATCH',body:JSON.stringify(payload)});else await sb('nhatro_meter_readings',{method:'POST',body:JSON.stringify(payload)});await loadAll()}catch(e:any){setError(e.message||'Không lưu được chỉ số.')}}

  async function createInvoice(room:Room,extra?:{service:number;other:number;discount:number}){if(!canEdit){setError('Tài khoản chỉ xem không được tạo hóa đơn.');return}try{const m=meters.find(x=>x.room_id===room.id);if(!m)throw new Error('Phòng này chưa có chỉ số điện nước.');if(invoices.some(i=>i.room_id===room.id))throw new Error('Phòng này đã có hóa đơn tháng này.');const electricity=Number(m.electricity_amount??Math.max(m.electricity_new-m.electricity_old,0)*m.electricity_unit_price),water=Number(m.water_amount??Math.max(m.water_new-m.water_old,0)*m.water_unit_price),x=extra||{service:price('service_fee',0),other:0,discount:0};await sb('nhatro_invoices',{method:'POST',body:JSON.stringify({room_id:room.id,billing_month:month,invoice_number:`${room.room_code}-${month.replace('-','')}`,room_amount:Number(room.monthly_rent),electricity_amount:electricity,water_amount:water,service_amount:x.service,other_amount:x.other,discount_amount:x.discount,paid_amount:0,status:'unpaid',due_date:`${month.slice(0,7)}-${String(price('default_due_day',5)).padStart(2,'0')}`})});setInvoiceModal(null);await loadAll()}catch(e:any){setError(e.message||'Không tạo được hóa đơn.')}}

  async function payInvoice(e:React.FormEvent<HTMLFormElement>){if(!canEdit){setError('Tài khoản chỉ xem không được thu tiền.');return}e.preventDefault();if(!payModal)return;const f=new FormData(e.currentTarget),amount=Number(f.get('amount')||0);try{if(amount<=0)throw new Error('Số tiền thu phải lớn hơn 0.');const remain=Math.max(Number(payModal.total_amount)-Number(payModal.paid_amount),0);if(amount>remain)throw new Error('Số tiền thu không được vượt quá số còn nợ.');const newPaid=Number(payModal.paid_amount)+amount;await sb('nhatro_payments',{method:'POST',body:JSON.stringify({invoice_id:payModal.id,amount,payment_method:String(f.get('method')||'cash'),note:String(f.get('note')||'')})});await sb(`nhatro_invoices?id=eq.${payModal.id}`,{method:'PATCH',body:JSON.stringify({paid_amount:newPaid,status:newPaid>=Number(payModal.total_amount)?'paid':'partial',updated_at:new Date().toISOString()})});setPayModal(null);await loadAll()}catch(e:any){setError(e.message||'Không ghi nhận được thanh toán.')}}

  async function saveSetting(key:string,value:string){if(!canEdit){setError('Tài khoản chỉ xem không được sửa cài đặt.');return}try{await sb(`nhatro_settings?setting_key=eq.${key}`,{method:'PATCH',body:JSON.stringify({setting_value:value,updated_at:new Date().toISOString()})});await loadAll()}catch(e:any){setError(e.message||'Không lưu được cài đặt.')}}

  async function handleLogin(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setLoginLoading(true);setError('')
    try{
      const auth=await authLogin(loginEmail.trim(),loginPassword)
      try{
        const payload=JSON.parse(atob(auth.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
        localStorage.setItem('nhatro_user_id',payload.sub||'')
      }catch{}
      const role=await getMyRole()
      setUserRole(role)
      setUserEmail(loginEmail.trim())
      setLoginPassword('')
      await loadAll()
    }catch(e:any){setError(e.message||'Đăng nhập thất bại.')}finally{setLoginLoading(false)}
  }

  async function handleLogout(){
    try{await authLogout()}catch{}
    setUserEmail('');setUserRole('viewer');localStorage.removeItem('nhatro_user_id');setRooms([]);setInvoices([]);setMeters([]);setSettings([]);setSummaries([])
  }

  if(!authReady) return <div className="loginpage"><div className="loginbox">Đang kiểm tra phiên đăng nhập...</div></div>

  if(!userEmail) return <div className="loginpage">
    <div className="loginbox">
      <div className="loginbrand">🏠</div>
      <h1>Nhà Trọ Manager</h1>
      <p>Đăng nhập để xem và quản lý dữ liệu nhà trọ</p>
      {error&&<div className="alert">⚠️ <span>{error}</span><button onClick={()=>setError('')}>×</button></div>}
      <form onSubmit={handleLogin}>
        <div className="field"><label>Email</label><input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="admin@example.com" required autoComplete="email"/></div>
        <div className="field"><label>Mật khẩu</label><input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password"/></div>
        <button className="btn primary loginbtn" disabled={loginLoading}>{loginLoading?'Đang đăng nhập...':'🔐 Đăng nhập'}</button>
      </form>
    </div>
  </div>

  return <div className="app"><aside className="side"><div className="brand">🏠 <span>Nhà Trọ Manager</span></div><div className="nav">{nav.map(([id,ic,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><span className="navicon">{ic}</span><span>{label}</span></button>)}</div></aside><main className="main">
    <div className="top"><div><div className="title">{nav.find(x=>x[0]===tab)?.[2]}</div><div className="sub">Tháng {monthLabel(month)} · Dữ liệu Supabase</div></div><div className="topactions"><input className="month" type="month" value={month.slice(0,7)} onChange={e=>setMonth(`${e.target.value}-01`)}/><button className="btn light" onClick={loadAll}><RefreshCw size={16}/> Làm mới</button>{tab==='rooms'&&canEdit&&<button className="btn primary" onClick={()=>setRoomModal(null)}><Plus size={16}/> Thêm phòng</button>}<span className="rolebadge">{userRole==="admin"?"👑 Quản trị":"👁️ Chỉ xem"}</span><button className="btn light" onClick={handleLogout}>Đăng xuất</button></div></div>
    {error&&<div className="alert">⚠️ <span>{error}</span><button onClick={()=>setError('')}>×</button></div>}
    {loading?<div className="section"><div className="card">Đang tải dữ liệu...</div></div>:<>
      {tab==='dashboard'&&<Dashboard rooms={rooms} invoices={invoices} stats={stats} month={month} onPay={setPayModal} onGoInvoices={()=>setTab('invoices')}/>} 
      {tab==='rooms'&&<Rooms rooms={filteredRooms} search={search} setSearch={setSearch} onEdit={r=>setRoomModal(r)} invoices={invoices} canEdit={canEdit}/>} 
      {tab==='meters'&&<Meters rooms={rooms.filter(r=>r.status==='occupied')} meters={meters} month={month} onSave={saveMeter} onCreateInvoice={r=>setInvoiceModal(r)} canEdit={canEdit}/>} 
      {tab==='invoices'&&<Invoices invoices={invoices} onPay={setPayModal} onGoMeters={()=>setTab('meters')} canEdit={canEdit}/>} 
      {tab==='payments'&&<Payments invoices={invoices} stats={stats} onPay={setPayModal} canEdit={canEdit}/>} 
      {tab==='reports'&&<Reports invoices={invoices} summaries={summaries} stats={stats} month={month}/>} 
      {tab==='settings'&&<Settings settings={settings} onSave={saveSetting} canEdit={canEdit}/>} 
    </>}
    {roomModal!==false&&<RoomModal room={roomModal||undefined} onClose={()=>setRoomModal(false)} onSave={saveRoom}/>} 
    {invoiceModal&&<InvoiceModal room={invoiceModal} defaultService={price('service_fee',0)} onClose={()=>setInvoiceModal(null)} onCreate={x=>createInvoice(invoiceModal,x)}/>} 
    {payModal&&<PayModal invoice={payModal} onClose={()=>setPayModal(null)} onPay={payInvoice}/>} 
  </main></div>
}

function Dashboard({rooms,invoices,stats,month,onPay,onGoInvoices}:{rooms:Room[];invoices:Invoice[];stats:any;month:string;onPay:(x:Invoice)=>void;onGoInvoices:()=>void}){const debt=invoices.filter(i=>Number(i.total_amount)>Number(i.paid_amount));return <><div className="grid"><Stat l="Tổng số phòng" v={rooms.length.toString()} c="blue"/><Stat l="Đang cho thuê" v={stats.occupied.toString()} c="green"/><Stat l="Đã thu tháng này" v={money(stats.paid)} c="green"/><Stat l="Còn phải thu" v={money(stats.debt)} c="red"/></div><div className="grid mini"><Stat l="Phòng trống" v={stats.vacant.toString()} c="orange"/><Stat l="Tiền phòng" v={money(invoices.reduce((s,x)=>s+Number(x.room_amount),0))} c="blue"/><Stat l="Tiền điện" v={money(invoices.reduce((s,x)=>s+Number(x.electricity_amount),0))} c="orange"/><Stat l="Tỷ lệ đã thu" v={stats.due?Math.round(stats.paid/stats.due*100)+'%':'0%'} c="green"/></div><div className="section"><div className="sectionhead"><h2>⚠️ Phòng còn nợ · {monthLabel(month)}</h2><button className="btn light" onClick={onGoInvoices}>Xem tất cả</button></div>{debt.length?<InvoiceTable invoices={debt} onPay={onPay} canEdit={canEdit}/>:<div className="card empty">🎉 Tất cả hóa đơn tháng này đã thanh toán.</div>}</div></>}

function Rooms({rooms,search,setSearch,onEdit,invoices,canEdit}:{rooms:Room[];search:string;setSearch:(v:string)=>void;onEdit:(r:Room)=>void;invoices:Invoice[];canEdit:boolean}){return <div className="section"><div className="sectionhead"><div><h2>Danh sách phòng</h2><div className="sub">Quản lý người thuê, giá phòng và công nợ</div></div><div className="search"><Search size={16}/><input placeholder="Tìm phòng, tên, SĐT..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div><div className="tablewrap"><table className="table"><thead><tr><th>Phòng</th><th>Người thuê</th><th>SĐT</th><th>Giá phòng</th><th>Công nợ</th><th>Trạng thái</th><th></th></tr></thead><tbody>{rooms.map(r=>{const inv=invoices.find(i=>i.room_id===r.id);const debt=inv?Math.max(Number(inv.total_amount)-Number(inv.paid_amount),0):0;return <tr key={r.id}><td><b>{r.room_code}</b></td><td>{r.tenant||'—'}</td><td>{r.phone||'—'}</td><td>{money(r.monthly_rent)}</td><td className={debt?'red':''}>{debt?money(debt):'0 ₫'}</td><td><span className={'badge '+(r.status==='occupied'?'paid':r.status==='vacant'?'neutral':'due')}>{r.status==='occupied'?'Đang thuê':r.status==='vacant'?'Trống':'Bảo trì'}</span></td><td>{canEdit&&<button className="iconbtn" title="Sửa" onClick={()=>onEdit(r)}><Pencil size={15}/></button>}</td></tr>})}</tbody></table></div></div>}

function Meters({rooms,meters,month,onSave,onCreateInvoice,canEdit}:{rooms:Room[];meters:Meter[];month:string;onSave:(r:Room,e:React.FormEvent<HTMLFormElement>)=>void;onCreateInvoice:(r:Room)=>void;canEdit:boolean}){return <div className="section"><div className="card"><div className="sectionhead"><div><h2>⚡💧 Chỉ số điện nước · {monthLabel(month)}</h2><div className="sub">Nhập hàng loạt cho các phòng đang thuê</div></div></div><div className="tablewrap"><table className="table"><thead><tr><th>Phòng</th><th>Điện cũ</th><th>Điện mới</th><th>Số điện</th><th>Tiền điện</th><th>Nước cũ</th><th>Nước mới</th><th>Số nước</th><th>Tiền nước</th><th></th></tr></thead><tbody>{rooms.map(r=>{const m=meters.find(x=>x.room_id===r.id);const eo=m?.electricity_old??0,wo=m?.water_old??0,en=m?.electricity_new??eo,wn=m?.water_new??wo,eu=Math.max(en-eo,0),wu=Math.max(wn-wo,0);return <tr key={r.id}><td><b>{r.room_code}</b></td><td><input name="eo" form={`m-${r.id}`} defaultValue={eo} readOnly={!canEdit}/></td><td><input name="en" form={`m-${r.id}`} defaultValue={en} readOnly={!canEdit}/></td><td><b>{eu}</b></td><td>{money(eu*(m?.electricity_unit_price||3500))}</td><td><input name="wo" form={`m-${r.id}`} defaultValue={wo} readOnly={!canEdit}/></td><td><input name="wn" form={`m-${r.id}`} defaultValue={wn} readOnly={!canEdit}/></td><td><b>{wu}</b></td><td>{money(wu*(m?.water_unit_price||20000))}</td><td>{canEdit&&<><form id={`m-${r.id}`} onSubmit={e=>onSave(r,e)}><button className="btn small primary"><Save size={14}/> Lưu</button></form>{m&&<button className="btn small light" onClick={()=>onCreateInvoice(r)}><Receipt size={13}/> HĐ</button>}</>}</td></tr>})}</tbody></table></div></div></div>}

function Invoices({invoices,onPay,onGoMeters,canEdit}:{invoices:Invoice[];onPay:(x:Invoice)=>void;onGoMeters:()=>void;canEdit:boolean}){return <div className="section"><div className="sectionhead"><div><h2>🧾 Hóa đơn tháng</h2><div className="sub">{invoices.length} hóa đơn</div></div><button className="btn light" onClick={onGoMeters}>⚡ Nhập điện nước</button></div>{invoices.length?<InvoiceTable invoices={invoices} onPay={onPay} canEdit={canEdit}/>:<div className="card empty">Chưa có hóa đơn. Nhập chỉ số điện nước rồi tạo hóa đơn.</div>}</div>}
function Payments({invoices,stats,onPay,canEdit}:{invoices:Invoice[];stats:any;onPay:(x:Invoice)=>void;canEdit:boolean}){return <div className="section"><div className="grid"><Stat l="Tổng phải thu" v={money(stats.due)} c="blue"/><Stat l="Đã thu" v={money(stats.paid)} c="green"/><Stat l="Còn nợ" v={money(stats.debt)} c="red"/><Stat l="Hóa đơn" v={invoices.length.toString()} c="orange"/></div><div className="section"><InvoiceTable invoices={invoices} onPay={onPay} canEdit={canEdit}/></div></div>}
function Reports({invoices,summaries,stats,month}:{invoices:Invoice[];summaries:Summary[];stats:any;month:string}){const s=summaries.slice(0,12);return <div className="section"><div className="grid"><Stat l="Tổng phải thu" v={money(stats.due)} c="blue"/><Stat l="Đã thu" v={money(stats.paid)} c="green"/><Stat l="Còn nợ" v={money(stats.debt)} c="red"/><Stat l="Tỷ lệ thu" v={stats.due?Math.round(stats.paid/stats.due*100)+'%':'0%'} c="green"/></div><div className="section"><div className="card"><h2>Chi tiết tháng {monthLabel(month)}</h2><div className="reportlist"><p>Tiền phòng <b>{money(invoices.reduce((x,i)=>x+Number(i.room_amount),0))}</b></p><p>Tiền điện <b>{money(invoices.reduce((x,i)=>x+Number(i.electricity_amount),0))}</b></p><p>Tiền nước <b>{money(invoices.reduce((x,i)=>x+Number(i.water_amount),0))}</b></p><p>Phí khác <b>{money(invoices.reduce((x,i)=>x+Number(i.service_amount)+Number(i.other_amount),0))}</b></p></div></div></div><div className="section"><div className="card"><h2>12 tháng gần nhất</h2><div className="tablewrap"><table className="table"><thead><tr><th>Tháng</th><th>Hóa đơn</th><th>Phải thu</th><th>Đã thu</th><th>Còn nợ</th></tr></thead><tbody>{s.map(x=><tr key={x.month}><td>{monthLabel(x.month)}</td><td>{x.invoice_count}</td><td>{money(x.total_amount)}</td><td className="green">{money(x.paid_amount)}</td><td className="red">{money(x.debt_amount)}</td></tr>)}</tbody></table></div></div></div></div>}

function Settings({settings,onSave,canEdit}:{settings:Setting[];onSave:(k:string,v:string)=>void;canEdit:boolean}){const get=(k:string,d:string)=>settings.find(x=>x.setting_key===k)?.setting_value||d;const [ep,setEp]=useState(get('electricity_price','3500')),[wp,setWp]=useState(get('water_price','20000')), [sf,setSf]=useState(get('service_fee','0')),[dd,setDd]=useState(get('default_due_day','5'));useEffect(()=>{setEp(get('electricity_price','3500'));setWp(get('water_price','20000'));setSf(get('service_fee','0'));setDd(get('default_due_day','5'))},[settings]);return <div className="section"><div className="card"><h2>⚙️ Cài đặt tính tiền</h2><div className="formgrid"><Field label="Giá điện (đ/kWh)" name="ep" value={ep} onChange={setEp} readOnly={!canEdit}/><Field label="Giá nước (đ/m³)" name="wp" value={wp} onChange={setWp} readOnly={!canEdit}/><Field label="Phí dịch vụ mặc định" name="sf" value={sf} onChange={setSf} readOnly={!canEdit}/><Field label="Ngày đến hạn" name="dd" value={dd} type="number" onChange={setDd} readOnly={!canEdit}/></div><div className="actions">{canEdit&&<button className="btn primary" onClick={()=>{onSave('electricity_price',ep);onSave('water_price',wp);onSave('service_fee',sf);onSave('default_due_day',dd)}}><Save size={16}/> Lưu cài đặt</button>}</div></div></div>}

function RoomModal({room,onClose,onSave}:{room?:Room;onClose:()=>void;onSave:(e:React.FormEvent<HTMLFormElement>)=>void}){
  const [code,setCode]=useState(room?.room_code||'')
  const [tenant,setTenant]=useState(room?.tenant||'')
  const [phone,setPhone]=useState(room?.phone||'')
  const [rent,setRent]=useState(String(room?.monthly_rent||2500000))
  const [deposit,setDeposit]=useState(String(room?.deposit||2500000))
  const [status,setStatus]=useState(room?.status||'occupied')
  useEffect(()=>{
    setCode(room?.room_code||'');setTenant(room?.tenant||'');setPhone(room?.phone||'')
    setRent(String(room?.monthly_rent||2500000));setDeposit(String(room?.deposit||2500000))
    setStatus(room?.status||'occupied')
  },[room])
  return <Modal title={room?'Sửa phòng':'Thêm phòng'} onClose={onClose}>
    <form onSubmit={onSave}>
      <div className="formgrid">
        <Field label="Mã phòng" name="code" value={code} onChange={setCode} required/>
        <Field label="Người thuê" name="tenant" value={tenant} onChange={setTenant}/>
        <Field label="Số điện thoại" name="phone" value={phone} onChange={setPhone}/>
        <Field label="Giá phòng" name="rent" type="number" value={rent} onChange={setRent}/>
        <Field label="Tiền cọc" name="deposit" type="number" value={deposit} onChange={setDeposit}/>
        <div className="field"><label>Trạng thái</label><select name="status" value={status} onChange={e=>setStatus(e.target.value as Room['status'])}>
          <option value="occupied">Đang thuê</option><option value="vacant">Trống</option><option value="maintenance">Bảo trì</option>
        </select></div>
      </div>
      <div className="actions"><button type="button" className="btn light" onClick={onClose}>Hủy</button><button className="btn primary"><Save size={16}/> Lưu</button></div>
    </form>
  </Modal>
}
function InvoiceModal({room,defaultService,onClose,onCreate}:{room:Room;defaultService:number;onClose:()=>void;onCreate:(x:{service:number;other:number;discount:number})=>void}){const [service,setService]=useState(String(defaultService)),[other,setOther]=useState('0'),[discount,setDiscount]=useState('0');return <Modal title={`Tạo hóa đơn — ${room.room_code}`} onClose={onClose}><p>Tiền phòng: <b>{money(room.monthly_rent)}</b></p><div className="formgrid"><Field label="Phí dịch vụ" value={service} onChange={setService} type="number"/><Field label="Phí khác" value={other} onChange={setOther} type="number"/><Field label="Giảm trừ" value={discount} onChange={setDiscount} type="number"/></div><div className="actions"><button className="btn light" onClick={onClose}>Hủy</button><button className="btn primary" onClick={()=>onCreate({service:Number(service||0),other:Number(other||0),discount:Number(discount||0)})}><Receipt size={16}/> Tạo hóa đơn</button></div></Modal>}
function PayModal({invoice,onClose,onPay}:{invoice:Invoice;onClose:()=>void;onPay:(e:React.FormEvent<HTMLFormElement>)=>void}){const remain=Math.max(Number(invoice.total_amount)-Number(invoice.paid_amount),0);return <Modal title={`Thu tiền — ${invoice.room_code}`} onClose={onClose}><div className="paybox"><div>Tổng hóa đơn <b>{money(invoice.total_amount)}</b></div><div>Đã thu <b className="green">{money(invoice.paid_amount)}</b></div><div>Còn nợ <b className="red">{money(remain)}</b></div></div><form onSubmit={onPay}><div className="formgrid"><Field label="Số tiền thu" name="amount" type="number" value={String(remain)}/><div className="field"><label>Phương thức</label><select name="method" defaultValue="cash"><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option><option value="bank">Ngân hàng</option><option value="other">Khác</option></select></div><Field label="Ghi chú" name="note"/></div><div className="actions"><button type="button" className="btn light" onClick={onClose}>Hủy</button><button className="btn primary"><CreditCard size={16}/> Xác nhận thu</button></div></form></Modal>}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return <div className="modalbg"><div className="modal"><div className="sectionhead"><h2>{title}</h2><button className="btn light" onClick={onClose}><X size={18}/></button></div>{children}</div></div>}
function Stat({l,v,c}:{l:string;v:string;c:string}){return <div className="card"><div className="label">{l}</div><div className={'value '+c}>{v}</div></div>}
function Field({label,name,value,type='text',required=false,onChange,readOnly=false}:{label:string;name?:string;value?:string;type?:string;required?:boolean;onChange?:(v:string)=>void;readOnly?:boolean}){return <div className="field"><label>{label}</label><input name={name} value={value} onChange={e=>onChange?onChange(e.target.value):undefined} defaultValue={onChange?undefined:value} type={type} required={required} readOnly={readOnly}/></div>}
function InvoiceTable({invoices,onPay,canEdit=true}:{invoices:Invoice[];onPay:(x:Invoice)=>void;canEdit?:boolean}){return <div className="tablewrap"><table className="table"><thead><tr><th>Phòng</th><th>Tiền phòng</th><th>Điện</th><th>Nước</th><th>Phí khác</th><th>Tổng</th><th>Đã thu</th><th>Còn nợ</th><th>Trạng thái</th><th></th></tr></thead><tbody>{invoices.map(x=>{const debt=Math.max(Number(x.total_amount)-Number(x.paid_amount),0);return <tr key={x.id}><td><b>{x.room_code||'—'}</b></td><td>{money(x.room_amount)}</td><td>{money(x.electricity_amount)}</td><td>{money(x.water_amount)}</td><td>{money(Number(x.service_amount)+Number(x.other_amount)-Number(x.discount_amount))}</td><td><b>{money(x.total_amount)}</b></td><td>{money(x.paid_amount)}</td><td className={debt?'red':''}>{money(debt)}</td><td><span className={'badge '+(x.status==='paid'?'paid':x.status==='partial'?'partial':'due')}>{x.status==='paid'?'Đã thu':x.status==='partial'?'Thu một phần':'Chưa thu'}</span></td><td>{canEdit&&x.status!=='paid'&&<button className="btn small primary" onClick={()=>onPay(x)}>Thu tiền</button>}</td></tr>})}</tbody></table></div>}
