# PayIntent AI — estado

## Actualización 2026-11-12

- Adaptador de borradores reales en PayPal Sandbox implementado mediante OAuth 2.0 e Invoicing v2. Usa `PayPal-Request-Id` estable para reintentos y no envía facturas.
- Adaptadores de clasificación Jev y Gemini implementados. Gemini 3.1 Flash-Lite respondió con clasificación JSON verificada en vivo en aproximadamente 1.2 segundos; se eligió por su menor latencia para esta interacción simple.
- Si el proveedor de IA devuelve un error transitorio, PayIntent usa el clasificador de reglas para completar la orientación y muestra ese fallback en la interfaz; no responde con un error genérico para una solicitud válida.
- UI muestra el modo real de IA y PayPal y explica consecuencias de los tipos de pago.
- Verificación local final de esta fase: 26 pruebas aprobadas; ESLint, TypeScript y build aprobados. El build usa el fallback WASM porque el binario SWC incluido falla en este Windows.
- PayPal OAuth Sandbox incluye el scope de Invoicing y el smoke final creó un borrador remoto `DRAFT` en Sandbox. No se envió factura, no se notificó a ningún destinatario y no se movieron fondos.
- `.env.local` contiene credenciales locales y está ignorado por Git. No mostrar ni compartir sus valores.
- El render final del video ad/walkthrough está en `presentation/video/payintent_ad_walkthrough.mp4` (44 segundos, 1280×720, 60 fps); se revisó un fotograma tras el último render con la marca original ruta-y-check.
- La confirmación posterior a la aprobación dice explícitamente que el borrador permanece sin enviar: el destinatario no recibe notificación y no se mueve dinero.
- Git inicializado. La UI incluye aclaración interactiva y valida importe positivo, moneda de demo y correo sin confundir sus dígitos con el importe.
- Prioridades de entrega: publicar repositorio/video y completar Devpost antes de las 16:00.


## Registro histórico de la auditoría inicial (2026-11-04)

Los estados pendientes a continuación describen el inicio del proyecto; el estado vigente está arriba.

Fecha: 2026-11-04 (America/La_Paz)

## Hito actual

- Hito 0: auditoría y verificación inicial completadas.
- Hito 1: vertical slice de clasificación, política, revisión y auditoría en modo mock, en curso.

## Auditoría observada

- El directorio de trabajo `C:\Users\johan\Documents\Projects\Paypal` estaba vacío: 0 elementos, sin `.git`, manifiesto, lockfile, tests, README ni código existente.
- No se encontró `AGENTS.md` en el directorio ni en sus directorios padre.
- Herramientas presentes: Node `v24.22.1`, npm `11.19.1`, Git `2.56.0.windows.1`.
- La instalación de dependencias y las pruebas aún no se han ejecutado al redactar este documento.
- Prioridad exclusiva: PayIntent AI. ChangeScope/Codegeist permanece fuera del código y el roadmap de esta fase.

## Próximo

1. Crear el scaffolding web y un módulo de dominio independiente del proveedor.
2. Cubrir validación, clasificación, reglas, aprobación ligada al payload y auditoría con pruebas.
3. Añadir UI responsive y endpoint que ejercite el flujo mock completo.
4. Ejecutar suite, typecheck, build y un recorrido de UI; registrar resultados observados.

## Bloqueos y límites

- No se ha proporcionado acceso a PayPal Sandbox ni un proveedor de LLM; el primer slice debe funcionar sin credenciales y mostrar `DEMO / MOCK`.
- No habrá transferencias P2P, envío de facturas ni captura/cobro real en esta fase.
- El acceso al sandbox y la elegibilidad para enviar una entrada competitiva se mantienen sin confirmar.
