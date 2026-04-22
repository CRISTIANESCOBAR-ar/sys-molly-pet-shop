// ─── Catálogo de categorías ───────────────────────────────────────────────────
export const CATEGORIAS = ['ALIMENTO', 'SALUD', 'HIGIENE', 'ACCESORIO']

// ─── Métodos de pago y sus recargos ──────────────────────────────────────────
export const METODOS_PAGO = [
  { value: 'efectivo',      label: 'Efectivo',       recargo: 0    },
  { value: 'debito',        label: 'Débito',          recargo: 0    },
  { value: 'transferencia', label: 'Transferencia',   recargo: 0    },
  { value: 'credito',       label: 'Crédito (+10%)',  recargo: 0.10 },
]

// ─── Días sin actualizar precio para mostrar badge de alerta ─────────────────
export const DIAS_PRECIO_DESACTUALIZADO = 30

// ─── Seed inicial de productos (importado desde JSON del negocio) ─────────────
// campo "tipo" del JSON → "categoria" en Firestore
// proveedor = string desnormalizado (nombre del proveedor)
// stock inicial = 0, precios se cargan manualmente en el backoffice
export const PRODUCTOS_SEED = [
  // venta_granel: true → se vende fraccionado por kg (precio = $/kg, qty en decimales)
  { nombre: '4 HUELLAS GATO 20KG',               categoria: 'ALIMENTO', proveedor: 'FY P',               stock_minimo: 5,  venta_granel: true  },
  { nombre: '4 HUELLAS GATO KITTEN 20KG',         categoria: 'ALIMENTO', proveedor: 'FY P',               stock_minimo: 3,  venta_granel: true  },
  { nombre: '7 VIDAS GATO ADULTO CARNE Y POLLO',  categoria: 'ALIMENTO', proveedor: 'NATA',               stock_minimo: 5,  venta_granel: true  },
  { nombre: '7 VIDAS GATO ADULTO SALMON 10KG',    categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock_minimo: 3,  venta_granel: true  },
  { nombre: 'AGILITY URINARY',                    categoria: 'ALIMENTO', proveedor: 'NATA',               stock_minimo: 4,  venta_granel: false },
  { nombre: 'AGROCAN',                            categoria: 'ALIMENTO', proveedor: 'MAS DISTRIBUCIONES', stock_minimo: 10, venta_granel: true  },
  { nombre: 'ARROCIN 30KG',                       categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock_minimo: 2,  venta_granel: true  },
  { nombre: 'BALANCEAR GATO PESCADO',             categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock_minimo: 5,  venta_granel: true  },
  { nombre: 'CAN ACTIVE ADULTO 20KG',             categoria: 'ALIMENTO', proveedor: 'FY P',               stock_minimo: 5,  venta_granel: true  },
  { nombre: 'CARIAMICI CACHORRO',                 categoria: 'ALIMENTO', proveedor: 'MAS DISTRIBUCIONES', stock_minimo: 5,  venta_granel: false },
  { nombre: 'CARIAMICI GATO POLLO Y ATUN',        categoria: 'ALIMENTO', proveedor: 'MAS DISTRIBUCIONES', stock_minimo: 5,  venta_granel: false },
  { nombre: 'CARIAMICI PERRO RAZA PEQUEÑA',       categoria: 'ALIMENTO', proveedor: 'MAS DISTRIBUCIONES', stock_minimo: 5,  venta_granel: false },
  { nombre: 'CAT CHOW MIX CARNE/PESCADO',         categoria: 'ALIMENTO', proveedor: 'GENERAL',            stock_minimo: 5,  venta_granel: false },
  { nombre: 'DOG CHOW ADULTO RAZA PEQUEÑA',       categoria: 'ALIMENTO', proveedor: 'POCAS PULGAS',       stock_minimo: 5,  venta_granel: false },
  { nombre: 'DOG SELECTION ADULTO CARNE Y POLLO', categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock_minimo: 5,  venta_granel: true  },
  { nombre: 'DOG SELECTION CACHORRO',             categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock_minimo: 5,  venta_granel: false },
  { nombre: 'DOGUI',                              categoria: 'ALIMENTO', proveedor: 'NATA',               stock_minimo: 5,  venta_granel: false },
  { nombre: 'ESTAMPA PLUS PERRO ADULTO',          categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock_minimo: 5,  venta_granel: true  },
  { nombre: 'MAIZ ENTERO 30KG',                   categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock_minimo: 2,  venta_granel: true  },
  { nombre: 'MANADA ADULTO',                      categoria: 'ALIMENTO', proveedor: 'CARAM',              stock_minimo: 10, venta_granel: true  },
  { nombre: 'PEDIGREE CACHORRO',                  categoria: 'ALIMENTO', proveedor: 'CARAM',              stock_minimo: 5,  venta_granel: false },
  { nombre: 'RAZA GATO ADULTO PESCADO 10KG',      categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock_minimo: 3,  venta_granel: true  },
  { nombre: 'SABROSITOS GATO MIX',                categoria: 'ALIMENTO', proveedor: 'CARAM',              stock_minimo: 5,  venta_granel: false },
  { nombre: 'VAGONETA PERRO ADULTO',              categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock_minimo: 5,  venta_granel: true  },
  { nombre: 'WHISKAS CARNE',                      categoria: 'ALIMENTO', proveedor: 'CARAM',              stock_minimo: 10, venta_granel: false },
  { nombre: 'WHISKAS PESCADO',                    categoria: 'ALIMENTO', proveedor: 'CARAM',              stock_minimo: 10, venta_granel: false },
  { nombre: 'HECTOPAR PIPETA GATO',               categoria: 'SALUD',    proveedor: 'MAS DISTRIBUCIONES', stock_minimo: 12, venta_granel: false },
  { nombre: 'IVER VETUE IVERMECTINA 1%',          categoria: 'SALUD',    proveedor: 'SCHIARELLO',         stock_minimo: 5,  venta_granel: false },
  { nombre: 'SIMPARICA (TODOS LOS TAMAÑOS)',      categoria: 'SALUD',    proveedor: 'MAS DISTRIBUCIONES', stock_minimo: 3,  venta_granel: false },
  { nombre: 'HECTOPAR TALCO PLUS',                categoria: 'SALUD',    proveedor: 'MAS DISTRIBUCIONES', stock_minimo: 5,  venta_granel: false },
  { nombre: 'FRESH CAT PIEDRA SANITARIA',         categoria: 'HIGIENE',  proveedor: 'SCHIARELLO',         stock_minimo: 20, venta_granel: false },
  { nombre: 'POOPY PETS COLCHON SANITARIO',       categoria: 'HIGIENE',  proveedor: 'SCHIARELLO',         stock_minimo: 10, venta_granel: false },
  { nombre: 'SHAMPU Y ACONDICIONADOR ELMER',      categoria: 'HIGIENE',  proveedor: 'MAS DISTRIBUCIONES', stock_minimo: 6,  venta_granel: false },
  { nombre: 'PIEDRA AGLUTINANTE LAVANDA 4KG',     categoria: 'HIGIENE',  proveedor: 'FY P',               stock_minimo: 10, venta_granel: false },
  { nombre: 'CEPILLO MASAJEADOR PANDA',           categoria: 'ACCESORIO',proveedor: 'SCHIARELLO',         stock_minimo: 4,  venta_granel: false },
  { nombre: 'COMEDERO ACERO INOXIDABLE',          categoria: 'ACCESORIO',proveedor: 'FY P',               stock_minimo: 5,  venta_granel: false },
  { nombre: 'KIT SANITARIO JUMBO',                categoria: 'ACCESORIO',proveedor: 'FY P',               stock_minimo: 2,  venta_granel: false },
  { nombre: 'PECHERA CAPIBARA',                   categoria: 'ACCESORIO',proveedor: 'GENERAL',            stock_minimo: 3,  venta_granel: false },
  { nombre: 'PEINE VAPORIZADOR PET BRUSH',        categoria: 'ACCESORIO',proveedor: 'SCHIARELLO',         stock_minimo: 5,  venta_granel: false },
  { nombre: 'COLLAR ISABELLINO',                  categoria: 'ACCESORIO',proveedor: 'GENERAL',            stock_minimo: 2,  venta_granel: false },
  { nombre: 'PELOTA DE GOMA CON SOGA',            categoria: 'ACCESORIO',proveedor: 'FY P',               stock_minimo: 5,  venta_granel: false },
  { nombre: 'RASCADOR INFINITO',                  categoria: 'ACCESORIO',proveedor: 'FY P',               stock_minimo: 2,  venta_granel: false },
  { nombre: 'REMERAS Y VESTIDOS',                 categoria: 'ACCESORIO',proveedor: 'MAS DISTRIBUCIONES', stock_minimo: 10, venta_granel: false },
]
