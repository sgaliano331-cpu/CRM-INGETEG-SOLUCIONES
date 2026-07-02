const bcrypt = require('bcryptjs');
const { getDb } = require('./db');

const db = getDb();

const usuarios = [
  {
    username: 'coordinador',
    password: 'Ingeteg2024!',
    nombre: 'Coordinador Comercial',
    rol: 'COORDINADOR',
  },
  {
    username: 'gestor',
    password: 'Gestor01!',
    nombre: 'Gestor de Servicios',
    rol: 'GESTOR',
  },
  {
    username: 'asesora1',
    password: 'Asesora01!',
    nombre: 'Asesora Comercial 1',
    rol: 'ASESORA',
  },
  {
    username: 'asesora2',
    password: 'Asesora02!',
    nombre: 'Asesora Comercial 2',
    rol: 'ASESORA',
  },
  {
    username: 'asesora3',
    password: 'Asesora03!',
    nombre: 'Asesora Comercial 3',
    rol: 'ASESORA',
  },
  {
    username: 'asesora4',
    password: 'Asesora04!',
    nombre: 'Asesora Comercial 4',
    rol: 'ASESORA',
  },
];

// Usamos db.serialize para ejecutar de forma limpia en la nueva librería estándar
db.serialize(() => {
  console.log('Encriptando contraseñas e insertando usuarios en Ingeteg CRM...');

  usuarios.forEach((u) => {
    // Encriptar la contraseña de forma segura
    const hash = bcrypt.hashSync(u.password, 10);

    // Consulta nativa directa sin usar .transaction
    db.run(
      `INSERT OR IGNORE INTO usuarios (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)`,
      [u.username, hash, u.nombre, u.rol],
      function (err) {
        if (err) {
          console.error(`Error al crear usuario ${u.username}:`, err.message);
        } else {
          console.log(`Usuario verificado/creado: ${u.username}`);
        }
      }
    );
  });

  setTimeout(() => {
    console.log('\nProceso terminado de forma limpia.');
    console.table(
      usuarios.map((u) => ({ username: u.username, password: u.password, rol: u.rol }))
    );
  }, 1000);
});
