# Sys-Molly

Aplicación de punto de venta (Vue 3 + Pinia + Firebase) para tiendas y peluquerías.

## Cambio reciente: Carrito de ventas 🛒

Se agregó una UI tipo carrito para sumar múltiples productos antes de finalizar la venta.

- Archivos clave modificados:
  - `src/components/CarritoDrawer.vue`  (nuevo)
  - `src/components/VentaRapida.vue`    (actualizado para usar el drawer)

### Resumen funcional
- Agregás productos desde la lista (tocá un producto, ingresá cantidad/kg y confirmar).
- Aparece un botón flotante **🛒 Ver carrito (N)** en la esquina inferior derecha.
- Al abrir el carrito podés: quitar ítems, elegir método de pago, ver subtotal/recargo/total y finalizar la venta.
- Si la app está offline, la venta se guarda en la cola local y se sincroniza automáticamente cuando vuelve la conexión.

---

## Cómo actualizar y ver la nueva versión (para usuarios finales)

1. Cerrá la pestaña del navegador donde usás la app.
2. Abrí https://molly-petshop.web.app
3. Si ves el aviso "Nueva versión disponible" tocá **Actualizar**.
4. Si no aparece, recargá forzando caché vacío (en escritorio: `Ctrl+Shift+R` o en Chrome: botón recargar > "Vaciar caché y volver a cargar").

En celulares: cerrá la app/pestaña y volvé a abrirla.

---

## Cómo probar localmente (desarrolladores / cajero tech)

```bash
# clonar o actualizar repo
git pull origin main

# instalar dependencias (una sola vez)
npm install

# levantar en modo desarrollo
npm run dev

# o construir para producción
npm run build

# previsualizar el build localmente
npm run preview
```

Para desplegar (requiere Firebase CLI y estar logueado con el proyecto correcto):

```bash
# construir
npm run build

# desplegar a Firebase Hosting
firebase deploy --only hosting
```

---

## Cómo usar el carrito (rápido)

- Tocar producto → ingresar cantidad/importe → agregar.
- Tocar 🛒 Ver carrito (N) para abrir el drawer.
- Dentro del drawer:
  - `−` : quitar ítem.
  - Elegir método de pago (Efectivo / Débito / Transferencia / Crédito).
  - Ver Total (aplica recargo si es crédito).
  - Tocar **Finalizar venta · $X** para registrar la venta.
- Si falla la conexión, la venta se guarda en la cola local y se sincroniza automáticamente.

---

## Notas técnicas rápidas
- Las transacciones de venta siguen usando `runTransaction` y actualizan `productos.stock` de forma atómica.
- La cola offline sigue siendo `useSyncQueueStore` (localStorage) — no cambió el comportamiento.

---

Si querés que haga un PR con este `README.md`, o lo suba al repo y lo commitee/pushee (si aún no está), decímelo y lo hago.