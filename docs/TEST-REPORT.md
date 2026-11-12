# PayIntent AI — informe de pruebas

Fecha: 2026-11-12 (America/La_Paz)

## Resultados observados

| Verificación | Resultado | Evidencia |
|---|---|---|
| Suite automatizada | PASS | `npm test`: 7 archivos, 26 pruebas. Incluye política, auditoría, aprobación exacta, replay, adapters Jev/PayPal con fetch simulado, importes inválidos y fallback determinista tras un error temporal de IA. |
| TypeScript | PASS | `npm run typecheck` y el paso de TypeScript dentro de `npm run build` finalizaron sin errores. |
| ESLint | PASS | `npm run lint`, sin errores. |
| Build | PASS | `npm run build` con Webpack, incluidas rutas estáticas y API. La carga del binario SWC Windows falla en este entorno; Next usa el fallback WASM y completa la compilación. |
| HTTP local | PASS | `GET /api/activity` devolvió 200 y modos `MOCK/MOCK`. Análisis, aprobación y borrador mock devolvieron `REVIEW_REQUIRED`, `DRAFT` y eventos de auditoría. |
| Navegador local | PASS | Se verificó visualmente en `127.0.0.1:3000`: caso ambiguo → aclaración → recomendación comercial; factura → vista previa exacta, 1440 px y 390 px, sin desbordamiento horizontal. |
| PayPal Sandbox real | PASS | OAuth incluye Invoicing y un intento sintético creó un borrador remoto `DRAFT`. No se envió ni cobró una factura. |
| IA real | PASS | Gemini 3.1 Flash-Lite devolvió `BUSINESS_INVOICE` con JSON estructurado para un caso sintético. |

## Verificación adicional de integración (2026-11-12)

- Gemini 2.5 Flash-Lite devolvió 404 para la clave configurada. El adaptador usa Gemini 3.1 Flash-Lite con nivel de pensamiento mínimo; un análisis vía `POST /api/intents/analyze` respondió HTTP 200 en ~1.2 s, `GEMINI`, `BUSINESS_INVOICE`, con payload USD 12.50 / Logo design service.
- Gemini devolvió 503 de manera intermitente durante una prueba por lote. PayIntent ahora completa esas solicitudes con el clasificador determinista y devuelve `RULES_FALLBACK`; la interfaz lo comunica como una caída temporal del servicio de IA. Una prueba automatizada cubre este caso.
- OAuth PayPal Sandbox: HTTP 200. El token no contiene scope de Invoicing. `POST /v2/invoicing/invoices` devuelve HTTP 403 `NOT_AUTHORIZED`, `insufficient permissions`. Ningún borrador remoto fue creado ni enviado.
- La prueba fallida queda registrada como `PROVIDER_OPERATION_FAILED`; ya se ajustó el registro para identificar `SANDBOX` y la app explica que hace falta solicitar permiso de Invoicing API y asociar una cuenta Sandbox Business elegible.
- Tras actualizar los permisos: OAuth devolvió el scope `https://uri.paypal.com/services/invoicing`. Un intent sintético revisado creó el borrador Sandbox `INV2-CXBM-FVQM-XBTD-6XZV` con estado `DRAFT`; el evento de auditoría `SANDBOX_INVOICE_DRAFT_CREATED` confirma el resultado. No se envió la factura.
- MP4 final de ad/walkthrough: render completo de 44 s, 1280×720, 60 fps. Fotograma revisado tras el último render con el logo original y el texto `UNSENT / RECIPIENT NOT NOTIFIED`.
- Estado de éxito revisado en código: después de crear el borrador, la interfaz sustituye `Review before creating` por `Invoice draft saved` y comunica que el destinatario no recibió notificación y no se movió dinero. No se creó un segundo borrador remoto durante esta revisión de interfaz.

La prueba local usa datos sintéticos. No hubo transferencias, cobros ni envíos de facturas. No presentar mocks como respuesta de PayPal ni como inferencia de un modelo.

## Criterios pendientes para la entrega

1. Confirmar que el repo público incluye fuente, licencia e instrucciones reproducibles; las claves y `data/payintent.db` deben permanecer fuera.
2. Publicar el MP4 de 44 segundos en YouTube y completar Devpost antes de las 16:00 en Bolivia/RD.

Fuente de requisitos: [reglas oficiales](https://paypalaihackathon.devpost.com/rules).
