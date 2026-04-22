# Firestore Cost Playbook (Lecturas/Escrituras)

Guia reutilizable para proyectos Vue + Firestore con foco en costo, sin perder UX.

## Contexto real de pruebas iniciales

En etapas tempranas, es normal que el usuario pruebe mucho y dispare operaciones:
- Navega entre pantallas repetidamente
- Abre/cierra la app varias veces
- Usa varios dispositivos/pestanas a la vez
- Reintenta acciones por aprendizaje del flujo

Este comportamiento es esperable y no es un error del usuario.
El objetivo es que el codigo lo tolere sin escalar costos de forma explosiva.

---

## Reglas base para minimizar lecturas

1. Un solo listener compartido por coleccion global
- Centralizar listener en store.
- Si ya esta suscripto, no crear otro.
- Soltar listener solo cuando no queden consumidores.

2. Evitar cargas completas para historiales largos
- No traer el mes completo por defecto.
- Usar paginacion por cursor (`limit + startAfter`).
- Cargar primera pagina y luego "Cargar mas" bajo demanda.

3. Guard contra resuscripciones innecesarias
- Memorizar clave de filtro (`inicio-fin`).
- Si el filtro no cambio y ya hay datos, no volver a consultar.

4. Offline-first para evitar reintentos agresivos
- Si hay `quota exceeded` u offline, guardar en cola local.
- Sincronizar cuando vuelva conectividad o cuota.

5. Medir por sesion
- Registrar lecturas/escrituras estimadas por origen.
- Mostrar dashboard interno para detectar regresiones rapido.

---

## Fixes de codigo implementables

### A) Guard de listener compartido

```js
let unsub = null
let consumers = 0

function subscribeShared() {
  consumers += 1
  if (!unsub) {
    unsub = onSnapshot(queryRef, snap => {
      // aplicar cambios
    })
  }
  return () => {
    consumers = Math.max(0, consumers - 1)
    if (consumers === 0 && unsub) {
      unsub()
      unsub = null
    }
  }
}
```

### B) Paginacion por cursor en historiales

```js
const pageSize = 30
let lastDoc = null
let hasMore = true

async function loadFirstPage(baseQuery) {
  lastDoc = null
  hasMore = true
  return loadMore(baseQuery)
}

async function loadMore(baseQuery) {
  if (!hasMore) return []
  const q = lastDoc
    ? query(baseQuery, startAfter(lastDoc), limit(pageSize))
    : query(baseQuery, limit(pageSize))

  const snap = await getDocs(q)
  lastDoc = snap.docs[snap.docs.length - 1] || null
  hasMore = snap.docs.length === pageSize
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
```

### C) Guard por filtro

```js
let currentKey = ''

async function initPeriodo(inicio, fin, force = false) {
  const key = `${inicio.getTime()}-${fin.getTime()}`
  if (!force && currentKey === key && data.length > 0) return
  currentKey = key
  await loadFirstPage()
}
```

### D) Metricas de costo por sesion

```js
trackReadEstimate('ventas.periodo.page', snap.docs.length)
trackWriteEstimate('ventas.registrarVenta.tx', items.length + 1)
trackListenerStart('productos.subscribe')
trackListenerStop('productos.subscribe')
```

---

## Checklist para nuevos modulos

Antes de mergear un modulo nuevo, validar:
- [ ] No crea listeners duplicados
- [ ] Tiene `limit` en consultas listadas
- [ ] Tiene paginacion para historiales
- [ ] Tiene guard de filtro para no recargar igual consulta
- [ ] Maneja offline/quota con cola local
- [ ] Reporta metricas estimadas por sesion

---

## Anti-patrones a evitar

- `onSnapshot` por cada componente que monta la misma lista
- Volver a consultar el mismo periodo al cambiar tabs sin necesidad
- Cargar "todo" para mostrar solo resumen
- Reintentos instantaneos en bucle cuando Firestore devuelve quota
- Mezclar listener realtime + query pesada duplicada para misma vista

---

## Recomendacion operativa para etapa inicial

Aceptar picos de uso por curva de aprendizaje, pero con limites tecnicos:
- Mantener alertas tempranas en metricas internas
- Medir costo por flujo (ventas, compras, stock)
- Revisar semanalmente top de origenes con mas lecturas
- Optimizar primero pantallas de mayor frecuencia de uso

Esta estrategia evita sobre-optimizar prematuramente y protege costo en produccion.
