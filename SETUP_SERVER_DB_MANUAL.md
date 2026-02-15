# INSTRUCCIONES PARA CONFIGURAR LA BASE DE DATOS EN EL SERVIDOR

## Paso 1: Conectarse al servidor
```bash
ssh -p 22022 administrador@170.55.79.9
```

## Paso 2: Iniciar PostgreSQL (requiere contraseña sudo)
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo systemctl status postgresql
```

## Paso 3: Crear usuario y base de datos
```bash
sudo -u postgres psql
```

Dentro de psql, ejecutar:
```sql
CREATE USER aba_admin WITH PASSWORD 'Pr0s1s.2026';
CREATE DATABASE aba_supervision OWNER aba_admin;
GRANT ALL PRIVILEGES ON DATABASE aba_supervision TO aba_admin;
\q
```

## Paso 4: Verificar conexión
```bash
PGPASSWORD='Pr0s1s.2026' psql -h localhost -U aba_admin -d aba_supervision -c "SELECT version();"
```

## Paso 5: Actualizar .env en el servidor
```bash
cd /home/administrador/aba-supervision-system
nano .env
```

Cambiar la línea DATABASE_URL a:
```
DATABASE_URL="postgresql://aba_admin:Pr0s1s.2026@localhost:5432/aba_supervision"
```

## Paso 6: Ejecutar migraciones
```bash
cd /home/administrador/aba-supervision-system
npx prisma migrate deploy
```

---

**ALTERNATIVA AUTOMÁTICA (si tienes acceso root):**

Puedo crear un script que haga todo esto automáticamente si me das acceso root o configuras sudo sin contraseña para el usuario administrador.
