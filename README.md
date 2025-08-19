# 📦 Inventario API

API REST desarrollada con **Node.js**, **Express**, **Sequelize** y **PostgreSQL** para la gestión de inventarios.

---

## 🚀 Tecnologías

- [Node.js](https://nodejs.org/) (Runtime)
- [Express](https://expressjs.com/) (Framework web)
- [Sequelize](https://sequelize.org/) (ORM para SQL)
- [PostgreSQL](https://www.postgresql.org/) (Base de datos)
- [EJS](https://ejs.co/) (Template engine para vistas opcionales)

---

## 📂 Estructura del proyecto

```
inventario/
├── bin/
│   └── www              # Punto de entrada de la aplicación
├── models/              # Modelos Sequelize
├── routes/              # Definición de rutas
├── controllers/         # Controladores de la API
├── views/               # Vistas (EJS, si aplica)
├── public/              # Archivos estáticos
├── package.json         # Configuración del proyecto
└── README.md            # Documentación
```

---

## ⚙️ Requisitos previos

- Node.js >= 18
- PostgreSQL >= 14
- npm >= 9 (recomendado usar `nvm` para manejar versiones)

---

## 📥 Instalación

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/inventario.git
   cd inventario
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configurar variables de entorno (crear archivo `.env`):
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=inventario
   DB_USER=usuario
   DB_PASSWORD=contraseña
   ```

4. Ejecutar migraciones (si usas Sequelize CLI):
   ```bash
   npx sequelize-cli db:migrate
   ```

---

## ▶️ Ejecución

- **Modo desarrollo**:
  ```bash
  npm start
  ```

- La API estará disponible en:  
  👉 [http://localhost:3000](http://localhost:3000)

---

## 📚 Endpoints básicos (ejemplo)

| Método | Endpoint       | Descripción                  |
|--------|---------------|------------------------------|
| GET    | `/api/items`  | Listar todos los ítems       |
| GET    | `/api/items/:id` | Obtener un ítem por ID   |
| POST   | `/api/items`  | Crear un nuevo ítem          |
| PUT    | `/api/items/:id` | Actualizar un ítem       |
| DELETE | `/api/items/:id` | Eliminar un ítem         |

*(Los endpoints reales dependerán de las rutas definidas en tu proyecto).*

---

## 🛡️ Scripts disponibles

- `npm start` → Inicia la aplicación en producción.  
- `npm run dev` → Inicia en modo desarrollo (si tienes nodemon configurado).  
- `npm test` → Corre los tests (si se implementan).  

---

## 📌 Notas

- Actualmente está usando **Express 5.x** y **Sequelize 6.x**.  
- Revisa breaking changes antes de desplegar en producción.  

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT.
