# CRM INGETEG SOLUCIONES

Sistema CRM Web para gestión comercial de clientes, agendamientos y seguimiento de servicios.

---

## ⚙️ Requisitos

Antes de iniciar, necesitas tener instalado:

1. **Node.js** (v18 o superior) — Descargar en: https://nodejs.org/en/download
   - Descarga la versión **LTS** (recomendada)
   - Durante la instalación, marca la opción "Add to PATH"
   - **Reinicia el computador** después de instalar

---

## 🚀 Instalación (Primera vez)

**Doble clic en `INSTALAR.bat`**

Esto instalará todas las dependencias y creará los usuarios iniciales.

---

## ▶️ Iniciar el Sistema

**Doble clic en `INICIAR_CRM.bat`**

El sistema abrirá automáticamente en el navegador en: `http://localhost:5173`

---

## 👥 Credenciales de Acceso Iniciales

| Usuario | Contraseña | Rol |
|---|---|---|
| `coordinador` | `Ingeteg2024!` | Coordinador Comercial |
| `asesora1` | `Asesora01!` | Asesora Comercial |
| `asesora2` | `Asesora02!` | Asesora Comercial |
| `asesora3` | `Asesora03!` | Asesora Comercial |
| `asesora4` | `Asesora04!` | Asesora Comercial |

> ⚠️ **Cambia las contraseñas** en la base de datos después del primer uso.

---

## 📁 Estructura del Proyecto

```
PRUEBA CRM1/
├── INSTALAR.bat          ← Instalación inicial
├── INICIAR_CRM.bat       ← Arrancar el sistema
├── server/               ← Backend (Node.js + Express)
│   ├── server.js         ← Punto de entrada del servidor
│   ├── db.js             ← Conexión SQLite
│   ├── schema.sql        ← Tablas de la base de datos
│   ├── seed.js           ← Crear usuarios iniciales
│   ├── middleware/
│   │   └── auth.js       ← Autenticación JWT
│   ├── routes/
│   │   ├── auth.js       ← Login / Logout
│   │   ├── clientes.js   ← Gestión de clientes
│   │   ├── llamadas.js   ← Llamadas y agendamientos
│   │   └── dashboard.js  ← Métricas y auditoría
│   └── uploads/          ← Archivos de comprobantes de pago
└── client/               ← Frontend (React + Tailwind)
    └── src/
        ├── pages/
        │   ├── Login.jsx
        │   ├── Marcacion.jsx          ← Pantalla principal
        │   ├── ClientesNuevos.jsx
        │   ├── ActualizacionTecnica.jsx
        │   ├── PendientesCobro.jsx
        │   ├── PendientesRepuesto.jsx
        │   ├── Fidelizacion.jsx
        │   ├── Dashboard.jsx          ← Solo Coordinador
        │   └── Asignacion.jsx         ← Solo Coordinador
        └── components/
            └── MetasHUD.jsx           ← Barra de metas
```

---

## 📋 Formato de Importación de Clientes (CSV)

```
Nombre, Teléfono, Dirección, Barrio, Ciudad
Juan García, 3001234567, Cra 45 #10-20, Laureles, Medellín
María López, 3109876543, Cl 30 #5-15, El Centro, Envigado
```

Separadores soportados: `,` `;` `Tab`

---

## 🔒 Seguridad

- Las asesoras **NO** tienen acceso a exportar, imprimir ni descargar listados
- Las asesoras **NO** tienen buscador global de clientes
- Los reportes de auditoría (tiempos de llamada) son **exclusivos del Coordinador**
- Autenticación con JWT de 12 horas de duración

---

## 🗄️ Base de Datos

El archivo de base de datos se crea automáticamente en:
`server/ingeteg_crm.db`

Este archivo contiene toda la información del sistema. **Realiza copias de seguridad regularmente.**
