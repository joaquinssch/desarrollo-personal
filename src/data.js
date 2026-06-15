export const AREAS = [
  { id: "sleep",   label: "😴 Sueño",               color: "#6366f1" },
  { id: "food",    label: "🥗 Alimentación",          color: "#22c55e" },
  { id: "startup", label: "🚀 Startup",               color: "#f97316" },
  { id: "sport",   label: "🏊 Deporte",               color: "#06b6d4" },
  { id: "content", label: "📲 Contenido / Sponsors",  color: "#ec4899" },
  { id: "finance", label: "💸 Finanzas",              color: "#84cc16" },
]

export const STATUS_OPTIONS = [
  { value: "pending",    label: "⬜ Pendiente",    color: "#6b7280" },
  { value: "inprogress", label: "🔵 En progreso",  color: "#3b82f6" },
  { value: "waiting",    label: "🟡 Esperando",    color: "#f59e0b" },
  { value: "done",       label: "✅ Listo",         color: "#10b981" },
]

export const PRIORITY_OPTIONS = [
  { value: "high",   label: "🔴 Alta",  color: "#ef4444" },
  { value: "medium", label: "🟠 Media", color: "#f97316" },
  { value: "low",    label: "🟡 Baja",  color: "#eab308" },
]

export const INITIAL_TASKS = [
  // SUEÑO
  { id:"S1",  area:"sleep",   task:"Regularizar dosis magnesio bisglycinate",      priority:"high",   time_estimate:"5 min",           status:"pending", next_step:"Buscar dosis Huberman",      sort_order:1  },
  { id:"S2",  area:"sleep",   task:"Consistencia hora acostada/levantada",          priority:"high",   time_estimate:"Hábito diario",   status:"pending", next_step:"Definir hora fija",          sort_order:2  },
  { id:"S3",  area:"sleep",   task:"Automatizar luz roja",                          priority:"medium", time_estimate:"30 min",          status:"pending", next_step:"Research dispositivo",       sort_order:3  },
  { id:"S4",  area:"sleep",   task:"Investigar lavanda 80/20",                      priority:"low",    time_estimate:"20 min",          status:"pending", next_step:"Preguntar a Claude",         sort_order:4  },
  { id:"S5",  area:"sleep",   task:"Mapear pieza completa (luz, temperatura)",      priority:"low",    time_estimate:"45 min",          status:"pending", next_step:"Hacer sketch",               sort_order:5  },
  { id:"S6",  area:"sleep",   task:"Ver plantas para optimizar ambiente",           priority:"low",    time_estimate:"15 min",          status:"pending", next_step:"Research primero",           sort_order:6  },

  // ALIMENTACIÓN
  { id:"A1",  area:"food",    task:"Tomar hora con Vale (nutri) vía isapre",        priority:"high",   time_estimate:"2 min",           status:"pending", next_step:"Llamar/escribir hoy",        sort_order:1  },
  { id:"A2",  area:"food",    task:"Claridad macros diarios (CH, proteína, fat)",   priority:"high",   time_estimate:"En consulta",     status:"pending", next_step:"Depende de A1",              sort_order:2  },
  { id:"A3",  area:"food",    task:"Sistema medición + tracking comida",            priority:"medium", time_estimate:"30 min setup",    status:"pending", next_step:"Definir app o método",       sort_order:3  },
  { id:"A4",  area:"food",    task:"Migrar a comida real, menos inflamatoria",      priority:"medium", time_estimate:"Hábito progresivo",status:"pending", next_step:"Post consulta nutri",       sort_order:4  },

  // STARTUP
  { id:"ST1", area:"startup", task:"Timeboxing diario con prioridades",             priority:"high",   time_estimate:"15 min/día",      status:"pending", next_step:"Arrancar mañana",            sort_order:1  },
  { id:"ST2", area:"startup", task:"3 entrevistas de problema por semana",          priority:"high",   time_estimate:"3 hrs/semana",    status:"pending", next_step:"Agendar primeras 3",         sort_order:2  },
  { id:"ST3", area:"startup", task:"1 café con founder por semana",                 priority:"high",   time_estimate:"1 hr/semana",     status:"pending", next_step:"Identificar primer contacto",sort_order:3  },
  { id:"ST4", area:"startup", task:"Llamar a Gianca → sesiones automatización IA", priority:"high",   time_estimate:"2 min",           status:"pending", next_step:"Llamar hoy",                 sort_order:4  },
  { id:"ST5", area:"startup", task:"Lectura diaria estructurada (no correr)",       priority:"medium", time_estimate:"Hábito diario",   status:"pending", next_step:"Definir hora fija",          sort_order:5  },
  { id:"ST6", area:"startup", task:"Sistema tracking de lectura",                   priority:"medium", time_estimate:"15 min setup",    status:"pending", next_step:"Elegir método simple",       sort_order:6  },
  { id:"ST7", area:"startup", task:"Leer bio Elon x2 + libro Nike",                priority:"medium", time_estimate:"Semanas",         status:"pending", next_step:"Comprar/descargar",          sort_order:7  },

  // DEPORTE
  { id:"D1",  area:"sport",   task:"Pedir hora resonancia + traumatólogo (isapre)", priority:"high",   time_estimate:"3 min",           status:"pending", next_step:"Llamar hoy",                 sort_order:1  },
  { id:"D2",  area:"sport",   task:"Agendar Claudio kine (isapre 6-7k)",            priority:"high",   time_estimate:"3 min",           status:"pending", next_step:"Llamar hoy",                 sort_order:2  },
  { id:"D3",  area:"sport",   task:"Armar chat Claude para research lesión espalda",priority:"high",   time_estimate:"45 min",          status:"pending", next_step:"Abrir chat hoy",             sort_order:3  },
  { id:"D4",  area:"sport",   task:"Confirmar hipótesis espalda/piernas",           priority:"high",   time_estimate:"En consulta",     status:"pending", next_step:"Depende de D1 + D2",         sort_order:4  },
  { id:"D5",  area:"sport",   task:"Kegel + incontinencia con kine",                priority:"medium", time_estimate:"En consulta",     status:"pending", next_step:"Depende de D2",              sort_order:5  },
  { id:"D6",  area:"sport",   task:"Ordenar electrolitos + carbs entrenamiento",    priority:"medium", time_estimate:"30 min",          status:"pending", next_step:"Post consulta nutri",        sort_order:6  },
  { id:"D7",  area:"sport",   task:"Trackear volumen semanal + sensaciones running",priority:"medium", time_estimate:"15 min setup",    status:"pending", next_step:"Definir sistema",            sort_order:7  },
  { id:"D8",  area:"sport",   task:"Investigar protocolo calentamiento espalda",    priority:"medium", time_estimate:"30 min",          status:"pending", next_step:"Preguntar a Claude",         sort_order:8  },
  { id:"D9",  area:"sport",   task:"Definir sistema tracking Training Peaks/WHOOP", priority:"low",    time_estimate:"20 min",          status:"pending", next_step:"Post resonancia",            sort_order:9  },

  // CONTENIDO
  { id:"C1",  area:"content", task:"Hablar con suegro → main sponsor trisuit",      priority:"high",   time_estimate:"5 min",           status:"pending", next_step:"Llamar esta semana",         sort_order:1  },
  { id:"C2",  area:"content", task:"Conseguir entrada Pucón 70.3 (canje)",          priority:"high",   time_estimate:"10 min",          status:"pending", next_step:"Contactar organización",     sort_order:2  },
  { id:"C3",  area:"content", task:"Armar lista sponsors + enviar primeros mails",  priority:"high",   time_estimate:"45 min",          status:"pending", next_step:"Armar lista hoy",            sort_order:3  },
  { id:"C4",  area:"content", task:"Canjear zapatillas running",                    priority:"high",   time_estimate:"30 min gestión",  status:"pending", next_step:"Identificar marcas",         sort_order:4  },
  { id:"C5",  area:"content", task:"Canjear trisuit (Mauna u otros)",               priority:"high",   time_estimate:"30 min gestión",  status:"pending", next_step:"Contactar Mauna",            sort_order:5  },
  { id:"C6",  area:"content", task:"Subir contenido orgánico → iterar sin parálisis",priority:"high",  time_estimate:"Hábito continuo", status:"pending", next_step:"Subir algo hoy",             sort_order:6  },
  { id:"C7",  area:"content", task:"Canjear electrolitos + ropa running/ciclismo",  priority:"medium", time_estimate:"Semanas gestión", status:"pending", next_step:"Post primeros mails",        sort_order:7  },
  { id:"C8",  area:"content", task:"Bugmann → comida saludable a domicilio",        priority:"medium", time_estimate:"2 min",           status:"pending", next_step:"Escribir hoy",               sort_order:8  },
  { id:"C9",  area:"content", task:"Canjear mantenciones bici + corona + cockpit",  priority:"low",    time_estimate:"Semanas gestión", status:"pending", next_step:"Post base sponsors",         sort_order:9  },
  { id:"C10", area:"content", task:"Research fabricar propios electrolitos",        priority:"low",    time_estimate:"30 min",          status:"pending", next_step:"Preguntar a Claude",         sort_order:10 },
  { id:"C11", area:"content", task:"Canjear bici (Specialized / Quintana Roo)",     priority:"low",    time_estimate:"Meses",           status:"pending", next_step:"Largo plazo",                sort_order:11 },

  // FINANZAS
  { id:"F1",  area:"finance", task:"Chany → Fer → publicar depto Heras",            priority:"high",   time_estimate:"2 min",           status:"pending", next_step:"Escribir hoy",               sort_order:1  },
  { id:"F2",  area:"finance", task:"Investigar devolución de IVA por compra depto", priority:"high",   time_estimate:"30 min",          status:"pending", next_step:"Preguntar a Claude",         sort_order:2  },
  { id:"F3",  area:"finance", task:"Óptico + lentes de contacto (isapre)",          priority:"high",   time_estimate:"3 min agendar",   status:"pending", next_step:"Llamar hoy",                 sort_order:3  },
  { id:"F4",  area:"finance", task:"Suplementos sueño con seguro (antes renunciar)",priority:"high",   time_estimate:"10 min",          status:"pending", next_step:"Comprar esta semana",        sort_order:4  },
  { id:"F5",  area:"finance", task:"Hub conexión → pedirle a Michael (oficina)",    priority:"high",   time_estimate:"2 min",           status:"pending", next_step:"Escribir hoy",               sort_order:5  },
  { id:"F6",  area:"finance", task:"Sofisticar análisis gasto mensual + tarjeta",   priority:"medium", time_estimate:"1 hr setup",      status:"pending", next_step:"Sacar datos del mes",        sort_order:6  },
  { id:"F7",  area:"finance", task:"Armar sistema tracking finanzas mes a mes",     priority:"medium", time_estimate:"1 hr setup",      status:"pending", next_step:"Depende de F6",              sort_order:7  },
  { id:"F8",  area:"finance", task:"AliExpress: roller + cinturón + funda MacBook", priority:"low",    time_estimate:"10 min",          status:"pending", next_step:"Cuando pase por ahí",        sort_order:8  },
]
