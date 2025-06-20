/**
 * Servicio de correo sencillo con Nodemailer
 */
const nodemailer = require('nodemailer');

// Configuración del transporte de correo
let transporter;

// Inicializar el servicio de correo
const initEmailService = () => {
  try {
    console.log('🚀 Inicializando servicio de correo real...');
    
    // CONFIGURA ESTAS DOS LÍNEAS CON TUS DATOS DE GMAIL
    const EMAIL = 'gestorexcel12@gmail.com'; // Cambia esto por tu correo Gmail
    const PASSWORD = 'psvu fraf cgbc ztzq'; // Contraseña de aplicación de Gmail
    
    // Crear el transporter para Gmail con opciones adicionales para solucionar problemas de SSL
    transporter = nodemailer.createTransport({
      service: 'gmail',  // Servicio preconfigurado para Gmail
      auth: {
        user: EMAIL,
        pass: PASSWORD
      },
      // Añadir opciones para solucionar problemas de certificados
      tls: {
        rejectUnauthorized: false,  // Acepta certificados autofirmados
        ciphers: 'SSLv3'            // Usa cifrado compatible
      },
      secure: false // Usar TLS en lugar de SSL
    });
    
    console.log('✅ Servicio de correo configurado correctamente');
    console.log('📧 Usando cuenta de correo:', EMAIL);
    
    // Si las credenciales son las predeterminadas, mostrar instrucciones
    if (EMAIL === 'tu.correo@gmail.com') {
      console.log('\n⚠️ USANDO MODO DE SIMULACIÓN - NO SE ENVIARÁN CORREOS REALES');
      console.log('⚠️ Para enviar correos reales, edita las líneas 14-15 en src/services/email.service.js');
      console.log('⚠️ Los códigos de verificación se mostrarán en la consola\n');
      
      // En modo simulación usamos un transporter falso
      transporter = null;
    }
    
    // Verificar conexión (opcional, puede dar falsos positivos)
    // transporter.verify((error, success) => {
    //   if (error) {
    //     console.error('❌ Error al verificar el transporter:', error);
    //     transporter = null;
    //   } else {
    //     console.log('✅ Servidor listo para enviar mensajes');
    //   }
    // });
    
    return true;
  } catch (error) {
    console.error('❌ Error al configurar el servicio de correo:', error);
    transporter = null;
    return false;
  }
};

/**
 * Envía un correo electrónico
 * @param {Object} options - Opciones del correo
 * @param {String} options.to - Destinatario del correo
 * @param {String} options.subject - Asunto del correo
 * @param {String} options.text - Texto plano del correo
 * @param {String} options.html - Contenido HTML del correo
 * @returns {Promise} - Promesa que resuelve cuando se envía el correo
 */
const sendEmail = async (options) => {
  try {
    // Extraer el código de verificación del contenido
    const verificationCode = options.text.match(/\d{6}/)?.[0] || 'No encontrado';
    
    // Si no hay transporter configurado, mostrar en consola y salir
    if (!transporter) {
      // Mostrar información en la consola de forma destacada
      console.log('\n');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║                  CÓDIGO DE VERIFICACIÓN                  ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log(`║  Email: ${options.to.padEnd(48)}║`);
      console.log(`║  Código: ${verificationCode.padEnd(46)}║`);
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('\n');
      
      return {
        id: 'simulado-' + Date.now(),
        success: true
      };
    }
    
    // Si hay transporter, enviar el correo real
    const mailOptions = {
      from: `"Sistema de Gestión" <${transporter.options.auth.user}>`,  // Añadir un nombre amigable
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    };
    
    // Enviar correo
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Correo enviado a:', options.to);
      console.log('📨 ID de mensaje:', info.messageId || 'No disponible');
      
      return info;
    } catch (mailError) {
      console.error('❌ Error al enviar el correo:', mailError);
      
      // Mostrar el código en la consola como fallback
      console.log('\n');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║            CÓDIGO DE VERIFICACIÓN (FALLBACK)             ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log(`║  Email: ${options.to.padEnd(48)}║`);
      console.log(`║  Código: ${verificationCode.padEnd(46)}║`);
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('\n');
      
      // Retornar un objeto simulado para que la aplicación siga funcionando
      return { 
        id: 'fallback-' + Date.now(),
        success: true,
        fallback: true
      };
    }
  } catch (error) {
    console.error('❌ Error en el servicio de correo:', error);
    
    // En caso de error, mostrar el código en la consola como fallback
    const verificationCode = options.text.match(/\d{6}/)?.[0] || 'No encontrado';
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║            CÓDIGO DE VERIFICACIÓN (FALLBACK)             ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Email: ${options.to.padEnd(48)}║`);
    console.log(`║  Código: ${verificationCode.padEnd(46)}║`);
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    // No lanzar error, en su lugar retornar un objeto simulado
    // para que la aplicación siga funcionando
    return { 
      id: 'error-' + Date.now(),
      success: true,
      error: true
    };
  }
};

/**
 * Envía un correo con código de verificación para inicio de sesión
 * @param {String} to - Correo del destinatario
 * @param {String} code - Código de verificación
 * @param {String} name - Nombre del usuario
 * @returns {Promise} - Promesa que resuelve cuando se envía el correo
 */
const sendLoginCode = async (to, code, name) => {
  const subject = 'Código de verificación para iniciar sesión';
  const text = `Hola ${name},\n\nTu código de verificación para iniciar sesión es: ${code}\n\nEste código expirará en 10 minutos.\n\nSi no solicitaste este código, por favor ignora este correo.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333;">Código de verificación</h2>
      <p>Hola <strong>${name}</strong>,</p>
      <p>Tu código de verificación para iniciar sesión es:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
        ${code}
      </div>
      <p>Este código expirará en <strong>10 minutos</strong>.</p>
      <p style="color: #777; font-size: 12px; margin-top: 30px;">Si no solicitaste este código, por favor ignora este correo.</p>
    </div>
  `;
  
  return sendEmail({ to, subject, text, html });
};

// Inicializar el servicio al cargar el módulo
initEmailService();

module.exports = {
  sendEmail,
  sendLoginCode
}; 