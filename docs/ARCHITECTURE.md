# PayIntent AI — arquitectura y fases

## Brief de auditoría y diagnóstico

El workspace designado estaba completamente vacío y no era un repositorio Git. No hay una base preexistente que proteger o reescribir. La máquina tiene Node 24.22.1, npm 11.19.1 y Git 2.56.0; no hay `AGENTS.md` local o ancestral.

La arquitectura del handoff apunta a un producto útil: separar interpretación probabilística de reglas deterministas, explicar cada decisión, pedir aprobación humana y registrar el resultado. Los principales riesgos son: (a) tratar Orders v2 como si fuera P2P; (b) afirmar protecciones/beneficios como universales; (c) dar al LLM capacidad de ejecutar pagos; (d) considerar la aprobación válida después de modificar el payload; (e) añadir extensión, MCP, Prisma y varios modelos antes de demostrar un flujo.

## Enfoques considerados

1. **Monolito Next.js con núcleo de dominio + adaptadores** (elegido): UI, route handlers, política y auditoría en un único despliegue. Ofrece un flujo comprobable end-to-end con límites internos y menor esfuerzo operativo; su trade-off es que el backend SQLite local no se convierte directamente en persistencia serverless/multiusuario.
2. **Extensión de navegador como producto principal con backend**: más cercana a un widget dentro de PayPal, pero amplía permisos y superficie de seguridad; no hay una API oficial para leer de forma segura el contexto personal de una página de PayPal y el handoff prohíbe scraping/interceptar sesiones. Se aplaza.
3. **MCP/PayPal MCP como núcleo agéntico**: natural para agentes y tareas del comerciante, pero delegaría demasiado pronto las decisiones y no cubre el problema central de clasificar intención P2P vs comercial; la integración P2P tampoco queda probada. Se aplaza.

## Diseño del primer slice

`texto libre → input schema (Zod) → IntentInterpreter (mock) → PaymentIntent → policy engine determinista → CLARIFY | GUIDE_ONLY | BLOCK | REVIEW_REQUIRED → preview con hash → aprobación explícita → provider mock de borrador comercial → eventos de auditoría SQLite`.

- Personal/ambiguo: nunca crea una operación de proveedor. Ambiguo pide aclaración; reembolso/regalo presenta guía acotada.
- Comercial: exige destinatario, importe, moneda y línea de factura válida. El botón de revisión confirma el payload exacto; un cambio posterior invalida la aprobación.
- Adversarial: el usuario no puede sobreescribir la política con prompt text.
- Demo/provider: badge persistente `DEMO · MOCK`. No hay credenciales ni requests de dinero.
- Persistencia inicial: SQLite local y eventos con timestamp, action, decision, payload hash/redacción; no registrar secretos.

## Plan por fases y criterios de aceptación

### Fase 0 — auditoría y bases

- Criterio: inventario real, requisitos de runtime y fuentes oficiales registradas; sin instalación previa a verificar.
- Prueba: toolchain detectada y documentación links/fechas reflejados en `docs/RESEARCH.md`.
- Estado: completada.

### Fase 1 — vertical slice mock (esta ejecución)

- Criterio: el demo acepta texto, muestra clasificación, razón, confianza/mock, faltantes y decisión; casos ambiguos/personales no llaman provider; comercial válido se puede aprobar solo tras mostrar preview; hash previene confirmar payload diferente; historial sobrevive reinicio; resultados identifican MOCK.
- Pruebas: unitarias de esquema, escenarios y policy; integración de endpoint/audit/replay; build y recorrido browser si la UI está disponible.

### Fase 2 — integración PayPal Invoicing Sandbox

- Criterio: credenciales cargadas localmente (nunca por chat); adapter OAuth server-side; crear sólo borrador, estado confirmado consultando API; idempotencia donde API la soporta; error/timeout explícito. Send queda separado y excluido hasta revisión.
- Pruebas: contract tests con respuestas fixture y smoke de Sandbox autorizado. Nunca producción.

### Fase 3 — checkout Orders Sandbox

- Criterio: flujo de orden comercial, el comprador autoriza en PayPal, solo luego se captura con resultado oficial; no se describe como transferencia entre personas.
- Pruebas: contract tests y recorrido buyer/seller sandbox autorizado.

### Fase 4 — hardening y entregable competitivo

- Criterio: auth/tenant apropiado, validación, rate limits, redacción, privacidad, accesibilidad, tests E2E, documentación, licencia pública y demo en inglés <3 min, comparados línea por línea con reglas vigentes.

## Mapa previsto de módulos

- `src/domain/payment-intent.ts`: tipos/schemas tipados.
- `src/domain/policy.ts`: política pura, sin SDK ni modelo.
- `src/domain/approval.ts`: canonicalización y hash del preview aprobado.
- `src/application/analyze-intent.ts`: orquestación y eventos.
- `src/adapters/intent-interpreter/mock.ts`: clasificador demo claramente etiquetado.
- `src/adapters/paypal/mock-provider.ts`: mock comercial (no PayPal).
- `src/adapters/audit/sqlite-audit-repository.ts`: persistencia local de eventos.
- `src/app/api/...`: transport/validación; UI no llama proveedores directamente.
- `src/components/`: interfaz de análisis, preview y actividad.

La estructura exacta podrá ajustarse tras scaffold y pruebas sin alterar las reglas de dominio.
