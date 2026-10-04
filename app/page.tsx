'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, X, RefreshCw, Save, Search, CreditCard } from 'lucide-react'

type Room = {
  id: string; room_code: string; room_name: string | null; monthly_rent: number; deposit: number; status: 'occupied'|'vacant'|'maintenance'; tenant?: string; phone?: string
}
type Meter = { id?: string; room_id: string; billing_month: string; electricity_old: number; electricity_new: number; water_old: number; water_new: number; electricity_unit_price: number; water_unit_price: number; electricity_usage?: number; water_usage?: number; electricity_amount?: number; water_amount?: number }
type Invoice = { id: string; room_id: string; room_code?: string; billing_month: string; invoice_number: string | null; room_amount: number; electricity_amount: number; water_amount: number; service_amount: number; other_amount: number; discount_amount: number; total_amount: number; paid_amount: number; status: string; due_date: string | null }

type Setting = { setting_key: string; setting_value: string }

const money = (n:number) => Number(n || 0).toLocaleString('vi-VN') + ' ₫'
const monthKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
const monthLabel = (s:string) => { const [y,m] = s.split('-'); return `${m}/${y}` }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function sb(path:string, options:RequestInit={}) {
  if (!URL || !KEY) throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trên Vercel.')
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.method === 'POST' ? 'return=representation' : 'return=minimal',
      ...(options.headers || {})
    }
  })
  if (!res.ok) throw new Error(await res.text())
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export default function App(){
  const [tab,setTab] = useState('dashboard')
  const [rooms,setRooms] = useState<Room[]>([])
  const [invoices,setInvoices] = useState<Invoice[]>([])
  const [meters,setMeters] = useState<Meter[]>([])
  const [settings,setSettings] = useState<Setting[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [modal,setModal] = useState(false)
  const [payModal,setPayModal] = useState<Invoice|null>(null)
  const [search,setSearch] = useState('')
  const [month,setMonth] = useState(monthKey())

  const nav=[['dashboard','🏠','Dashboard'],['rooms','🚪','Phòng & người thuê'],['meters','⚡','Điện nước'],['invoices','🧾','Hóa đơn'],['payments','💰','Thu tiền'],['reports','📊','Báo cáo'],['settings','⚙️','Cài đặt']]

  async function loadAll(){
    setLoading(true); setError('')
    try {
      const [rs, cs, is, ms, ss] = await Promise.all([
        sb('nhatro_rooms?select=*&order=room_code'),
        sb('nhatro_contracts?select=room_id,status,nhatro_tenants(full_name,phone)&status=eq.active'),
        sb(`nhatro_invoice_summary?select=*&billing_month=eq.${month}&order=room_code`),
        sb(`nhatro_meter_readings?select=*&billing_month=eq.${month}&order=created_at`),
        sb('nhatro_settings?select=setting_key,setting_value')
      ])
      const contractMap:Record<string,any> = {}
      ;(cs||[]).forEach((c:any)=> contractMap[c.room_id] = c)
      setRooms((rs||[]).map((r:any)=>({ ...r, tenant:contractMap[r.id]?.nhatro_tenants?.full_name || '', phone:contractMap[r.id]?.nhatro_tenants?.phone || '' })))
      setInvoices(is||[]); setMeters(ms||[]); setSettings(ss||[])
    } catch(e:any){ setError(e.message || 'Không tải được dữ liệu.') }
    finally { setLoading(false) }
  }
  useEffect(()=>{ loadAll() },[month])

  const stats=useMemo(()=>{
    const due=invoices.reduce((s,x)=>s+Number(x.total_amount||0),0)
    const paid=invoices.reduce((s,x)=>s+Number(x.paid_amount||0),0)
    return {due,paid,debt:Math.max(due-paid,0),occupied:rooms.filter(r=>r.status==='occupied').length}
  },[invoices,rooms])

  const filteredRooms=rooms.filter(r => `${r.room_code} ${r.tenant||''} ${r.phone||''}`.toLowerCase().includes(search.toLowerCase()))
  const price=(key:string, fallback:number)=>Number(settings.find(x=>x.setting_key===key)?.setting_value ?? fallback)

  async function addRoom(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault(); const f=new FormData(e.currentTarget)
    try {
      const room:any = await sb('nhatro_rooms',{method:'POST',body:JSON.stringify({room_code:String(f.get('code')).trim(),room_name:`Phòng ${String(f.get('code')).trim()}`,monthly_rent:Number(f.get('rent')||0),deposit:Number(f.get('deposit')||0),status:'occupied'})})
      const r=room[0]
      const tenant:any = await sb('nhatro_tenants',{method:'POST',body:JSON.stringify({full_name:String(f.get('tenant')||'').trim(),phone:String(f.get('phone')||'').trim()})})
      await sb('nhatro_contracts',{method:'POST',body:JSON.stringify({room_id:r.id,tenant_id:tenant[0].id,start_date:new Date().toISOString().slice(0,10),monthly_rent:Number(f.get('rent')||0),deposit:Number(f.get('deposit')||0),status:'active'})})
      setModal(false); await loadAll()
    } catch(e:any){ setError(e.message || 'Không thể thêm phòng.') }
  }

  async function saveMeter(room:Room, e:React.FormEvent<HTMLFormElement>){
    e.preventDefault(); const f=new FormData(e.currentTarget)
    try {
      const oldMeter=meters.find(m=>m.room_id===room.id)
      const payload={room_id:room.id,billing_month:month,electricity_old:Number(f.get('eo')||0),electricity_new:Number(f.get('en')||0),water_old:Number(f.get('wo')||0),water_new:Number(f.get('wn')||0),electricity_unit_price:price('electricity_price',3500),water_unit_price:price('water_price',20000)}
      if(oldMeter?.id) await sb(`nhatro_meter_readings?id=eq.${oldMeter.id}`,{method:'PATCH',body:JSON.stringify(payload)})
      else await sb('nhatro_meter_readings',{method:'POST',body:JSON.stringify(payload)})
      await loadAll()
    } catch(e:any){ setError(e.message || 'Không lưu được chỉ số.') }
  }

  async function createInvoice(room:Room){
    try {
      const m=meters.find(x=>x.room_id===room.id)
      if(!m) throw new Error('Phòng này chưa có chỉ số điện nước.')
      const electricity=Number(m.electricity_amount ?? Math.max(m.electricity_new-m.electricity_old,0)*m.electricity_unit_price)
      const water=Number(m.water_amount ?? Math.max(m.water_new-m.water_old,0)*m.water_unit_price)
      const existing=invoices.find(i=>i.room_id===room.id)
      if(existing) throw new Error('Phòng này đã có hóa đơn tháng này.')
      await sb('nhatro_invoices',{method:'POST',body:JSON.stringify({room_id:room.id,billing_month:month,invoice_number:`${room.room_code}-${month.replace('-','')}`,room_amount:Number(room.monthly_rent),electricity_amount:electricity,water_amount:water,service_amount:0,other_amount:0,discount_amount:0,paid_amount:0,status:'unpaid',due_date:`${month.slice(0,7)}-05`})})
      await loadAll()
    } catch(e:any){ setError(e.message || 'Không tạo được hóa đơn.') }
  }

  async function payInvoice(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!payModal) return
    const f=new FormData(e.currentTarget); const amount=Number(f.get('amount')||0)
    try {
      if(amount<=0) throw new Error('Số tiền thu phải lớn hơn 0.')
      const newPaid=Math.min(Number(payModal.paid_amount)+amount,Number(payModal.total_amount))
      const status=newPaid>=Number(payModal.total_amount)?'paid':'partial'
      await sb('nhatro_payments',{method:'POST',body:JSON.stringify({invoice_id:payModal.id,amount,payment_method:String(f.get('method')||'cash'),note:String(f.get('note')||'')})})
      await sb(`nhatro_invoices?id=eq.${payModal.id}`,{method:'PATCH',body:JSON.stringify({paid_amount:newPaid,status})})
      setPayModal(null); await loadAll()
    } catch(e:any){ setError(e.message || 'Không ghi nhận được thanh toán.') }
  }

  async function saveSetting(key:string,value:string){
    try { await sb(`nhatro_settings?setting_key=eq.${key}`,{method:'PATCH',body:JSON.stringify({setting_value:value,updated_at:new Date().toISOString()})}); await loadAll() }
    catch(e:any){ setError(e.message || 'Không lưu được cài đặt.') }
  }

  return <div className="app">
    <aside className="side"><div className="brand">🏠 Nhà Trọ Manager</div><div className="nav">{nav.map(([id,ic,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{ic}　{label}</button>)}</div></aside>
    <main className="main">
      <div className="top"><div><div className="title">{nav.find(x=>x[0]===tab)?.[2]}</div><div className="sub">Tháng {monthLabel(month)} · Dữ liệu Supabase</div></div><div className="topactions"><input className="month" type="month" value={month.slice(0,7)} onChange={e=>setMonth(`${e.target.value}-01`)}/><button className="btn light" onClick={loadAll}><RefreshCw size={16}/> Làm mới</button>{(tab==='rooms')&&<button className="btn primary" onClick={()=>setModal(true)}><Plus size={16}/> Thêm phòng</button>}</div></div>
      {error&&<div className="alert">⚠️ {error}<button onClick={()=>setError('')}>×</button></div>}
      {loading?<div className="section"><div className="card">Đang tải dữ liệu...</div></div>:
      <>
      {tab==='dashboard'&&<><div className="grid"><Stat l="Tổng số phòng" v={rooms.length.toString()} c="blue"/><Stat l="Đang cho thuê" v={stats.occupied.toString()} c="green"/><Stat l="Đã thu tháng này" v={money(stats.paid)} c="green"/><Stat l="Còn phải thu" v={money(stats.debt)} c="red"/></div><div className="section"><div className="sectionhead"><h2>Hóa đơn tháng {monthLabel(month)}</h2><button className="btn light" onClick={()=>setTab('invoices')}>Xem tất cả</button></div><InvoiceTable invoices={invoices} onPay={setPayModal}/></div><div className="grid"><Stat l="Tiền phòng" v={money(invoices.reduce((s,x)=>s+Number(x.room_amount),0))} c="blue"/><Stat l="Tiền điện" v={money(invoices.reduce((s,x)=>s+Number(x.electricity_amount),0))} c="orange"/><Stat l="Tiền nước" v={money(invoices.reduce((s,x)=>s+Number(x.water_amount),0))} c="blue"/><Stat l="Tỷ lệ đã thu" v={stats.due?Math.round(stats.paid/stats.due*100)+'%':'0%'} c="green"/></div></>}
      {tab==='rooms'&&<div className="section"><div className="sectionhead"><h2>Danh sách phòng</h2><div className="search"><Search size={16}/><input placeholder="Tìm phòng, người thuê..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div><div className="tablewrap"><table className="table"><thead><tr><th>Phòng</th><th>Người thuê</th><th>SĐT</th><th>Giá phòng</th><th>Trạng thái</th></tr></thead><tbody>{filteredRooms.map(r=><tr key={r.id}><td><b>{r.room_code}</b></td><td>{r.tenant||'—'}</td><td>{r.phone||'—'}</td><td>{money(r.monthly_rent)}</td><td><span className={'badge '+(r.status==='occupied'?'paid':'due')}>{r.status==='occupied'?'Đang thuê':r.status==='vacant'?'Trống':'Bảo trì'}</span></td></tr>)}</tbody></table></div></div>}
      {tab==='meters'&&<Meters rooms={rooms.filter(r=>r.status==='occupied')} meters={meters} month={month} onSave={saveMeter} onCreateInvoice={createInvoice}/>} 
      {tab==='invoices'&&<div className="section"><div className="sectionhead"><h2>Hóa đơn tháng {monthLabel(month)}</h2><span className="sub">{invoices.length} hóa đơn</span></div><InvoiceTable invoices={invoices} onPay={setPayModal}/></div>}
      {tab==='payments'&&<div className="section"><div className="grid"><Stat l="Tổng phải thu" v={money(stats.due)} c="blue"/><Stat l="Đã thu" v={money(stats.paid)} c="green"/><Stat l="Còn nợ" v={money(stats.debt)} c="red"/><Stat l="Số hóa đơn" v={invoices.length.toString()} c="orange"/></div><InvoiceTable invoices={invoices} onPay={setPayModal}/></div>}
      {tab==='reports'&&<div className="section"><div className="card"><h2>Báo cáo tháng {monthLabel(month)}</h2><p>Tổng tiền phòng: <b>{money(invoices.reduce((s,x)=>s+Number(x.room_amount),0))}</b></p><p>Tổng tiền điện: <b>{money(invoices.reduce((s,x)=>s+Number(x.electricity_amount),0))}</b></p><p>Tổng tiền nước: <b>{money(invoices.reduce((s,x)=>s+Number(x.water_amount),0))}</b></p><p>Tổng phải thu: <b>{money(stats.due)}</b></p><p>Đã thu: <b className="green">{money(stats.paid)}</b></p><p>Còn nợ: <b className="red">{money(stats.debt)}</b></p></div></div>}
      {tab==='settings'&&<Settings settings={settings} onSave={saveSetting}/>} 
      </>}
      {modal&&<div className="modalbg"><div className="modal"><div className="sectionhead"><h2>Thêm phòng</h2><button className="btn light" onClick={()=>setModal(false)}><X/></button></div><form onSubmit={addRoom}><div className="formgrid"><Field name="code" label="Mã phòng" required/><Field name="tenant" label="Người thuê" required/><Field name="phone" label="Số điện thoại"/><Field name="rent" label="Giá phòng" value="2500000" type="number"/><Field name="deposit" label="Tiền cọc" value="2500000" type="number"/><div className="full"><div className="actions"><button type="button" className="btn light" onClick={()=>setModal(false)}>Hủy</button><button className="btn primary">Lưu phòng</button></div></div></div></form></div></div>}
      {payModal&&<div className="modalbg"><div className="modal"><div className="sectionhead"><h2>Thu tiền — {payModal.room_code}</h2><button className="btn light" onClick={()=>setPayModal(null)}><X/></button></div><p>Tổng hóa đơn: <b>{money(payModal.total_amount)}</b></p><p>Đã thu: <b className="green">{money(payModal.paid_amount)}</b></p><p>Còn lại: <b className="red">{money(Math.max(payModal.total_amount-payModal.paid_amount,0))}</b></p><form onSubmit={payInvoice}><div className="formgrid"><Field name="amount" label="Số tiền thu" value={String(Math.max(payModal.total_amount-payModal.paid_amount,0))} type="number"/><div className="field"><label>Phương thức</label><select name="method" defaultValue="cash"><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option><option value="bank">Ngân hàng</option><option value="other">Khác</option></select></div><Field name="note" label="Ghi chú"/><div className="full"><div className="actions"><button type="button" className="btn light" onClick={()=>setPayModal(null)}>Hủy</button><button className="btn primary"><CreditCard size={16}/> Xác nhận thu</button></div></div></div></form></div></div>}
    </main>
  </div>
}

function Stat({l,v,c}:{l:string;v:string;c:string}){return <div className="card"><div className="label">{l}</div><div className={'value '+c}>{v}</div></div>}
function Field({label,name,value,type='text',required=false}:{label:string;name?:string;value?:string;type?:string;required?:boolean}){return <div className="field"><label>{label}</label><input name={name} defaultValue={value} type={type} required={required}/></div>}
function InvoiceTable({invoices,onPay}:{invoices:Invoice[];onPay:(x:Invoice)=>void}){return <div className="tablewrap"><table className="table"><thead><tr><th>Phòng</th><th>Tháng</th><th>Tiền phòng</th><th>Điện</th><th>Nước</th><th>Tổng</th><th>Đã thu</th><th>Trạng thái</th><th></th></tr></thead><tbody>{invoices.map(x=><tr key={x.id}><td><b>{x.room_code||'—'}</b></td><td>{monthLabel(x.billing_month)}</td><td>{money(x.room_amount)}</td><td>{money(x.electricity_amount)}</td><td>{money(x.water_amount)}</td><td><b>{money(x.total_amount)}</b></td><td>{money(x.paid_amount)}</td><td><span className={'badge '+(x.status==='paid'?'paid':'due')}>{x.status==='paid'?'Đã thu':x.status==='partial'?'Thu một phần':'Chưa thu'}</span></td><td>{x.status!=='paid'&&<button className="btn small primary" onClick={()=>onPay(x)}>Thu tiền</button>}</td></tr>)}</tbody></table></div>}

function Meters({rooms,meters,month,onSave,onCreateInvoice}:{rooms:Room[];meters:Meter[];month:string;onSave:(r:Room,e:React.FormEvent<HTMLFormElement>)=>void;onCreateInvoice:(r:Room)=>void}){return <div className="section"><div className="card"><h2>Nhập chỉ số điện nước — {monthLabel(month)}</h2><div className="tablewrap"><table className="table"><thead><tr><th>Phòng</th><th>Điện cũ</th><th>Điện mới</th><th>Số điện</th><th>Nước cũ</th><th>Nước mới</th><th>Số nước</th><th></th></tr></thead><tbody>{rooms.map(r=>{const m=meters.find(x=>x.room_id===r.id); const eo=m?.electricity_old ?? 0, wo=m?.water_old ?? 0, en=m?.electricity_new ?? eo, wn=m?.water_new ?? wo; return <tr key={r.id}><td><b>{r.room_code}</b></td><td><input name="eo" form={`m-${r.id}`} defaultValue={eo}/></td><td><input name="en" form={`m-${r.id}`} defaultValue={en}/></td><td>{Math.max(en-eo,0)}</td><td><input name="wo" form={`m-${r.id}`} defaultValue={wo}/></td><td><input name="wn" form={`m-${r.id}`} defaultValue={wn}/></td><td>{Math.max(wn-wo,0)}</td><td><form id={`m-${r.id}`} onSubmit={e=>onSave(r,e)}><button className="btn small primary"><Save size={14}/> Lưu</button></form>{m&&<button className="btn small light" onClick={()=>onCreateInvoice(r)}>Tạo HĐ</button>}</td></tr>})}</tbody></table></div><p className="hint">Giá mặc định: điện {money(3500)}/kWh · nước {money(20000)}/m³. Có thể chỉnh trong Cài đặt.</p></div></div>}

function Settings({settings,onSave}:{settings:Setting[];onSave:(k:string,v:string)=>void}){const [ep,setEp]=useState(settings.find(x=>x.setting_key==='electricity_price')?.setting_value||'3500');const [wp,setWp]=useState(settings.find(x=>x.setting_key==='water_price')?.setting_value||'20000');const [dd,setDd]=useState(settings.find(x=>x.setting_key==='default_due_day')?.setting_value||'5');return <div className="section"><div className="card"><h2>Đơn giá mặc định</h2><div className="formgrid"><div className="field"><label>Giá điện (đ/kWh)</label><input value={ep} onChange={e=>setEp(e.target.value)}/></div><div className="field"><label>Giá nước (đ/m³)</label><input value={wp} onChange={e=>setWp(e.target.value)}/></div><div className="field"><label>Ngày đến hạn</label><input value={dd} onChange={e=>setDd(e.target.value)} type="number"/></div></div><div className="actions"><button className="btn primary" onClick={()=>{onSave('electricity_price',ep);onSave('water_price',wp);onSave('default_due_day',dd)}}><Save size={16}/> Lưu cài đặt</button></div></div></div>}
