import { useState, useEffect, useCallback } from "react"
import { supabase } from "./supabase"
import { STATUS_OPTIONS, PRIORITY_OPTIONS, AREAS as DEFAULT_AREAS } from "./data"

export default function App() {
  const [session, setSession]   = useState(null)
  const [authReady, setAuthReady] = useState(false)

  // ─── Auth bootstrap ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!authReady) return <Splash text="Cargando..." />
  if (!session)   return <Auth />
  return <Board session={session} />
}

// ════════════════════════════════════════════════════════════════════════════
//  BOARD (app principal, ya autenticado)
// ════════════════════════════════════════════════════════════════════════════
function Board({ session }) {
  const userId = session.user.id

  const [tasks, setTasks]           = useState([])
  const [areas, setAreas]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [view, setView]             = useState("area") // area | today
  const [activeArea, setActiveArea] = useState(null)
  const [filterStatus, setFilterStatus]     = useState("all")
  const [filterPriority, setFilterPriority] = useState("all")
  const [editingTask, setEditingTask]       = useState(null)
  const [showAddModal, setShowAddModal]     = useState(false)
  const [showAreaModal, setShowAreaModal]   = useState(false)
  const [newTask, setNewTask] = useState({ task:"", priority:"high", time_estimate:"", worth:"", due_date:"", focus_today:false, next_step:"" })
  const [newArea, setNewArea] = useState({ label:"", color: AREA_COLORS[0] })
  const [saving, setSaving] = useState(false)
  const [draggedId, setDraggedId] = useState(null)
  const [sortMode, setSortMode] = useState("manual")

  const isMobile    = useIsMobile()
  const manualMode  = sortMode === "manual"
  const today       = todayISO()

  // ─── Load areas + tasks ─────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    let { data: areaRows } = await supabase.from("areas").select("*").order("sort_order")
    if (!areaRows || areaRows.length === 0) {
      const seed = DEFAULT_AREAS.map((a, i) => ({ id:a.id, label:a.label, color:a.color, sort_order:i+1, user_id:userId }))
      await supabase.from("areas").insert(seed)
      areaRows = (await supabase.from("areas").select("*").order("sort_order")).data || []
    }
    setAreas(areaRows)
    setActiveArea(prev => prev || areaRows[0]?.id || null)
    const { data: taskRows } = await supabase.from("tasks").select("*").order("sort_order")
    setTasks(taskRows || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { loadData() }, [loadData])

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const areaTasks    = tasks.filter(t => t.area === activeArea)
  const currentArea  = areas.find(a => a.id === activeArea) || areas[0]
  const totalAll     = tasks.length
  const doneAll      = tasks.filter(t => t.status === "done").length
  const todayCount   = tasks.filter(t => t.focus_date === today && t.status !== "done").length
  const isToday      = (t) => t.focus_date === today

  const getAreaStats = (areaId) => {
    const at = tasks.filter(t => t.area === areaId)
    return { total: at.length, done: at.filter(t => t.status === "done").length }
  }

  const dueInfo = (t) => {
    if (!t.due_date) return null
    if (t.due_date < today) return { text:"Atrasada", color:"#ef4444" }
    if (t.due_date === today) return { text:"Vence hoy", color:"#f97316" }
    return { text: fmtDate(t.due_date), color:"#9999b5" }
  }

  const compareTasks = (a, b) => {
    const pr = priorityRank[a.priority] - priorityRank[b.priority]
    if (pr !== 0) return pr
    if (sortMode !== "manual") {
      const [col, dir] = sortMode.split("_")
      let av, bv
      if (col === "time")  { av = parseMinutes(a); bv = parseMinutes(b) }
      else if (col === "worth") { av = parseWorth(a); bv = parseWorth(b) }
      else if (col === "due")   { av = a.due_date || null; bv = b.due_date || null }
      if (av == null && bv != null) return 1
      if (av != null && bv == null) return -1
      if (av != null && bv != null && av !== bv) {
        const cmp = typeof av === "string" ? (av < bv ? -1 : 1) : (av - bv)
        return dir === "asc" ? cmp : -cmp
      }
    }
    return a.sort_order - b.sort_order
  }

  const baseTasks = view === "today" ? tasks.filter(t => t.focus_date === today) : areaTasks

  const filteredTasks = baseTasks
    .filter(t => {
      const sOk = filterStatus   === "all" || t.status   === filterStatus
      const pOk = filterPriority === "all" || t.priority === filterPriority
      return sOk && pOk
    })
    .sort(compareTasks)

  const activeTasks = filteredTasks.filter(t => t.status !== "done")
  const doneTasks   = filteredTasks.filter(t => t.status === "done")
  const reorderable = view === "area"

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const updateField = async (taskId, field, value) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t))
    await supabase.from("tasks").update({ [field]: value }).eq("id", taskId)
  }

  const toggleToday = (task) => updateField(task.id, "focus_date", isToday(task) ? null : today)

  const saveEdit = async () => {
    if (!editingTask) return
    setSaving(true)
    const { id, task, priority, status, next_step } = editingTask
    const time_estimate = editingTask.time_estimate === "" || editingTask.time_estimate == null ? null : String(parseInt(editingTask.time_estimate, 10))
    const worth = editingTask.worth === "" || editingTask.worth == null ? null : parseInt(editingTask.worth, 10)
    const due_date = editingTask.due_date === "" || editingTask.due_date == null ? null : editingTask.due_date
    const updated = { ...editingTask, time_estimate, worth, due_date }
    setTasks(prev => prev.map(t => t.id === id ? updated : t))
    await supabase.from("tasks").update({ task, priority, time_estimate, worth, due_date, status, next_step }).eq("id", id)
    setEditingTask(null)
    setSaving(false)
  }

  const addTask = async () => {
    if (!newTask.task.trim() || !currentArea) return
    setSaving(true)
    const existing = tasks.filter(t => t.area === activeArea)
    const maxOrder = existing.reduce((m, t) => Math.max(m, t.sort_order || 0), 0)
    const newId    = `${areaPrefix(currentArea.label)}${existing.length + 1}_${Date.now()}`
    const time_estimate = newTask.time_estimate === "" ? null : String(parseInt(newTask.time_estimate, 10))
    const worth         = newTask.worth === "" ? null : parseInt(newTask.worth, 10)
    const toInsert = {
      task: newTask.task, priority: newTask.priority, next_step: newTask.next_step,
      time_estimate, worth,
      due_date: newTask.due_date || null,
      focus_date: newTask.focus_today ? today : null,
      id: newId, area: activeArea, status:"pending", sort_order: maxOrder + 1, user_id: userId,
    }
    const { data, error } = await supabase.from("tasks").insert(toInsert).select()
    if (error) { console.error(error); alert("No se pudo guardar la tarea.\n" + error.message); setSaving(false); return }
    if (data) setTasks(prev => [...prev, data[0]])
    setNewTask({ task:"", priority:"high", time_estimate:"", worth:"", due_date:"", focus_today:false, next_step:"" })
    setShowAddModal(false)
    setSaving(false)
  }

  const deleteTask = async (taskId) => {
    if (!confirm("¿Eliminar esta tarea?")) return
    setTasks(prev => prev.filter(t => t.id !== taskId))
    await supabase.from("tasks").delete().eq("id", taskId)
  }

  const addArea = async () => {
    if (!newArea.label.trim()) return
    setSaving(true)
    const id = "a_" + Date.now()
    const sort_order = areas.reduce((m, a) => Math.max(m, a.sort_order || 0), 0) + 1
    const row = { id, label: newArea.label.trim(), color: newArea.color, sort_order, user_id: userId }
    const { data, error } = await supabase.from("areas").insert(row).select()
    if (error) { console.error(error); alert("No se pudo crear la sección.\n" + error.message); setSaving(false); return }
    setAreas(prev => [...prev, data[0]])
    setActiveArea(id); setView("area")
    setNewArea({ label:"", color: AREA_COLORS[0] })
    setShowAreaModal(false)
    setSaving(false)
  }

  const deleteArea = async (areaId) => {
    const count = tasks.filter(t => t.area === areaId).length
    if (!confirm(count > 0
      ? `Esta sección tiene ${count} tarea(s). Se eliminarán junto con la sección. ¿Continuar?`
      : "¿Eliminar esta sección?")) return
    setAreas(prev => prev.filter(a => a.id !== areaId))
    setTasks(prev => prev.filter(t => t.area !== areaId))
    if (activeArea === areaId) setActiveArea(areas.find(a => a.id !== areaId)?.id || null)
    await supabase.from("tasks").delete().eq("area", areaId)
    await supabase.from("areas").delete().eq("id", areaId)
  }

  const reorderTask = async (draggedTaskId, targetTaskId) => {
    if (!manualMode || !reorderable || draggedTaskId === targetTaskId) return
    const dragged = tasks.find(t => t.id === draggedTaskId)
    const target  = tasks.find(t => t.id === targetTaskId)
    if (!dragged || !target) return
    if (dragged.priority !== target.priority) return
    if ((dragged.status === "done") !== (target.status === "done")) return
    const areaSorted = tasks.filter(t => t.area === activeArea)
      .sort((a, b) => (priorityRank[a.priority] - priorityRank[b.priority]) || (a.sort_order - b.sort_order))
    const without   = areaSorted.filter(t => t.id !== draggedTaskId)
    const targetIdx = without.findIndex(t => t.id === targetTaskId)
    without.splice(targetIdx, 0, dragged)
    const updates = []
    without.forEach((t, i) => { if (t.sort_order !== i + 1) updates.push({ id: t.id, sort_order: i + 1 }) })
    if (updates.length === 0) return
    setTasks(prev => prev.map(t => { const u = updates.find(x => x.id === t.id); return u ? { ...t, sort_order: u.sort_order } : t }))
    await Promise.all(updates.map(u => supabase.from("tasks").update({ sort_order: u.sort_order }).eq("id", u.id)))
  }

  const moveTask = async (taskId, dir) => {
    if (!manualMode || !reorderable) return
    const me = tasks.find(t => t.id === taskId)
    if (!me) return
    const siblings = filteredTasks.filter(t => t.priority === me.priority && (t.status === "done") === (me.status === "done"))
    const i = siblings.findIndex(t => t.id === taskId)
    const j = dir === "up" ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= siblings.length) return
    const nb = siblings[j]
    const a = me.sort_order, b = nb.sort_order
    if (a === b) return
    setTasks(prev => prev.map(t => t.id === me.id ? { ...t, sort_order: b } : t.id === nb.id ? { ...t, sort_order: a } : t))
    await Promise.all([
      supabase.from("tasks").update({ sort_order: b }).eq("id", me.id),
      supabase.from("tasks").update({ sort_order: a }).eq("id", nb.id),
    ])
  }

  const startEdit = (task) => setEditingTask({ ...task, time_estimate: parseMinutes(task) ?? "", worth: parseWorth(task) ?? "", due_date: task.due_date ?? "" })

  const starBtn = (task) => (
    <button onClick={()=>toggleToday(task)} title={isToday(task)?"Quitar de Hoy":"Marcar para hoy"}
      style={{ ...iconBtn, background:isToday(task)?"#f59e0b25":"#2a2a3e", color:isToday(task)?"#f59e0b":"#9999b5" }}>
      {isToday(task) ? "⭐" : "☆"}
    </button>
  )

  // ─── Render a single task row ─────────────────────────────────────────────────
  const renderRow = (task, idx, list) => {
    const statusObj   = STATUS_OPTIONS.find(s=>s.value===task.status)
    const priorityObj = PRIORITY_OPTIONS.find(p=>p.value===task.priority)
    const isDone      = task.status==="done"
    const isEditing   = editingTask?.id === task.id
    const mins        = parseMinutes(task)
    const w           = parseWorth(task)
    const di          = dueInfo(task)
    const isDragging  = draggedId === task.id
    const isFirst = idx === 0
    const isLast  = idx === list.length - 1

    if (isEditing) {
      const taskInput = <input value={editingTask.task} onChange={e=>setEditingTask(p=>({...p,task:e.target.value}))} style={inputStyle} />
      const prioInput = <select value={editingTask.priority} onChange={e=>setEditingTask(p=>({...p,priority:e.target.value}))} style={selectStyle}>{PRIORITY_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select>
      const timeInput = <input type="number" min={0} max={120} step={5} value={editingTask.time_estimate} onChange={e=>setEditingTask(p=>({...p, time_estimate: clampMin(e.target.value)}))} placeholder="min" style={inputStyle} />
      const worthInput = <input type="number" min={0} step={1} value={editingTask.worth} onChange={e=>setEditingTask(p=>({...p, worth: clampWorth(e.target.value)}))} placeholder="USD" style={inputStyle} />
      const dueInput = <input type="date" value={editingTask.due_date||""} onChange={e=>setEditingTask(p=>({...p, due_date:e.target.value}))} style={{...inputStyle, colorScheme:"dark"}} />
      const statusInput = <select value={editingTask.status} onChange={e=>setEditingTask(p=>({...p,status:e.target.value}))} style={selectStyle}>{STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select>
      const nextInput = <input value={editingTask.next_step||""} onChange={e=>setEditingTask(p=>({...p,next_step:e.target.value}))} style={inputStyle} />
      const saveBtns = (
        <div style={{ display:"flex", gap:4 }}>
          <button onClick={saveEdit} disabled={saving} style={{ padding:"6px 9px", borderRadius:5, border:"none", background:"#10b981", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>✓</button>
          <button onClick={()=>setEditingTask(null)} style={{ padding:"6px 9px", borderRadius:5, border:"none", background:"#374151", color:"#fff", cursor:"pointer", fontSize:13 }}>✕</button>
        </div>
      )
      if (isMobile) return (
        <div key={task.id} style={{ ...cardStyle, border:"1px solid #3a3a5e", display:"flex", flexDirection:"column", gap:10 }}>
          <FieldM label="Tarea">{taskInput}</FieldM>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}><FieldM label="Prioridad">{prioInput}</FieldM><FieldM label="Estado">{statusInput}</FieldM></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}><FieldM label="Tiempo (min)">{timeInput}</FieldM><FieldM label="Worth (USD)">{worthInput}</FieldM></div>
          <FieldM label="Fecha límite">{dueInput}</FieldM>
          <FieldM label="Next step">{nextInput}</FieldM>
          {saveBtns}
        </div>
      )
      return (
        <div key={task.id} style={{ ...gridRow, padding:"10px 16px", borderBottom:"1px solid #2a2a3e", background:"#20203a", alignItems:"center", gap:8 }}>
          <div style={{ fontSize:11, color:"#5a5a7a", fontWeight:600 }}>{task.id.split("_")[0]}</div>
          {taskInput}{prioInput}{timeInput}{worthInput}{dueInput}{statusInput}{nextInput}{saveBtns}
        </div>
      )
    }

    const arrows = manualMode && reorderable && (
      <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
        <button onClick={()=>moveTask(task.id,"up")} disabled={isFirst} title="Subir" style={{ ...arrowBtn, opacity:isFirst?0.25:1, cursor:isFirst?"default":"pointer" }}>▲</button>
        <button onClick={()=>moveTask(task.id,"down")} disabled={isLast} title="Bajar" style={{ ...arrowBtn, opacity:isLast?0.25:1, cursor:isLast?"default":"pointer" }}>▼</button>
      </div>
    )
    const dueBadge = di && <span style={{ fontSize:11, padding:"2px 7px", borderRadius:5, background:`${di.color}20`, color:di.color, fontWeight:600 }}>{di.text}</span>

    if (isMobile) return (
      <div key={task.id} style={{ ...cardStyle, opacity:isDone?0.6:1, borderColor:isToday(task)?"#f59e0b55":"#2a2a3e" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:"#5a5a7a", fontWeight:600 }}>{task.id.split("_")[0]}</span>
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:`${priorityObj?.color}20`, color:priorityObj?.color, fontWeight:600 }}>{priorityObj?.label}</span>
            {dueBadge}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {arrows}{starBtn(task)}
            <button onClick={()=>startEdit(task)} title="Editar" style={iconBtn}>✏️</button>
            <button onClick={()=>deleteTask(task.id)} title="Eliminar" style={iconBtn}>🗑️</button>
          </div>
        </div>
        <div style={{ fontSize:15, color:isDone?"#5a5a7a":"#e8e8f0", textDecoration:isDone?"line-through":"none", lineHeight:1.35, marginBottom:8, fontWeight:500 }}>{task.task}</div>
        <div style={{ display:"flex", gap:14, marginBottom:8, fontSize:12, color:"#9999b5" }}>
          <span>⏱ {mins!=null ? `${mins} min` : "—"}</span><span>💲 {w!=null ? fmtWorth(w) : "—"}</span>
        </div>
        <select value={task.status} onChange={e=>updateField(task.id,"status",e.target.value)} style={{ padding:"7px 10px", borderRadius:6, border:`1px solid ${statusObj?.color}40`, background:`${statusObj?.color}15`, color:statusObj?.color, fontSize:13, cursor:"pointer", fontWeight:500, width:"100%", marginBottom:8 }}>
          {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div contentEditable suppressContentEditableWarning onBlur={e=>updateField(task.id,"next_step",e.currentTarget.textContent.trim())} style={{ fontSize:12, color:"#9999b5", outline:"none", padding:"6px 8px", borderRadius:5, border:"1px solid #2a2a3e", cursor:"text", minHeight:20, lineHeight:1.4 }}>{task.next_step}</div>
      </div>
    )

    return (
      <div key={task.id}
        style={{ ...gridRow, padding:"11px 16px", borderBottom: !isLast?"1px solid #1f1f35":"none", alignItems:"center", gap:8, opacity:isDragging?0.4:(isDone?0.55:1), transition:"background 0.1s" }}
        onMouseEnter={e=>{ if(!draggedId) e.currentTarget.style.background="#20203a" }}
        onMouseLeave={e=>{ if(!draggedId) e.currentTarget.style.background="transparent" }}
        onDragOver={e=>{ if(draggedId) e.preventDefault() }}
        onDrop={e=>{ e.preventDefault(); if(draggedId) reorderTask(draggedId, task.id); setDraggedId(null) }}
      >
        <div draggable={manualMode && reorderable} onDragStart={()=> manualMode && reorderable && setDraggedId(task.id)} onDragEnd={()=>setDraggedId(null)}
          title={manualMode && reorderable ? "Arrastrar para reordenar" : ""}
          style={{ fontSize:11, color:"#5a5a7a", fontWeight:600, display:"flex", alignItems:"center", gap:5, cursor:(manualMode&&reorderable)?"grab":"default", userSelect:"none" }}>
          {manualMode && reorderable && <span style={{ fontSize:13, color:"#3f3f5a", lineHeight:1 }}>⠿</span>}
          {task.id.split("_")[0]}
        </div>
        <div style={{ fontSize:13, color:isDone?"#5a5a7a":"#e8e8f0", textDecoration:isDone?"line-through":"none", lineHeight:1.4 }}>{task.task}</div>
        <div><span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:`${priorityObj?.color}20`, color:priorityObj?.color, fontWeight:600 }}>{priorityObj?.label}</span></div>
        <div style={{ fontSize:12, color:"#7c7c9a" }}>{mins!=null ? `${mins} min` : "—"}</div>
        <div style={{ fontSize:12, color: w!=null ? "#84cc16" : "#7c7c9a", fontWeight: w!=null?600:400 }}>{w!=null ? fmtWorth(w) : "—"}</div>
        <div>{dueBadge || <span style={{ fontSize:12, color:"#5a5a7a" }}>—</span>}</div>
        <select value={task.status} onChange={e=>updateField(task.id,"status",e.target.value)} style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${statusObj?.color}40`, background:`${statusObj?.color}15`, color:statusObj?.color, fontSize:12, cursor:"pointer", fontWeight:500, width:"100%" }}>
          {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div contentEditable suppressContentEditableWarning onBlur={e=>updateField(task.id,"next_step",e.currentTarget.textContent.trim())}
          style={{ fontSize:12, color:"#9999b5", outline:"none", padding:"3px 6px", borderRadius:5, border:"1px solid transparent", cursor:"text", minHeight:20, lineHeight:1.4 }}
          onFocus={e=>e.currentTarget.style.borderColor="#2a2a4e"} onBlurCapture={e=>e.currentTarget.style.borderColor="transparent"}>{task.next_step}</div>
        <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
          {starBtn(task)}
          <button onClick={()=>startEdit(task)} title="Editar" style={iconBtn}>✏️</button>
          <button onClick={()=>deleteTask(task.id)} title="Eliminar" style={iconBtn}>🗑️</button>
        </div>
      </div>
    )
  }

  if (loading) return <Splash text="Cargando tareas..." />

  return (
    <div style={{ fontFamily:"'Inter', system-ui, sans-serif", minHeight:"100vh", background:"#0f0f13", color:"#e8e8f0" }}>

      {/* ── Header ── */}
      <div style={{ background:"linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)", borderBottom:"1px solid #2a2a3e", padding: isMobile?"14px 16px":"18px 24px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ margin:0, fontSize:isMobile?17:20, fontWeight:700, color:"#fff", letterSpacing:"-0.5px" }}>🗺️ Desarrollo Personal</h1>
            <p style={{ margin:"3px 0 0", fontSize:12, color:"#7c7c9a" }}>{new Date().toLocaleDateString("es-CL",{ weekday:"long", day:"numeric", month:"long" })}</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:20, fontWeight:700, color:"#10b981" }}>{doneAll}<span style={{ fontSize:12, color:"#5a5a7a", fontWeight:400 }}>/{totalAll}</span></div>
              <div style={{ fontSize:11, color:"#7c7c9a" }}>completadas</div>
            </div>
            <div style={{ width:72, height:5, background:"#2a2a3e", borderRadius:3, overflow:"hidden" }}>
              <div style={{ width:`${totalAll ? (doneAll/totalAll)*100 : 0}%`, height:"100%", background:"linear-gradient(90deg,#6366f1,#10b981)", borderRadius:3, transition:"width 0.5s" }} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
              <span style={{ fontSize:11, color:"#7c7c9a", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{session.user.email}</span>
              <button onClick={()=>supabase.auth.signOut()} style={{ fontSize:11, color:"#9999b5", background:"#2a2a3e", border:"none", borderRadius:5, padding:"3px 8px", cursor:"pointer" }}>Cerrar sesión</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding: isMobile?"16px 12px":"20px 24px" }}>

        {/* ── Tabs: Hoy + áreas + agregar sección ── */}
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
          <button onClick={()=>setView("today")} style={{
            padding:"8px 14px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight: view==="today"?700:500,
            border: view==="today" ? "2px solid #f59e0b" : "2px solid transparent", background: view==="today" ? "#f59e0b1f" : "#1a1a2e",
            color: view==="today" ? "#f59e0b" : "#c9a24a", display:"flex", alignItems:"center", gap:8, transition:"all 0.15s",
          }}>
            ⭐ Hoy <span style={{ background: todayCount>0?"#f59e0b30":"#ffffff15", color: todayCount>0?"#f59e0b":"#7c7c9a", borderRadius:20, padding:"1px 7px", fontSize:11, fontWeight:600 }}>{todayCount}</span>
          </button>
          <div style={{ width:1, alignSelf:"stretch", background:"#2a2a3e", margin:"0 2px" }} />
          {areas.map(area => {
            const stats   = getAreaStats(area.id)
            const isActive = view==="area" && activeArea === area.id
            return (
              <button key={area.id} onClick={() => { setView("area"); setActiveArea(area.id) }} style={{
                padding:"8px 14px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight: isActive ? 600 : 400,
                border: isActive ? `2px solid ${area.color}` : "2px solid transparent", background: isActive ? `${area.color}18` : "#1a1a2e",
                color: isActive ? area.color : "#9999b5", transition:"all 0.15s", display:"flex", alignItems:"center", gap:8,
              }}>
                {area.label}
                <span style={{ background: stats.done===stats.total && stats.total>0 ? "#10b98130":"#ffffff15", color: stats.done===stats.total && stats.total>0 ? "#10b981":"#7c7c9a", borderRadius:20, padding:"1px 7px", fontSize:11, fontWeight:600 }}>{stats.done}/{stats.total}</span>
              </button>
            )
          })}
          <button onClick={()=>setShowAreaModal(true)} title="Agregar sección" style={{
            padding:"8px 12px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:500,
            border:"2px dashed #3a3a5e", background:"transparent", color:"#7c7c9a",
          }}>+ Sección</button>
        </div>

        {/* ── Vista Hoy hint ── */}
        {view==="today" && (
          <div style={{ marginBottom:14, padding:"12px 16px", background:"#f59e0b12", border:"1px solid #f59e0b35", borderRadius:10 }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#f59e0b", marginBottom:2 }}>⭐ Tu foco de hoy</div>
            <div style={{ fontSize:12, color:"#b89968" }}>
              {todayCount===0 ? "Aún no eliges tareas para hoy. Ve a una sección y marca la ⭐ en 1–3 tareas."
                : todayCount<=3 ? `${todayCount} tarea${todayCount>1?"s":""} para hoy. ¡Enfócate en cerrarlas!`
                : `Tienes ${todayCount} para hoy — son muchas. Lo ideal son máximo 3 para no dispersarte.`}
            </div>
          </div>
        )}

        {/* ── Filters + Sort + Add ── */}
        <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="all">Todos los estados</option>{STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={selectStyle}>
            <option value="all">Todas las prioridades</option>{PRIORITY_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={sortMode} onChange={e=>setSortMode(e.target.value)} style={selectStyle} title="El orden por prioridad (Alta→Media→Baja) siempre se mantiene">
            <option value="manual">↕ Orden manual</option>
            <option value="due_asc">📅 Vence ↑ (más próximo)</option>
            <option value="time_asc">⏱ Tiempo ↑ (menor)</option>
            <option value="time_desc">⏱ Tiempo ↓ (mayor)</option>
            <option value="worth_asc">💲 Worth ↑ (menor)</option>
            <option value="worth_desc">💲 Worth ↓ (mayor)</option>
          </select>
          <div style={{ flex:1 }} />
          <button onClick={()=>setShowAddModal(true)} disabled={!currentArea} style={{ padding:"7px 16px", borderRadius:7, border:"none", background: view==="today" ? "#6366f1" : (currentArea?.color || "#6366f1"), color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, ...(isMobile?{flex:"1 0 100%"}:{}) }}>+ Agregar tarea</button>
        </div>

        {/* ── Active tasks ── */}
        {isMobile ? (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {activeTasks.length === 0 && <div style={{ padding:30, textAlign:"center", color:"#5a5a7a", fontSize:14, background:"#1a1a2e", borderRadius:12, border:"1px solid #2a2a3e" }}>{view==="today" ? "No hay tareas marcadas para hoy" : "No hay tareas pendientes con estos filtros"}</div>}
            {activeTasks.map((task, idx) => renderRow(task, idx, activeTasks))}
          </div>
        ) : (
          <div style={{ background:"#1a1a2e", borderRadius:12, border:"1px solid #2a2a3e", overflow:"hidden" }}>
            <div style={{ ...gridRow, padding:"10px 16px", borderBottom:"1px solid #2a2a3e", fontSize:11, fontWeight:600, color:"#5a5a7a", textTransform:"uppercase", letterSpacing:"0.5px" }}>
              <div>#</div><div>Tarea</div><div>Prioridad</div><div>Tiempo</div><div>Worth</div><div>Vence</div><div>Estado</div><div>Next Step</div><div></div>
            </div>
            {activeTasks.length === 0 && <div style={{ padding:40, textAlign:"center", color:"#5a5a7a", fontSize:14 }}>{view==="today" ? "No hay tareas marcadas para hoy" : "No hay tareas pendientes con estos filtros"}</div>}
            {activeTasks.map((task, idx) => renderRow(task, idx, activeTasks))}
          </div>
        )}

        {/* ── Done section ── */}
        {doneTasks.length > 0 && (
          <div style={{ marginTop:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:600, color:"#10b981" }}>✅ Completadas</span>
              <span style={{ fontSize:11, color:"#5a5a7a", background:"#10b98120", borderRadius:20, padding:"1px 8px", fontWeight:600 }}>{doneTasks.length}</span>
            </div>
            {isMobile ? (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>{doneTasks.map((task, idx) => renderRow(task, idx, doneTasks))}</div>
            ) : (
              <div style={{ background:"#15151f", borderRadius:12, border:"1px solid #1f3a2e", overflow:"hidden" }}>{doneTasks.map((task, idx) => renderRow(task, idx, doneTasks))}</div>
            )}
          </div>
        )}

        {/* ── Area progress ── */}
        {view==="area" && currentArea && (() => {
          const s = getAreaStats(activeArea); const pct = s.total ? Math.round((s.done/s.total)*100) : 0
          return (
            <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ flex:1, height:4, background:"#2a2a3e", borderRadius:2, overflow:"hidden" }}><div style={{ width:`${pct}%`, height:"100%", background:currentArea.color, borderRadius:2, transition:"width 0.4s" }} /></div>
              <span style={{ fontSize:12, color:"#5a5a7a" }}>{s.done}/{s.total} completadas ({pct}%)</span>
              <button onClick={()=>deleteArea(activeArea)} title="Eliminar esta sección" style={{ fontSize:11, color:"#7c5a5a", background:"transparent", border:"1px solid #3a2a2a", borderRadius:5, padding:"3px 8px", cursor:"pointer" }}>🗑️ Sección</button>
            </div>
          )
        })()}
      </div>

      {/* ── Add task modal ── */}
      {showAddModal && currentArea && (
        <div style={modalOverlay}>
          <div style={{ ...modalCard, width:480, padding:isMobile?20:28 }}>
            <h3 style={{ margin:"0 0 20px", fontSize:16, color:currentArea.color }}>+ Nueva tarea — {currentArea.label}</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <Field label="Tarea *"><input value={newTask.task} onChange={e=>setNewTask(p=>({...p,task:e.target.value}))} placeholder="Describe la tarea..." style={inputStyle} /></Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Prioridad"><select value={newTask.priority} onChange={e=>setNewTask(p=>({...p,priority:e.target.value}))} style={{ ...selectStyle, width:"100%" }}>{PRIORITY_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></Field>
                <Field label="Fecha límite"><input type="date" value={newTask.due_date} onChange={e=>setNewTask(p=>({...p,due_date:e.target.value}))} style={{ ...inputStyle, colorScheme:"dark" }} /></Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Tiempo (min)"><input type="number" min={0} max={120} step={5} value={newTask.time_estimate} onChange={e=>setNewTask(p=>({...p, time_estimate: clampMin(e.target.value)}))} placeholder="0–120" style={inputStyle} /></Field>
                <Field label="Worth (USD)"><input type="number" min={0} step={1} value={newTask.worth} onChange={e=>setNewTask(p=>({...p, worth: clampWorth(e.target.value)}))} placeholder="$" style={inputStyle} /></Field>
              </div>
              <Field label="Next Step"><input value={newTask.next_step} onChange={e=>setNewTask(p=>({...p,next_step:e.target.value}))} placeholder="¿Cuál es el primer paso?" style={inputStyle} /></Field>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#c9a24a", cursor:"pointer", userSelect:"none" }}>
                <input type="checkbox" checked={newTask.focus_today} onChange={e=>setNewTask(p=>({...p,focus_today:e.target.checked}))} /> ⭐ Marcar para hoy
              </label>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"flex-end" }}>
              <button onClick={()=>setShowAddModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={addTask} disabled={saving} style={{ ...btnPrimary, background:currentArea.color }}>{saving ? "Guardando..." : "Agregar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add section modal ── */}
      {showAreaModal && (
        <div style={modalOverlay}>
          <div style={{ ...modalCard, width:380, padding:isMobile?20:28 }}>
            <h3 style={{ margin:"0 0 20px", fontSize:16, color:"#e8e8f0" }}>+ Nueva sección</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <Field label="Nombre"><input value={newArea.label} onChange={e=>setNewArea(p=>({...p,label:e.target.value}))} placeholder="ej: 📚 Estudios" style={inputStyle} /></Field>
              <div>
                <label style={{ fontSize:11, color:"#7c7c9a", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", display:"block", marginBottom:8 }}>Color</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {AREA_COLORS.map(c => (
                    <button key={c} onClick={()=>setNewArea(p=>({...p,color:c}))} style={{
                      width:28, height:28, borderRadius:"50%", background:c, cursor:"pointer",
                      border: newArea.color===c ? "3px solid #fff" : "3px solid transparent", boxShadow: newArea.color===c?`0 0 0 2px ${c}`:"none",
                    }} />
                  ))}
                </div>
              </div>
              <div style={{ fontSize:13, color:newArea.color, fontWeight:600 }}>Vista previa: {newArea.label || "Tu sección"}</div>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:22, justifyContent:"flex-end" }}>
              <button onClick={()=>setShowAreaModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={addArea} disabled={saving || !newArea.label.trim()} style={{ ...btnPrimary, background:newArea.color }}>{saving ? "Creando..." : "Crear sección"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  AUTH (login / signup)
// ════════════════════════════════════════════════════════════════════════════
function Auth() {
  const [mode, setMode]   = useState("login") // login | signup
  const [email, setEmail] = useState("")
  const [pw, setPw]       = useState("")
  const [msg, setMsg]     = useState(null)
  const [busy, setBusy]   = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password: pw })
      if (error) setMsg({ type:"err", text: error.message })
      else if (!data.session) setMsg({ type:"ok", text:"Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión." })
      // si hay sesión, onAuthStateChange entra solo
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
      if (error) setMsg({ type:"err", text: error.message })
    }
    setBusy(false)
  }

  return (
    <div style={{ fontFamily:"'Inter', system-ui, sans-serif", minHeight:"100vh", background:"#0f0f13", color:"#e8e8f0", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <form onSubmit={submit} style={{ width:360, maxWidth:"100%", background:"#1a1a2e", border:"1px solid #2a2a3e", borderRadius:16, padding:28, boxShadow:"0 20px 60px #000000aa" }}>
        <div style={{ textAlign:"center", marginBottom:22 }}>
          <div style={{ fontSize:34 }}>🗺️</div>
          <h1 style={{ margin:"6px 0 2px", fontSize:20, color:"#fff" }}>Desarrollo Personal</h1>
          <p style={{ margin:0, fontSize:13, color:"#7c7c9a" }}>{mode==="login" ? "Inicia sesión para ver tus tareas" : "Crea tu cuenta"}</p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" style={{ ...inputStyle, fontSize:14, padding:"10px 12px" }} />
          <input type="password" required value={pw} onChange={e=>setPw(e.target.value)} placeholder="Contraseña (mín. 6)" minLength={6} style={{ ...inputStyle, fontSize:14, padding:"10px 12px" }} />
          {msg && <div style={{ fontSize:12, color: msg.type==="err"?"#f87171":"#34d399", background: msg.type==="err"?"#7f1d1d30":"#10b98120", padding:"8px 10px", borderRadius:6 }}>{msg.text}</div>}
          <button type="submit" disabled={busy} style={{ padding:"11px", borderRadius:8, border:"none", background:"#6366f1", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600 }}>
            {busy ? "..." : mode==="login" ? "Entrar" : "Crear cuenta"}
          </button>
        </div>
        <div style={{ textAlign:"center", marginTop:16, fontSize:13, color:"#7c7c9a" }}>
          {mode==="login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
          <button type="button" onClick={()=>{ setMode(mode==="login"?"signup":"login"); setMsg(null) }} style={{ background:"none", border:"none", color:"#818cf8", cursor:"pointer", fontSize:13, fontWeight:600, padding:0 }}>
            {mode==="login" ? "Crear una" : "Inicia sesión"}
          </button>
        </div>
      </form>
    </div>
  )
}

function Splash({ text }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0f0f13", color:"#6366f1", fontSize:16, gap:12, fontFamily:"'Inter', system-ui, sans-serif" }}>
      <span style={{ fontSize:28 }}>⚡</span> {text}
    </div>
  )
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────
const priorityRank = { high: 0, medium: 1, low: 2 }
const AREA_COLORS  = ["#6366f1","#22c55e","#f97316","#06b6d4","#ec4899","#84cc16","#eab308","#ef4444","#8b5cf6","#14b8a6"]
const parseMinutes = t => { const n = parseInt(t?.time_estimate, 10); return Number.isFinite(n) ? n : null }
const parseWorth   = t => { if (t?.worth == null || t?.worth === "") return null; const n = Number(t.worth); return Number.isFinite(n) ? n : null }
const fmtWorth     = n => "$" + n.toLocaleString("en-US")
const clampMin     = v => v === "" ? "" : String(Math.min(120, Math.max(0, Math.floor(Number(v) || 0))))
const clampWorth   = v => v === "" ? "" : String(Math.max(0, Math.floor(Number(v) || 0)))
const todayISO     = () => { const d = new Date(); const z = n => String(n).padStart(2,"0"); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}` }
const fmtDate      = iso => { const [y,m,dd] = iso.split("-").map(Number); return new Date(y, m-1, dd).toLocaleDateString("es-CL", { day:"numeric", month:"short" }) }
const areaPrefix   = label => (label.replace(/[^A-Za-zÀ-ÿ]/g,"").slice(0,2).toUpperCase() || "T")

