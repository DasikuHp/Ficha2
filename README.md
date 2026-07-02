# Orxatería App (v3.0) ☕️🕒

Esta carpeta contiene el código de la aplicación de control horario, planificación de turnos y alertas en tiempo real de la **Orxatería**, construida como una Single Page Application (SPA) con **React 19** y **Vite**.

El sistema cumple con el **Real Decreto-ley 8/2019** de registro de jornada laboral en España, garantizando el registro de datos e inmutabilidad a través de firmas SHA-256 en el lado del cliente.

---

## 🚀 Cambios de la Fase 2 (Alpha) vs. Fase 1 (Legacy)

Esta versión de la aplicación (v3.0) representa la **Fase 2 de la Alpha**, la cual introduce mejoras orientadas a la usabilidad física y al cumplimiento legal riguroso frente a la versión v2.0 (Fase 1):

| Área | Fase 1 (Legacy - `fichero.jsx`) | Fase 2 (Alpha - `App.jsx` v3.0) |
| :--- | :--- | :--- |
| **Acceso** | Correo electrónico, contraseña y 2FA por software. | **PIN numérico rápido de 4 dígitos + Simulación física de lectura de tarjeta/pulsera NFC.** |
| **Cumplimiento Legal** | Sin consentimiento inicial explícito. | **Aceptación obligatoria del RGPD** antes de la autenticación. Purgado de logs > 4 años. |
| **Planificación** | Horarios fijos de empleado sin planning semanal. | **Planning Semanal dinámico** editable por administradores. Balance mensual de horas +/-. |
| **Control Visual** | Historial plano de fichajes. | **Calendario codificado por colores (Semáforo de cumplimiento)** basado en una tolerancia de 15 minutos. |
| **Seguridad Admin** | Acceso directo a todas las secciones. | **Autenticación con PIN Secundario (`0000`)** para áreas sensibles de datos y auditorías. |
| **Alertas de Jornada**| Sin avisos en segundo plano. | **Detección automática** de retrasos en la entrada, salidas anticipadas y omisiones de fichaje. |
| **Inmutabilidad** | Historial de logs no firmado. | **Firma digital SHA-256 encadenada** en cada registro y log generado. |

---

## 🛠️ Tecnologías Utilizadas

*   **Framework**: [React 19](https://react.dev/) (Hooks: `useState`, `useEffect`, `useCallback`, `useRef`)
*   **Herramienta de Construcción**: [Vite 8](https://vite.dev/) (para un entorno ágil con Hot Module Replacement)
*   **Iconos**: [Lucide React](https://lucide.dev/)
*   **Estilos**: CSS Vanilla incrustado de alta fidelidad con tipografía *DM Sans* importada de Google Fonts.
*   **Persistencia**: `localStorage` bajo el namespace `orxateria_v3` (con lógica de migración automática de datos estructurados de la v2 `orchateria_v2`).

---

## 🚀 Guía de Inicio Rápido

### Requisitos Previos

Asegúrate de tener instalado [Node.js](https://nodejs.org/) (versión 18 o superior recomendada) y un gestor de paquetes como `npm`.

### Instalación

1.  Instala las dependencias necesarias:
    ```bash
    npm install
    ```

### Desarrollo

1.  Inicia el servidor de desarrollo local:
    ```bash
    npm run dev
    ```
2.  Abre el navegador en la dirección local (usualmente `http://localhost:5173`).

### Producción

1.  Para construir el bundle optimizado para producción:
    ```bash
    npm run build
    ```
2.  Para previsualizar la build local de producción:
    ```bash
    npm run preview
    ```

---

## 🔑 Credenciales de Demo

Para iniciar sesión en el simulador de terminal de fichaje:

| Rol / Empleado | PIN Entrada | PIN Administrador (2FA) | Tarjeta NFC | Turno Base |
| :--- | :---: | :---: | :--- | :---: |
| **María García** (Admin) | `1234` | `0000` | Simular NFC | 08:00 - 16:00 |
| **Carlos Martínez** (Empleado) | `5678` | *No requerido* | Simular NFC | 09:00 - 15:00 |
| **Ana López** (Empleado) | `9012` | *No requerido* | Simular NFC | 16:00 - 20:00 |

---

## 📊 Funciones Avanzadas Implementadas

*   **Control Geográfico / IP**: Verifica que la IP del cliente esté dentro del rango de red (`192.168.1.15`) antes de permitir el fichaje.
*   **Firmas SHA-256**: Los registros se enlazan mediante criptografía básica generada en el frontend para auditoría interna.
*   **Alertas de Desviación**: Generación en segundo plano de alertas por retrasos en la entrada, salidas anticipadas y faltas de fichaje basándose en el turno planificado y el planning semanal.
*   **Exportación Legal**: Descarga instantánea de los registros en formato JSON listo para inspecciones de trabajo.
*   **Políticas de Retención**: Módulo de auditoría con la capacidad de purgar logs que superen los 4 años reglamentarios de almacenamiento exigidos por la ley.
