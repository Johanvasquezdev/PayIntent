# PayIntent AI — investigación técnica

Verificado el 2026-11-04 contra documentación y reglas oficiales. La investigación respalda el diseño, pero no equivale a haber probado credenciales, endpoints o transacciones en Sandbox.

## Fuentes oficiales consultadas

- PayPal AI Hackathon rules: https://paypalaihackathon.devpost.com/rules
- PayPal Invoicing v2 quickstart: https://developer.paypal.com/api/invoicing/
- PayPal Invoicing v2 reference: https://developer.paypal.com/api/invoicing/v2/
- PayPal Orders API integration: https://developer.paypal.com/api/rest/integration/orders-api
- PayPal REST authentication: https://developer.paypal.com/api/rest/authentication
- PayPal REST requests/idempotency: https://developer.paypal.com/api/rest/requests/
- PayPal MCP server: https://developer.paypal.com/ai-tools/mcp-server
- PayPal TypeScript Server SDK: https://github.com/paypal/PayPal-TypeScript-Server-SDK
- Next.js installation/system requirements: https://nextjs.org/docs/app/getting-started/installation
- Prisma ORM 7 SQLite quickstart (assessment of rejected added complexity): https://www.prisma.io/docs/v7/prisma-orm/quickstart/sqlite
- Node.js v24 SQLite API: https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html
- Vitest getting started: https://vitest.dev/guide/

## Hechos verificados y consecuencias

1. La hackathon requiere una aplicación funcional que integre PayPal Developer Platform en Sandbox y una herramienta/modelo/plataforma de IA. Requiere repo público con licencia, instrucciones operables y video público YouTube de menos de 3 minutos. Cierre publicado: 12-Nov-2026 12:00 PST (16:00 hora de La Paz). Fuente: reglas Devpost anteriores.
2. Invoicing API: `POST /v2/invoicing/invoices` crea un borrador; no notifica al cliente hasta una posterior llamada `POST /v2/invoicing/invoices/{id}/send`. En el quickstart PayPal pide business account con Invoicing habilitado y credenciales Sandbox. No se ha llamado al endpoint en esta sesión.
3. Orders v2: `POST /v2/checkout/orders`, aprobación del comprador en PayPal, luego captura. PayPal indica que las llamadas se deben hacer desde el servidor. Esto es checkout de comercio, no P2P Friends & Family.
4. REST APIs: OAuth 2.0 con client ID/secret para token; credenciales permanecen server-side. `PayPal-Request-Id` es el mecanismo documentado para idempotencia en operaciones compatibles.
5. PayPal MCP ofrece herramientas para tareas comerciales mediante MCP local/remoto. Su existencia no demuestra una API P2P ni autoriza al modelo a ejecutar automáticamente acciones.
6. El TypeScript Server SDK oficial localizado declara cobertura de cinco controladores (Orders, Payments, Vault, Transaction Search, Subscriptions); no lista Invoicing. Para Invoicing la ruta compatible encontrada es REST directa tras auth OAuth.
7. Next.js requiere Node 20.9+ según docs actuales; Node local `v24.22.1` satisface el mínimo. Vitest actual requiere Node 22.12+; la versión local también lo satisface.
8. Prisma ORM v7 puede usar SQLite, pero requiere driver adapter, configuración y generación de client. Se difiere para el prototipo local a favor de un repositorio SQLite más pequeño.
9. Node.js documenta `node:sqlite`; SQLite pasó a Release Candidate en Node v24.15.0. El runtime disponible es v24.22.1. Se prefiere para este prototipo local sobre SQLite nativo npm: `better-sqlite3` 13.0.3 instalado no incluyó un prebuild `win32-x64.node` y `npm rebuild` no generó el binding.

## No confirmado / no probado

- No se ha recibido ni inspeccionado credencial Sandbox o acceso al dashboard.
- No se ha verificado habilitación de Invoicing en una cuenta sandbox.
- No se confirma una API pública de envío personal Friends & Family/P2P adecuada a este proyecto. El producto debe limitarse a orientación y dejar la ejecución al usuario en el flujo oficial.
- No se ha configurado ni probado ningún proveedor real de LLM. La primera integración será un adaptador mock explícito.
- No se han ejecutado requests PayPal, MCP tools, pruebas de Sandbox ni transacciones.
- Los requisitos competitivos y la elegibilidad individual deben revisarse con las reglas vigentes antes de inscribir o enviar; el handoff señala mayoría de edad en jurisdicción de residencia.
