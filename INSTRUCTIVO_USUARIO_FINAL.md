# Instructivo de Usuario Final - Sys Molly Pet Shop

## 1) Finalidad de la app
Sys Molly Pet Shop es una aplicacion para operar el dia a dia del negocio desde un solo lugar.
Su objetivo principal es:
- Registrar ventas de mostrador rapidamente.
- Mantener el stock actualizado en tiempo real.
- Registrar compras a proveedores y controlar costos.
- Visualizar alertas de stock bajo.
- Consultar indicadores de ventas para seguimiento mensual.

En resumen: ayuda a vender, reponer y controlar el negocio con menos trabajo manual.

## 2) Acceso y perfiles
Al ingresar se solicita inicio de sesion.
Hay dos perfiles de uso:
- Admin: acceso total a ventas, stock, proveedores, compras, cuentas y graficos.
- Cajero: acceso operativo a ventas, stock y graficos.

Si intentas entrar a una pantalla solo-admin con perfil cajero, la app redirige automaticamente a Ventas.

## 3) Flujo recomendado de uso diario
1. Revisar Stock al iniciar el dia (alertas en rojo y productos por debajo del minimo).
2. Registrar Ventas durante la jornada.
3. Cargar Compras cuando llega mercaderia.
4. Verificar Graficos al cierre para seguimiento del periodo.
5. Usar Cuentas y Proveedores para control administrativo (perfil admin).

## 4) Como usar cada modulo

### 4.1 Ventas
Pantalla pensada para venta rapida en mostrador.
- Buscar producto por nombre.
- Tocar producto para agregar cantidad.
- Elegir metodo de pago.
- Confirmar venta.

Comportamiento importante:
- Al confirmar una venta, la app descuenta stock automaticamente.
- Si no hay stock suficiente, la venta se bloquea con mensaje de error.
- Un admin puede editar o anular ventas desde el historial.

Al editar/anular:
- Editar cantidad ajusta el stock por diferencia.
- Anular venta devuelve unidades al stock.

### 4.2 Compras (admin)
Pantalla para registrar ingreso de mercaderia.
- Seleccionar o escribir producto.
- Indicar cantidad, precio de compra, precio de venta y proveedor.
- Guardar compra.

Comportamiento importante:
- Al guardar una compra, la app incrementa stock automaticamente.
- Tambien actualiza precio de compra del producto.
- Si se informa precio de venta mayor a 0, tambien actualiza ese precio.

Al editar/anular:
- Editar cantidad ajusta stock por diferencia.
- Anular compra revierte el ingreso de stock.

### 4.3 Stock
Pantalla para control de inventario.
- Ver stock actual por producto.
- Detectar faltantes o niveles bajos.
- Ajustar stock manualmente cuando sea necesario.

### 4.4 Proveedores (admin)
Pantalla para mantener datos de proveedores.
- Alta, edicion y organizacion de proveedores.
- Se usa como referencia para compras y control.

### 4.5 Cuentas (admin)
Pantalla orientada al seguimiento de compromisos de pago.
- Consulta y control de cuentas relacionadas a compras/proveedores.

### 4.6 Graficos
Pantalla de analisis visual.
- Seguimiento de ventas por periodo.
- Vista de tendencia para apoyar decisiones de compra y reposicion.

## 5) Reglas clave que conviene recordar
- Siempre confirmar que el producto seleccionado sea el correcto antes de guardar venta/compra.
- En ventas y compras, el stock se ajusta automaticamente: no repetir la operacion dos veces.
- La anulacion corrige stock, por lo que debe usarse en lugar de "borrar por fuera".
- El historial del periodo depende de fechas y estado de los movimientos.

## 6) Tecnologia usada (explicado muy por arriba)
La app esta construida como web app moderna:
- Frontend: Vue 3.
- Estado de datos: Pinia.
- Estilos: Tailwind CSS.
- Build y desarrollo: Vite.
- Backend de datos y autenticacion: Firebase / Firestore.
- Soporte web instalable (PWA) para uso agil en dispositivo.

No hace falta conocimiento tecnico para operarla.

## 7) Funcionalidades pendientes o a resolver
A hoy, hay puntos que todavia pueden mejorarse:
- Devoluciones y cambios: no hay un flujo dedicado (solo anulacion/edicion).
- Exportacion de reportes: no hay exportacion nativa a PDF/Excel.
- Notificaciones proactivas: las alertas de stock bajo son visuales en app, no por WhatsApp/mail.
- Auditoria avanzada: existe historial operativo, pero no un modulo formal de auditoria con filtros avanzados y reportes de trazabilidad.
- Edicion de venta compleja: la edicion actual esta centrada en cantidad/metodo/total y no en un editor completo de multiples items dentro de la misma venta.

## 8) Buenas practicas para el usuario final
- Cargar compras apenas ingresa mercaderia para evitar desfasajes.
- Evitar usar ajuste manual de stock salvo correcciones puntuales.
- Revisar alertas de stock bajo al menos una vez por dia.
- Registrar anulaciones con criterio operativo (no duplicar anulacion).
- Mantener proveedores y precios actualizados para mejorar decisiones.

---
Si queres, en una siguiente version se puede convertir este instructivo en una guia visual con capturas de cada pantalla y un mini "paso a paso" por rol (Admin y Cajero).
