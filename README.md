# Cristian Deportivas

Planilla de apuestas (perspectiva de la banca) con sincronización en la nube: Cris, Vale y quien quieras ven los mismos datos al instante, desde cualquier lugar, con **usuario y contraseña**.

Hay dos modos:

- **Local (por defecto):** sin configurar nada, los datos se guardan solo en el navegador de cada equipo y se elige el usuario (Cris / Vale) en una lista.
- **Nube compartida:** con una base gratuita de Supabase y un sitio gratuito en Vercel. Es lo que se explica abajo.

## Probarla en tu compu

```bash
npm install
npm run dev
```

Se abre en http://localhost:5173.

## Activar la nube (todo gratis)

### 1. Crear la base de datos (Supabase)

1. Entrá a https://supabase.com, creá una cuenta gratis y un proyecto nuevo.
2. **SQL Editor → New query**: pegá todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y tocá **Run**. Tiene que decir "Success". (Si ya habías corrido una versión anterior, este archivo la reemplaza; solo borraba datos de prueba.)
3. En **Project Settings → API Keys** copiá la **Project URL** y la clave **publishable** (o `anon`). **Nunca uses la `secret` / `service_role`.**

### 2. Configurar y probar en tu compu

Poné las dos claves en el archivo `.env.local` (o `.env`):

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=la-clave-publishable
```

Reiniciá `npm run dev`. Al abrir la página aparece la pantalla de **Ingresar / Registrarme**.

### 3. Crear las cuentas de Cris y Vale (administradores)

1. En la página tocá **Registrarme** y creá la cuenta de Cris (usuario `cris`) y la de Vale (`vale`). Hacelo antes de compartir la dirección con nadie.
2. En Supabase → **SQL Editor** corré **una sola vez** (la primera cuenta de administrador siempre sale de tu cuenta de Supabase):

```sql
update public.app_users
   set is_admin = true, role = 'edit', wants_edit = false
 where username in ('cris', 'vale');
```

3. Cerrá sesión y volvé a entrar (o esperá unos segundos): ya pueden editar y administrar usuarios. Más adelante, los administradores pueden darle o quitarle el rol a otras personas desde la propia página.

Si los datos que ya cargaste están en este navegador (modo local), entrá **primero con la cuenta de Cris desde ese mismo navegador**: como la nube está vacía, se suben solos.

### 4. Publicarla gratis en Vercel

1. Subí la carpeta `apuestas` a un repositorio de GitHub.
2. En https://vercel.com → **Add New → Project** → importá el repositorio.
3. En **Environment Variables** cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Poné de nombre `cristiandeportivas` y **Deploy**. Queda en `https://cristiandeportivas.vercel.app` si el nombre está libre.

## Cómo funcionan las cuentas

- **Registrarse:** nombre que se muestra, usuario, contraseña (mínimo 8 caracteres) y qué necesita (solo ver / ver y editar). **Toda cuenta nueva queda pendiente**: hasta que Cris o Vale la aprueben no se ve nada de la planilla. La pantalla de espera se actualiza sola cuando la aprueban.
- **Aprobar:** los administradores ven un globito rojo con la cantidad de pedidos. En el menú de su nombre → **Usuarios y permisos** pueden **aprobar como lector**, **aprobar como editor** o **rechazar**.
- **Recordarme en este equipo:** mantiene la sesión 30 días. Sin tildarlo, la sesión dura hasta cerrar la pestaña (máximo 1 día).
- **Cambiar contraseña:** menú de tu nombre → **Cambiar contraseña** (pide la actual y cierra tus sesiones en otros equipos).
- **Olvidé mi contraseña:** no hay correo. Cris o Vale tocan el ícono de la llave junto a tu nombre en *Usuarios y permisos* y reciben una **clave temporal** (se muestra una sola vez, para pasártela por mensaje). Al entrar con ella tenés que elegir una contraseña propia. Si el que la olvida es el único administrador, la cambia el dueño del proyecto desde el SQL Editor de Supabase.
- **Administradores:** desde *Usuarios y permisos* se puede **dar o quitar el rol de administrador** (el escudo), **cambiar el permiso** (lector / editor / sin acceso / bloqueado) y **eliminar usuarios** (el tacho). Nadie puede cambiar o eliminar su propia cuenta desde ahí. Un administrador siempre es editor.
- **Cerrar sesión** borra la copia de la planilla guardada en ese equipo.
- En cada jugada figura quién la cargó o modificó ("Mod. por Cris"), con el nombre que cada uno eligió al registrarse.

## Cómo funciona la sincronización

- Cada cambio se sube a los ~0,7 segundos y los demás equipos reciben un aviso al instante (además consultan cada 12 segundos).
- Si dos personas editan a la vez **jugadas distintas**, se conservan las dos. Si tocan campos distintos de la misma jugada, también. Solo si cambian exactamente el mismo dato gana el último en guardar.
- Sin internet la app sigue funcionando; al volver la conexión sincroniza sola. El indicador de arriba muestra el estado.
- Los usuarios de **solo lectura** solo reciben datos: aunque alguien manipule la página, el servidor rechaza sus cambios.

## Seguridad: leer antes de compartir

- Las contraseñas se guardan **cifradas** (bcrypt) y las sesiones con un código que tampoco se guarda en claro. Después de 5 contraseñas incorrectas, la cuenta se bloquea 10 minutos.
- Todo el control de permisos está en el servidor (Supabase): sin sesión aprobada no se puede leer ni escribir nada, solo los editores pueden guardar y solo los administradores pueden aprobar, restablecer contraseñas o eliminar usuarios. Aunque alguien manipule la página, el servidor rechaza lo que no le corresponde.
- Como toda cuenta nueva necesita aprobación, que la dirección de la página sea pública no expone las jugadas: sin aprobación se ve solo la pantalla de ingreso. Aun así, **no apruebes a quien no conozcas**.
- La clave temporal la ve solo quien la genera, una vez. Pasala por un medio privado.
- La `anon key` queda dentro de la página (es público por diseño en Supabase). No pongas la `service_role` en ningún lado.
- Límites del plan gratuito de Supabase: el proyecto se pausa si pasa una semana sin uso (se reactiva desde el panel). Hacé un **Respaldo JSON** de vez en cuando.

## Otras funciones

- Semanas cerradas editables (se conservan 3), exportación a Excel (`.xlsx`) y CSV, modo día/noche, vista en tarjetas para celular y split-screen.
