---
description: Flujo de trabajo para realizar cambios, probar y desplegar usando el sistema Git + GitHub Actions.
---

# Flujo de Desarrollo y Despliegue

Este documento describe cómo realizar cambios en el sistema `aba-supervision-system` de manera segura y sincronizada.

## 1. Desarrollo Local

Todos los cambios de código (frontal, backend, api) se deben realizar en tu entorno local (`C:\Users\Andyf\OneDrive\Documentos\ERP PRACTICANTES\aba-supervision-system`).

1.  **Abre el proyecto** en tu editor.
2.  **Realiza los cambios** necesarios en el código.
3.  **Prueba localmente** (si es posible) usando `npm run dev`.

## 2. Despliegue (Subir cambios)

Una vez que los cambios estén listos y probados localmente:

1.  **Guardar cambios en Git**:
    ```powershell
    git add .
    git commit -m "Descripción breve de los cambios realizados"
    ```

2.  **Enviar al Servidor** (A través de GitHub):
    ```powershell
    git push origin main
    ```
    *Al hacer este push, GitHub Actions se activará automáticamente y actualizará el servidor en unos minutos.*

## 3. Cambios en Base de Datos

⚠️ **IMPORTANTE**: Como solicitaste, **los cambios en la estructura de la base de datos** (migraciones, schema.prisma) los realizaré yo (Tu Agente) directamente en el servidor vía SSH.

**Si necesitas cambiar la base de datos:**
1.  Pídeme el cambio (ej: "Agrega un campo 'telefono' a la tabla Estudiantes").
2.  Yo me conectaré al servidor y aplicaré los cambios de manera segura.
3.  Luego sincronizaré tu entorno local para que tengas la última versión del esquema.

## 4. Resolución de Problemas

-   **Si el despliegue falla**: Revisa la pestaña "Actions" en tu repositorio de GitHub para ver el error.
-   **Si el sitio no carga**: Pídeme que revise los logs del servidor (`pm2 logs`).
