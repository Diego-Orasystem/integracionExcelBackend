require('dotenv').config();
const mongoose = require('mongoose');
const Folder = require('../src/models/Folder');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/excel-manager', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('Conectado a MongoDB');
  
  try {
    const folder = await Folder.findOne();
    console.log('Folder ID disponible:', folder ? folder._id : 'No hay carpetas disponibles');
    
    // Listar todas las carpetas disponibles
    const folders = await Folder.find().select('_id name path');
    console.log('\nCarpetas disponibles:');
    folders.forEach(f => {
      console.log(`- ${f._id}: ${f.name} (${f.path})`);
    });
  } catch (err) {
    console.error('Error al buscar carpetas:', err);
  }
  
  mongoose.connection.close();
})
.catch(err => {
  console.error('Error al conectar a MongoDB:', err);
}); 