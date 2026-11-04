# Cristian Deportivas

Planilla de apuestas (perspectiva de la banca) con sincronización en la nube, para usarla desde cualquier lugar y que Cris, Vale y quien quieras vean los mismos datos al instante.

Hay dos modos:

- **Local (por defecto):** sin configurar nada, los datos se guardan solo en el navegador de cada equipo.
- **Nube compartida:** con una base gratuita de Supabase y un sitio gratuito en Vercel. Es lo que se explica abajo.

## Probarla en tu compu

```bash
npm install
npm run dev
```

Se abre en http://localhost:5173.

## Activar la nube (todo gratis, unos 15 minutos)

### 1. Crear la base de datos (Supabase)

1. Entrá a https://supabase.com, creá una cuenta gratis y un proyecto nuevo (elegí una región cercana, por ejemplo São Paulo).
2. En el menú: **SQL Editor → New query**. Pegá todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y tocá **Run**.
3. En **Project Settings → API** copiá dos datos:
   - **Project URL** (algo como `https://abcdxyz.supabase.co`)
   - **anon public key** (la clave larga que dice `anon` / `public`). **No uses la `service_role`.**

### 2. Probarla en tu compu con la nube

Creá un archivo `.env` (copiá `.env.example`) y completá:

```
VITE_SUPABASE_URL=https://abcdxyz.supabase.co
VITE_SUPABASE_ANON_KEY=la-clave-anon
```

Reiniciá `npm run dev`. Al abrir la página te pide un **código de acceso**: inventá uno largo (mínimo 12 caracteres) y compartilo solo con la gente de confianza. Todos los que entren con el mismo código ven y editan la misma planilla.

### 3. Publicarla gratis en Vercel (dirección pública)

1. Subí la carpeta `apuestas` a un repositorio de GitHub (privado alcanza).
2. En https://vercel.com creá una cuenta gratis → **Add New → Project** → importá ese repositorio.
3. En **Environment Variables** cargá las mismas dos variables (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
4. Poné de nombre del proyecto `cristiandeportivas` y tocá **Deploy**. Si el nombre está libre, queda en `https://cristiandeportivas.vercel.app` (si ya está tomado, Vercel te ofrece otro).
5. Entrá desde el celular o desde cualquier red, ingresá el código de acceso y listo.

## Cómo funciona la sincronización

- Cada cambio se sube a los ~0,7 segundos y los demás equipos reciben un aviso al instante (además consultan cada 12 segundos por las dudas).
- Si dos personas editan a la vez **jugadas distintas**, se conservan las dos. Si editan campos distintos de la misma jugada, también. Solo si tocan exactamente el mismo dato gana el último en guardar.
- Sin internet la app sigue funcionando; cuando vuelve la conexión, sincroniza sola. El indicador de arriba muestra el estado (Sincronizado / Sincronizando / Sin conexión).
- La primera vez que un equipo se conecta a una planilla que ya tiene datos, **mandan los datos de la nube**; lo que había en ese navegador queda guardado como copia en el propio navegador (`apuestas-backup-antes-de-la-nube`).

## Seguridad: leer antes de compartir

- La planilla **no tiene usuarios ni contraseñas**: la protege el **código de acceso**. Quien lo tenga puede ver y modificar todo. Que sea largo, que no sea una palabra común y no lo publiques.
- Se guarda un hash del código, nunca el código. La tabla de la base está cerrada y solo se accede con las dos funciones de `schema.sql`.
- La `anon key` queda dentro de la página (es público por diseño en Supabase). No pongas la `service_role` en ningún lado.
- Los usuarios "Cris", "Vale" y los permisos (edición / solo lectura) **no son seguridad**: sirven para registrar quién cambió qué. Cualquiera con el código puede elegir cualquier usuario.
- Para cambiar el código: menú ☰ → Nube → **Cambiar / salir del código**. Eso cambia de planilla (otro código = otra sala vacía); para pasar los datos usá **Respaldo JSON** y **Restaurar respaldo**.
- Límites del plan gratuito de Supabase: el proyecto se pausa si pasa una semana sin uso (se reactiva desde el panel) y tiene 500 MB de base, de sobra para esto. Hacé un **Respaldo JSON** de vez en cuando.

## Otras funciones

- Semanas cerradas editables (se conservan 3), exportación a Excel (`.xlsx`) y CSV, modo día/noche, vista en tarjetas para celular y split-screen.
- Pruebas del motor de sincronización: `src/lib/sync.js` (fusión de cambios simultáneos).
