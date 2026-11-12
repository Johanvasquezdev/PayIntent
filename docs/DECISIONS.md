# PayIntent AI — decisiones técnicas

Fecha: 2026-11-04

| ID | Decisión | Motivo y trade-off | Estado |
|---|---|---|---|
| D-001 | Mantener PayIntent y ChangeScope como proyectos separados; este checkout se dedica solo a PayIntent. | Preserva el orden y evita mezclar dominios. | Aceptada |
| D-002 | Next.js App Router + TypeScript en un único proceso con módulos de dominio/adaptadores. | Es el stack del handoff; reduce despliegue y permite una UI y backend revisables en un repo vacío. | Aceptada |
| D-003 | Ninguna llamada de dinero desde el modelo; políticas deterministas y aprobación humana explícita. | El LLM interpreta texto, pero no autoriza operaciones ni decide que un pago personal sea comercial o viceversa. | Aceptada |
| D-004 | Primer slice con clasificador mock identificable, sin credenciales ni afirmaciones de IA/PayPal real. | Hace demostrable el flujo mientras no haya acceso autorizado; la interfaz de proveedor quedará sustituible. | Aceptada |
| D-005 | SQLite local mediante `node:sqlite` y un repositorio pequeño para registrar auditoría. | Persistencia local sin servidor DB. Se aplaza Prisma por su setup de adaptador/configuración; se descartó `better-sqlite3` porque su paquete actual no trae binario Windows x64 y no compiló en el entorno. `node:sqlite` es release candidate desde Node 24.15, así que el runtime del MVP queda fijado a Node 24.22+. | Aceptada para MVP local |
| D-006 | Integración PayPal mediante REST server-side y adaptador específico; primero Invoicing v2 borrador. | La documentación oficial permite crear un borrador y notificar al cliente solo con una operación posterior explícita. El SDK oficial de TypeScript/Node encontrado no incluye Invoicing entre sus controladores disponibles. | Implementada y verificada en Sandbox |
| D-007 | Orders v2 queda para un flujo posterior de checkout comercial con aprobación del comprador. | La API modela checkout comprador-vendedor; no es una sustitución de transferencias P2P. | Aceptada |
| D-008 | Excluir extensión, scraping/clicks en PayPal y MCP de la primera fase. | No son necesarios para probar el núcleo de decisión y sumarían superficie de permisos sin un caso inicial validado. | Aceptada |
| D-009 | Amounts se modelan con decimal string y currency code; nunca con aritmética `float`. | Evita redondeos monetarios. | Aceptada |
| D-010 | Crear solo borradores de factura en Sandbox; nunca enviar ni cobrar desde el asistente. | Permite comprobar PayPal con una operación reversible y revisión humana. | Implementada; smoke remoto aprobado |
| D-011 | Soportar USD, EUR y GBP en borradores de esta demo y pedir aclaración para otras monedas. | Son monedas presentes en la lista REST de PayPal; DOP aparece en referencia de FX pero no en la lista REST general. Evita errores de API y conversiones implícitas. | Implementada |
| D-012 | Priorizar integración real de un proveedor de IA y PayPal sobre Orders/extensión. | Las reglas exigen uso sustancial de ambos y una demo funcional; el tiempo de entrega es limitado. | Activa |
| D-013 | La confirmación de un borrador reemplaza el estado de revisión y declara explícitamente que no se notificó al destinatario ni se movió dinero. | Evita que un éxito técnico de Sandbox se interprete como el envío de una factura o una transacción financiera. | Implementada |
| D-014 | La marca de PayIntent usa una ruta geométrica con check y no un monograma P. | Mantiene una identidad visual propia y evita asemejarse a la marca de PayPal. | Implementada |
