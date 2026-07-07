# MVP — Herramientas inteligentes para explicar cotizaciones

Este proyecto convierte una cotización de seguro de vida en una página visual y editable para el prospecto.

## Qué incluye

- Panel privado en `/admin/`.
- Acceso con Netlify Identity.
- Carga de PDF y extracción estructurada con OpenAI.
- MAPFRE como primer formato probado.
- Lector genérico para Seguros Atlas, MetLife y otras aseguradoras.
- Pantalla de confirmación antes de publicar.
- Consulta automática de la UDI oficial de Banco de México, serie `SP68257`.
- Dirección permanente por cotización: `/cotizacion/XXXXXXXX`.
- Edición posterior sin cambiar el enlace.
- Historial de hasta 20 versiones anteriores.
- Almacenamiento de datos estructurados en Netlify Blobs.
- El PDF no se guarda en Blobs. El archivo temporal enviado a OpenAI se elimina al terminar la extracción.
- Ejemplo MAPFRE precargado para probar el flujo sin una clave de OpenAI.

## Límites conscientes del MVP

1. Los PDF pueden pesar hasta 4 MB.
2. MAPFRE está configurada con el ejemplo real disponible.
3. Atlas y MetLife usan extracción genérica hasta contar con cotizaciones reales para probar sus formatos.
4. La consulta automática de UDI requiere un token del SIE de Banco de México.
5. Para monedas distintas de UDI o MXN se debe confirmar manualmente el tipo de cambio.
6. La extracción con IA siempre debe revisarse antes de publicar.

## Variables de entorno

Configura en Netlify:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
BANXICO_TOKEN=...
```

`OPENAI_MODEL` es opcional.

## Despliegue recomendado

### Opción A: GitHub + Netlify

1. Sube esta carpeta a un repositorio de GitHub.
2. En Netlify, selecciona **Add new project > Import an existing project**.
3. Conecta el repositorio.
4. Netlify leerá automáticamente `netlify.toml`.
5. Agrega las variables de entorno.
6. Despliega.

### Opción B: Netlify CLI

```bash
npm install
npx netlify login
npx netlify init
npx netlify deploy --build --prod
```

No se recomienda arrastrar únicamente la carpeta `public` al panel de Netlify, porque las Functions y dependencias del servidor no se instalarían.

## Configurar el acceso privado

1. En el proyecto de Netlify, activa **Identity**.
2. Configura el registro como **Invite only**.
3. Invita solamente tu correo.
4. Abre `/admin/` e inicia sesión.

Las acciones de lectura, guardado y análisis están protegidas también en el servidor; no dependen solo de ocultar la página.

## Primera prueba

1. Abre `/admin/`.
2. Pulsa **Cargar ejemplo MAPFRE**.
3. Revisa los campos.
4. Pulsa **Vista previa**.
5. Guarda como borrador o publica.
6. Copia la dirección permanente.

También puedes abrir directamente la demostración visual en:

```text
/demo/
```

## Cómo se trata el PDF

1. El navegador envía el PDF a una Netlify Function.
2. La Function lo mantiene en memoria; no lo escribe en Netlify Blobs.
3. Se crea un archivo temporal en OpenAI para leerlo.
4. Se solicita una respuesta estructurada y se desactiva el almacenamiento de la respuesta con `store: false`.
5. La Function intenta eliminar inmediatamente el archivo temporal mediante la API de archivos de OpenAI.
6. Solo los datos confirmados por el usuario se guardan en Netlify Blobs.

## Estructura

```text
public/
  admin/             Panel privado
  cotizacion/        Página pública dinámica
  data/              Ejemplo MAPFRE
  assets/            Diseño y lógica del navegador
netlify/functions/
  parse-quote.mjs    Lector de PDF con IA
  quotes.mjs         Guardado, edición, listado e historial
  public-quote.mjs   Lectura pública de una cotización publicada
  udi.mjs            Consulta a Banco de México
```

## Siguiente evolución

Cuando existan cotizaciones reales de Seguros Atlas y MetLife, conviene añadir casos de prueba por producto y comparar la extracción automática contra los datos correctos antes de considerar esos formatos “probados”.
