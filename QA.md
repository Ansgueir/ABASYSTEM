# Protocolo de QA - ERP ABA Supervision

## 1. Plan de Reconocimiento del Proyecto
Este plan tiene como objetivo entender la implementación actual de las reglas de negocio y la estructura técnica para asegurar una cobertura de pruebas efectiva.

### Pasos de Reconocimiento
1. **Mapeo de Lógica de Negocio**: Identificar los Server Actions que ejecutan las reglas críticas (horas, facturación, bloqueos).
2. **Entropía de Datos**: Revisar el esquema de Prisma para entender las restricciones a nivel de base de datos.
3. **Flujo de Usuario**: Trazar los caminos críticos (Happy Path) para Onboarding y Facturación.
4. **Validación de Scripts de QA**: Verificar que los scripts de configuración de usuarios (`setup-qa-users.ts`) reflejen el estado necesario para las pruebas.

## 2. Archivos Críticos para Análisis Inicial
Se analizarán los siguientes archivos para validar el funcionamiento actual contra la documentación de referencia:

| Archivo | Propósito | Regla de Negocio Asociada |
| :--- | :--- | :--- |
| `prisma/schema.prisma` | Modelo de datos | Integridad de Estudiantes/Supervisores |
| `src/actions/log-hours.ts` | Gestión de horas | Límite 130h, alertas 40%/60% BCBA/BCaBA |
| `src/actions/billing.ts` | Facturación | Factura automática día 1, Comisiones 54%/60% |
| `src/actions/onboarding.ts` | Registro y documentos | Bloqueo de contrato sin ID/Matrícula/Grado |
| `scripts/setup-qa-users.ts` | Configuración QA | Creación de entorno de pruebas |

## 3. Estado de Ejecución
- [ ] Reconocimiento inicial completado.
- [ ] Validación de lógica de horas.
- [ ] Validación de flujo de facturación.
- [ ] Validación de onboarding y bloqueos.
- [ ] Reporte final de QA.