// ─── Shared styles ────────────────────────────────────────────────────────────
const gridRow      = { display:"grid", gridTemplateColumns:"34px 1fr 84px 64px 74px 92px 120px 1fr 104px" }
const cardStyle    = { background:"#1a1a2e", borderRadius:12, border:"1px solid #2a2a3e", padding:14 }
const selectStyle  = { padding:"6px 10px", borderRadius:6, border:"1px solid #2a2a3e", background:"#0f0f13", color:"#e8e8f0", fontSize:12, cursor:"pointer" }
const inputStyle   = { padding:"6px 10px", borderRadius:6, border:"1px solid #2a2a3e", background:"#0f0f13", color:"#e8e8f0", fontSize:13, width:"100%", boxSizing:"border-box" }
const iconBtn      = { padding:"4px 7px", borderRadius:5, border:"none", background:"#2a2a3e", color:"#9999b5", cursor:"pointer", fontSize:12 }
const arrowBtn     = { padding:"0 6px", borderRadius:4, border:"none", background:"#2a2a3e", color:"#9999b5", fontSize:9, lineHeight:"14px", height:14 }
const modalOverlay = { position:"fixed", inset:0, background:"#000000cc", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16 }
const modalCard    = { background:"#1a1a2e", borderRadius:14, maxWidth:"100%", border:"1px solid #2a2a3e", boxShadow:"0 20px 60px #000000aa" }
const btnGhost     = { padding:"8px 16px", borderRadius:7, border:"1px solid #2a2a3e", background:"transparent", color:"#9999b5", cursor:"pointer", fontSize:13 }
const btnPrimary   = { padding:"8px 20px", borderRadius:7, border:"none", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }

function Field({ label, children }) {
  return <div><label style={{ fontSize:11, color:"#7c7c9a", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", display:"block", marginBottom:5 }}>{label}</label>{children}</div>
}
function FieldM({ label, children }) {
  return <div><label style={{ fontSize:10, color:"#7c7c9a", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", display:"block", marginBottom:4 }}>{label}</label>{children}</div>
}

function useIsMobile() {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false)
  useEffect(() => {
    const onResize = () => setM(window.innerWidth < 768)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return m
}
