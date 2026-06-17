import { useState, useEffect, useCallback } from "react"
import { supabase } from "./supabase"
import { AREAS, STATUS_OPTIONS, PRIORITY_OPTIONS, INITIAL_TASKS } from "./data"

export default function App() {
  const [tasks, setTasks]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [seeded, setSeeded]         = useState(false)
  const [activeArea, setActiveArea] = useState("sleep")
  const [filterStatus, setFilterStatus]     = useState("all")
  const [filterPriority, setFilterPriority] = useState("all")
  const [editingTask, setEditingTask]       = useState(null)
  const [showAddModal, setShowAddModal]     = useState(false)
  const [newTask, setNewTask] = useState({ task:"", priority:"high", time_estimate:"", next_step:"" })
  const [saving, setSaving] = useState(false)
  const [draggedId, setDraggedId] = useState(null)

  // ─── Load tasks from Supabase ───────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase.from("tasks").select("*").order("sort_order")
    if (error) { console.error(error); return }
    if (data.length === 0 && !seeded) {
      await seedInitialData()
    } else {
      setTasks(data)
      setLoading(false)
    }
  }, [seeded])

  const seedInitialData = async () => {
    const { error } = await supabase.from("tasks").insert(INITIAL_TASKS)
    if (error) { console.error("Seed error:", error); setLoading(false); return }
    setSeeded(true)
    const { data } = await supabase.from("tasks").select("*").order("sort_order")
    setTasks(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const areaTasks    = tasks.filter(t => t.area === activeArea)
  const currentArea  = AREAS.find(a => a.id === activeArea)
  const totalAll     = tasks.length
  const doneAll      = tasks.filter(t => t.status === "done").length

  const getAreaStats = (areaId) => {
    const at = tasks.filter(t => t.area === areaId)
    return { total: at.length, done: at.filter(t => t.status === "done").length }
  }

  const filteredTasks = areaTasks
    .filter(t => {
      const sOk = filterStatus   === "all" || t.status   === filterStatus
      const pOk = filterPriority === "all" || t.priority === filterPriority
      return sOk && pOk
    })
    .sort((a, b) =>
      (priorityRank[a.priority] - priorityRank[b.priority]) ||
      (a.sort_order - b.sort_order)
    )

  const activeTasks = filteredTasks.filter(t => t.status !== "done")
  const doneTasks   = filteredTasks.filter(t => t.status === "done")

  // ─── Update a single field ──────────────────────────────────────────────────
  const updateField = async (taskId, field, value) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t))
    await supabase.from("tasks").update({ [field]: value }).eq("id", taskId)
  }

  // ─── Save full edit ─────────────────────────────────────────────────────────
  const saveEdit = async () => {
    if (!editingTask) return
    setSaving(true)
    const { id, task, priority, time_estimate, status, next_step } = editingTask
    setTasks(prev => prev.map(t => t.id === id ? editingTask : t))
    await supabase.from("tasks").update({ task, priority, time_estimate, status, next_step }).eq("id", id)
    setEditingTask(null)
    setSaving(false)
  }

  // ─── Add task ───────────────────────────────────────────────────────────────
  const addTask = async () => {
    if (!newTask.task.trim()) return
    setSaving(true)
    const prefixes = { sleep:"S", food:"A", startup:"ST", sport:"D", content:"C", finance:"F" }
    const prefix   = prefixes[activeArea]
    const existing = tasks.filter(t => t.area === activeArea)
    const maxOrder = existing.reduce((m, t) => Math.max(m, t.sort_order || 0), 0)
    const newId    = `${prefix}${existing.length + 1}_${Date.now()}`
    const toInsert = { ...newTask, id: newId, area: activeArea, status:"pending", sort_order: maxOrder + 1 }
    const { data } = await supabase.from("tasks").insert(toInsert).select()
    if (data) setTasks(prev => [...prev, data[0]])
    setNewTask({ task:"", priority:"high", time_estimate:"", next_step:"" })
    setShowAddModal(false)
    setSaving(false)
  }

  // ─── Delete task ────────────────────────────────────────────────────────────
  const deleteTask = async (taskId) => {
    if (!confirm("¿Eliminar esta tarea?")) return
    setTasks(prev => prev.filter(t => t.id !== taskId))
    await supabase.from("tasks").delete().eq("id", taskId)
  }

  // ─── Reorder by drag (only within same priority + same section) ───────────────
  const reorderTask = async (draggedTaskId, targetTaskId) => {
    if (draggedTaskId === targetTaskId) return
    const dragged = tasks.find(t => t.id === draggedTaskId)
    const target  = tasks.find(t => t.id === targetTaskId)
    if (!dragged || !target) return
    // Solo dentro del mismo grupo de prioridad y misma sección (activas/completadas)
    if (dragged.priority !== target.priority) return
    if ((dragged.status === "done") !== (target.status === "done")) return

    // Orden actual del área tal como se muestra
    const areaSorted = tasks
      .filter(t => t.area === activeArea)
      .sort((a, b) =>
        (priorityRank[a.priority] - priorityRank[b.priority]) ||
        (a.sort_order - b.sort_order)
      )

    const without   = areaSorted.filter(t => t.id !== draggedTaskId)
    const targetIdx = without.findIndex(t => t.id === targetTaskId)
    without.splice(targetIdx, 0, dragged) // insertar la arrastrada justo antes de la objetivo

    // Reasignar sort_order secuencial; los grupos de prioridad se mantienen porque el orden ya viene agrupado
    const updates = []
    without.forEach((t, i) => {
      if (t.sort_order !== i + 1) updates.push({ id: t.id, sort_order: i + 1 })
    })
    if (updates.length === 0) return

    setTasks(prev => prev.map(t => {
      const u = updates.find(x => x.id === t.id)
      return u ? { ...t, sort_order: u.sort_order } : t
    }))
    await Promise.all(updates.map(u =>
      supabase.from("tasks").update({ sort_order: u.sort_order }).eq("id", u.id)
    ))
  }

  // ─── Render a single task row (reused by active + done sections) ──────────────
  const renderRow = (task, idx, list) => {
    const statusObj   = STATUS_OPTIONS.find(s=>s.value===task.status)
    const priorityObj = PRIORITY_OPTIONS.find(p=>p.value===task.priority)
    const isDone      = task.status==="done"
    const isEditing   = editingTask?.id === task.id

    if (isEditing) return (
      <div key={task.id} style={{ ...gridRow, padding:"10px 16px", borderBottom:"1px solid #2a2a3e", background:"#20203a", alignItems:"center", gap:8 }}>
        <div style={{ fontSize:11, color:"#5a5a7a", fontWeight:600 }}>{task.id.split("_")[0]}</div>
        <input value={editingTask.task} onChange={e=>setEditingTask(p=>({...p,task:e.target.value}))} style={inputStyle} />
        <select value={editingTask.priority} onChange={e=>setEditingTask(p=>({...p,priority:e.target.value}))} style={selectStyle}>
          {PRIORITY_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <input value={editingTask.time_estimate} onChange={e=>setEditingTask(p=>({...p,time_estimate:e.target.value}))} style={inputStyle} />
        <select value={editingTask.status} onChange={e=>setEditingTask(p=>({...p,status:e.target.value}))} style={selectStyle}>
          {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input value={editingTask.next_step} onChange={e=>setEditingTask(p=>({...p,next_step:e.target.value}))} style={inputStyle} />
        <div style={{ display:"flex", gap:4 }}>
          <button onClick={saveEdit} disabled={saving} style={{ padding:"4px 9px", borderRadius:5, border:"none", background:"#10b981", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>✓</button>
          <button onClick={()=>setEditingTask(null)} style={{ padding:"4px 9px", borderRadius:5, border:"none", background:"#374151", color:"#fff", cursor:"pointer", fontSize:13 }}>✕</button>
        </div>
      </div>
    )

    const isDragging = draggedId === task.id
    return (
      <div key={task.id}
        style={{ ...gridRow, padding:"11px 16px", borderBottom: idx<list.length-1?"1px solid #1f1f35":"none", alignItems:"center", gap:8, opacity:isDragging?0.4:(isDone?0.55:1), transition:"background 0.1s" }}
        onMouseEnter={e=>{ if(!draggedId) e.currentTarget.style.background="#20203a" }}
        onMouseLeave={e=>{ if(!draggedId) e.currentTarget.style.background="transparent" }}
        onDragOver={e=>{ if(draggedId) e.preventDefault() }}
        onDrop={e=>{ e.preventDefault(); if(draggedId) reorderTask(draggedId, task.id); setDraggedId(null) }}
      >
        <div
          draggable
          onDragStart={()=>setDraggedId(task.id)}
          onDragEnd={()=>setDraggedId(null)}
          title="Arrastrar para reordenar (dentro de su prioridad)"
          style={{ fontSize:11, color:"#5a5a7a", fontWeight:600, display:"flex", alignItems:"center", gap:5, cursor:"grab", userSelect:"none" }}
        >
          <span style={{ fontSize:13, color:"#3f3f5a", lineHeight:1 }}>⠿</span>
          {task.id.split("_")[0]}
        </div>

        <div style={{ fontSize:13, color:isDone?"#5a5a7a":"#e8e8f0", textDecoration:isDone?"line-through":"none", lineHeight:1.4 }}>
          {task.task}
        </div>

        <div>
          <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:`${priorityObj?.color}20`, color:priorityObj?.color, fontWeight:600 }}>
            {priorityObj?.label}
          </span>
        </div>

        <div style={{ fontSize:12, color:"#7c7c9a" }}>{task.time_estimate}</div>

        <select value={task.status} onChange={e=>updateField(task.id,"status",e.target.value)} style={{
          padding:"4px 8px", borderRadius:6, border:`1px solid ${statusObj?.color}40`,
          background:`${statusObj?.color}15`, color:statusObj?.color, fontSize:12, cursor:"pointer", fontWeight:500, width:"100%",
        }}>
          {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <div
          contentEditable suppressContentEditableWarning
          onBlur={e=>updateField(task.id,"next_step",e.currentTarget.textContent.trim())}
          style={{ fontSize:12, color:"#9999b5", outline:"none", padding:"3px 6px", borderRadius:5, border:"1px solid transparent", cursor:"text", minHeight:20, lineHeight:1.4 }}
          onFocus={e=>e.currentTarget.style.borderColor="#2a2a4e"}
          onBlurCapture={e=>e.currentTarget.style.borderColor="transparent"}
        >
          {task.next_step}
        </div>

        <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
          <button onClick={()=>setEditingTask({...task})} title="Editar" style={iconBtn}>✏️</button>
          <button onClick={()=>deleteTask(task.id)} title="Eliminar" style={iconBtn}>🗑️</button>
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0f0f13", color:"#6366f1", fontSize:16, gap:12 }}>
      <span style={{ fontSize:28 }}>⚡</span> Cargando tareas...
    </div>
  )

  return (
    <div style={{ fontFamily:"'Inter', system-ui, sans-serif", minHeight:"100vh", background:"#0f0f13", color:"#e8e8f0" }}>

      {/* ── Header ── */}
      <div style={{ background:"linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)", borderBottom:"1px solid #2a2a3e", padding:"18px 24px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:"#fff", letterSpacing:"-0.5px" }}>🗺️ Desarrollo Personal</h1>
            <p style={{ margin:"3px 0 0", fontSize:12, color:"#7c7c9a" }}>
              {new Date().toLocaleDateString("es-CL",{ weekday:"long", day:"numeric", month:"long" })}
            </p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:20, fontWeight:700, color:"#10b981" }}>{doneAll}<span style={{ fontSize:12, color:"#5a5a7a", fontWeight:400 }}>/{totalAll}</span></div>
              <div style={{ fontSize:11, color:"#7c7c9a" }}>completadas</div>
            </div>
            <div style={{ width:72, height:5, background:"#2a2a3e", borderRadius:3, overflow:"hidden" }}>
              <div style={{ width:`${totalAll ? (doneAll/totalAll)*100 : 0}%`, height:"100%", background:"linear-gradient(90deg,#6366f1,#10b981)", borderRadius:3, transition:"width 0.5s" }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"20px 24px" }}>

        {/* ── Area tabs ── */}
        <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          {AREAS.map(area => {
            const stats   = getAreaStats(area.id)
            const isActive = activeArea === area.id
            return (
              <button key={area.id} onClick={() => setActiveArea(area.id)} style={{
                padding:"8px 14px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight: isActive ? 600 : 400,
                border: isActive ? `2px solid ${area.color}` : "2px solid transparent",
                background: isActive ? `${area.color}18` : "#1a1a2e",
                color: isActive ? area.color : "#9999b5",
                transition:"all 0.15s", display:"flex", alignItems:"center", gap:8,
              }}>
                {area.label}
                <span style={{
                  background: stats.done===stats.total && stats.total>0 ? "#10b98130":"#ffffff15",
                  color: stats.done===stats.total && stats.total>0 ? "#10b981":"#7c7c9a",
                  borderRadius:20, padding:"1px 7px", fontSize:11, fontWeight:600,
                }}>
                  {stats.done}/{stats.total}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Filters + Add ── */}
        <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="all">Todos los estados</option>
            {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={selectStyle}>
            <option value="all">Todas las prioridades</option>
            {PRIORITY_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <div style={{ flex:1 }} />
          <button onClick={()=>setShowAddModal(true)} style={{
            padding:"7px 16px", borderRadius:7, border:"none", background:currentArea.color,
            color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600,
          }}>+ Agregar tarea</button>
        </div>

        {/* ── Table ── */}
        <div style={{ background:"#1a1a2e", borderRadius:12, border:"1px solid #2a2a3e", overflow:"hidden" }}>

          {/* Header row */}
          <div style={{ ...gridRow, padding:"10px 16px", borderBottom:"1px solid #2a2a3e", fontSize:11, fontWeight:600, color:"#5a5a7a", textTransform:"uppercase", letterSpacing:"0.5px" }}>
            <div>#</div><div>Tarea</div><div>Prioridad</div><div>Tiempo</div><div>Estado</div><div>Next Step</div><div></div>
          </div>

          {activeTasks.length === 0 && (
            <div style={{ padding:40, textAlign:"center", color:"#5a5a7a", fontSize:14 }}>No hay tareas pendientes con estos filtros</div>
          )}

          {activeTasks.map((task, idx) => renderRow(task, idx, activeTasks))}
        </div>

        {/* ── Done section ── */}
        {doneTasks.length > 0 && (
          <div style={{ marginTop:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:600, color:"#10b981" }}>✅ Completadas</span>
              <span style={{ fontSize:11, color:"#5a5a7a", background:"#10b98120", borderRadius:20, padding:"1px 8px", fontWeight:600 }}>{doneTasks.length}</span>
            </div>
            <div style={{ background:"#15151f", borderRadius:12, border:"1px solid #1f3a2e", overflow:"hidden" }}>
              {doneTasks.map((task, idx) => renderRow(task, idx, doneTasks))}
            </div>
          </div>
        )}

        {/* ── Area progress ── */}
        {(() => {
          const s   = getAreaStats(activeArea)
          const pct = s.total ? Math.round((s.done/s.total)*100) : 0
          return (
            <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ flex:1, height:4, background:"#2a2a3e", borderRadius:2, overflow:"hidden" }}>
                <div style={{ width:`${pct}%`, height:"100%", background:currentArea.color, borderRadius:2, transition:"width 0.4s" }} />
              </div>
              <span style={{ fontSize:12, color:"#5a5a7a" }}>{s.done}/{s.total} completadas ({pct}%)</span>
            </div>
          )
        })()}
      </div>

      {/* ── Add modal ── */}
      {showAddModal && (
        <div style={{ position:"fixed", inset:0, background:"#000000cc", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"#1a1a2e", borderRadius:14, padding:28, width:460, border:"1px solid #2a2a3e", boxShadow:"0 20px 60px #000000aa" }}>
            <h3 style={{ margin:"0 0 20px", fontSize:16, color:currentArea.color }}>+ Nueva tarea — {currentArea.label}</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <Field label="Tarea *">
                <input value={newTask.task} onChange={e=>setNewTask(p=>({...p,task:e.target.value}))} placeholder="Describe la tarea..." style={{ ...inputStyle, width:"100%", boxSizing:"border-box" }} />
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Prioridad">
                  <select value={newTask.priority} onChange={e=>setNewTask(p=>({...p,priority:e.target.value}))} style={{ ...selectStyle, width:"100%" }}>
                    {PRIORITY_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="Tiempo estimado">
                  <input value={newTask.time_estimate} onChange={e=>setNewTask(p=>({...p,time_estimate:e.target.value}))} placeholder="ej: 30 min" style={{ ...inputStyle, width:"100%", boxSizing:"border-box" }} />
                </Field>
              </div>
              <Field label="Next Step">
                <input value={newTask.next_step} onChange={e=>setNewTask(p=>({...p,next_step:e.target.value}))} placeholder="¿Cuál es el primer paso?" style={{ ...inputStyle, width:"100%", boxSizing:"border-box" }} />
              </Field>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"flex-end" }}>
              <button onClick={()=>setShowAddModal(false)} style={{ padding:"8px 16px", borderRadius:7, border:"1px solid #2a2a3e", background:"transparent", color:"#9999b5", cursor:"pointer", fontSize:13 }}>Cancelar</button>
              <button onClick={addTask} disabled={saving} style={{ padding:"8px 20px", borderRadius:7, border:"none", background:currentArea.color, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>
                {saving ? "Guardando..." : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const priorityRank = { high: 0, medium: 1, low: 2 }
const gridRow   = { display:"grid", gridTemplateColumns:"44px 1fr 110px 100px 150px 1fr 72px" }
const selectStyle = { padding:"6px 10px", borderRadius:6, border:"1px solid #2a2a3e", background:"#0f0f13", color:"#e8e8f0", fontSize:12, cursor:"pointer" }
const inputStyle  = { padding:"6px 10px", borderRadius:6, border:"1px solid #2a2a3e", background:"#0f0f13", color:"#e8e8f0", fontSize:13 }
const iconBtn     = { padding:"4px 7px", borderRadius:5, border:"none", background:"#2a2a3e", color:"#9999b5", cursor:"pointer", fontSize:12 }

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize:11, color:"#7c7c9a", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", display:"block", marginBottom:5 }}>{label}</label>
      {children}
    </div>
  )
}
