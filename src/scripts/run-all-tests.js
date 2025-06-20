/**
 * Script unificado para ejecutar todas las pruebas del MVP
 * Este script ejecuta pruebas unitarias, de integración y de roles/permisos
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const colors = require('colors');

// Configuración
const scripts = [
  {
    name: 'Pruebas Unitarias',
    path: path.join(__dirname, 'run-unit-tests.js'),
    color: 'green'
  },
  {
    name: 'Pruebas de Integración',
    path: path.join(__dirname, 'run-integration-tests.js'),
    color: 'blue'
  },
  {
    name: 'Pruebas de Roles y Permisos',
    path: path.join(__dirname, 'test-roles-permissions.js'),
    color: 'magenta'
  }
];

// Función para ejecutar un script de Node.js como proceso
const runScript = (scriptPath, name, color) => {
  return new Promise((resolve, reject) => {
    console.log(`\n[${'INICIANDO'.bold[color]}] ${name.bold[color]}`);
    console.log('='.repeat(50)[color]);
    
    const process = spawn('node', [scriptPath], { stdio: 'inherit' });
    
    process.on('close', code => {
      if (code === 0) {
        console.log(`\n[${'COMPLETADO'.bold[color]}] ${name.bold[color]}`);
        console.log('='.repeat(50)[color]);
        resolve();
      } else {
        console.log(`\n[${'ERROR'.bold.red}] ${name.bold.red} (código ${code})`);
        console.log('='.repeat(50).red);
        // No rechazamos la promesa para continuar con los demás tests
        resolve();
      }
    });
    
    process.on('error', err => {
      console.log(`\n[${'ERROR'.bold.red}] ${name.bold.red}`);
      console.log(err.red);
      console.log('='.repeat(50).red);
      // No rechazamos la promesa para continuar con los demás tests
      resolve();
    });
  });
};

// Función principal
const runAllTests = async () => {
  console.log('\n============================================='.yellow.bold);
  console.log('   EJECUTANDO TODAS LAS PRUEBAS DEL MVP'.yellow.bold);
  console.log('=============================================\n'.yellow.bold);
  
  const startTime = Date.now();
  
  try {
    // Verificar que existe el directorio para resultados
    const resultsDir = path.join(process.cwd(), 'test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Ejecutar cada script secuencialmente
    for (const script of scripts) {
      await runScript(script.path, script.name, script.color);
    }
    
    // Generar informe combinado
    console.log('\n============================================='.cyan.bold);
    console.log('   GENERANDO INFORME COMBINADO'.cyan.bold);
    console.log('=============================================\n'.cyan.bold);
    
    // Leer todos los archivos de resultados
    const resultFiles = fs.readdirSync(resultsDir)
      .filter(file => file.endsWith('.json'))
      .sort((a, b) => {
        // Ordenar por fecha de creación (más reciente primero)
        return fs.statSync(path.join(resultsDir, b)).mtime.getTime() - 
               fs.statSync(path.join(resultsDir, a)).mtime.getTime();
      });
    
    // Obtener los archivos más recientes de cada tipo de prueba
    const latestUnitTest = resultFiles.find(file => file.includes('unit-tests'));
    const latestIntegrationTest = resultFiles.find(file => file.includes('integration-tests'));
    const latestRolesTest = resultFiles.find(file => file.includes('roles-permissions-tests'));
    
    const results = {
      timestamp: new Date(),
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        successRate: 0
      },
      unitTests: latestUnitTest ? 
        JSON.parse(fs.readFileSync(path.join(resultsDir, latestUnitTest))) : null,
      integrationTests: latestIntegrationTest ? 
        JSON.parse(fs.readFileSync(path.join(resultsDir, latestIntegrationTest))) : null,
      rolesTests: latestRolesTest ? 
        JSON.parse(fs.readFileSync(path.join(resultsDir, latestRolesTest))) : null
    };
    
    // Calcular totales
    if (results.unitTests) {
      results.summary.totalTests += results.unitTests.summary.total;
      results.summary.passedTests += results.unitTests.summary.passed;
      results.summary.failedTests += results.unitTests.summary.failed;
    }
    
    if (results.integrationTests) {
      results.summary.totalTests += results.integrationTests.summary.total;
      results.summary.passedTests += results.integrationTests.summary.passed;
      results.summary.failedTests += results.integrationTests.summary.failed;
    }
    
    if (results.rolesTests) {
      results.summary.totalTests += results.rolesTests.summary.total;
      results.summary.passedTests += results.rolesTests.summary.passed;
      results.summary.failedTests += results.rolesTests.summary.failed;
    }
    
    // Calcular tasa de éxito global
    if (results.summary.totalTests > 0) {
      results.summary.successRate = Math.round(
        (results.summary.passedTests / results.summary.totalTests) * 100
      );
    }
    
    // Guardar informe combinado
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    fs.writeFileSync(
      path.join(resultsDir, `combined-report-${timestamp}.json`),
      JSON.stringify(results, null, 2)
    );
    
    // Generar informe HTML básico
    const htmlReport = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Informe de Pruebas MVP</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        header {
            background-color: #4a6da7;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        h1 {
            margin: 0;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-item {
            background-color: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .summary-value {
            font-size: 2rem;
            font-weight: bold;
        }
        .success-rate {
            font-size: 3rem;
        }
        .pass {
            color: #46a758;
        }
        .fail {
            color: #e85d3d;
        }
        .test-group {
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            margin-bottom: 20px;
            overflow: hidden;
        }
        .test-group-header {
            background-color: #f0f0f0;
            padding: 15px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .test-group-body {
            padding: 0;
        }
        .test-item {
            padding: 10px 15px;
            border-bottom: 1px solid #eee;
        }
        .test-item:last-child {
            border-bottom: none;
        }
        .test-name {
            font-weight: 500;
        }
        .test-message {
            font-size: 0.9rem;
            color: #666;
            margin-top: 5px;
        }
        .success {
            border-left: 4px solid #46a758;
        }
        .failure {
            border-left: 4px solid #e85d3d;
        }
        .timestamp {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <header>
        <h1>Informe de Pruebas MVP</h1>
        <p>Resumen de pruebas unitarias, de integración y de roles</p>
    </header>
    
    <div class="summary">
        <div class="summary-item">
            <h3>Total Pruebas</h3>
            <div class="summary-value">${results.summary.totalTests}</div>
        </div>
        <div class="summary-item">
            <h3>Pruebas Exitosas</h3>
            <div class="summary-value pass">${results.summary.passedTests}</div>
        </div>
        <div class="summary-item">
            <h3>Pruebas Fallidas</h3>
            <div class="summary-value fail">${results.summary.failedTests}</div>
        </div>
        <div class="summary-item">
            <h3>Tasa de Éxito</h3>
            <div class="summary-value success-rate ${results.summary.successRate >= 80 ? 'pass' : 'fail'}">${results.summary.successRate}%</div>
        </div>
    </div>
    
    ${results.unitTests ? `
    <div class="test-group">
        <div class="test-group-header">
            <span>Pruebas Unitarias</span>
            <span>${results.unitTests.summary.passed}/${results.unitTests.summary.total} (${results.unitTests.summary.successRate}%)</span>
        </div>
        <div class="test-group-body">
            ${results.unitTests.results.map(test => `
                <div class="test-item ${test.success ? 'success' : 'failure'}">
                    <div class="test-name">${test.name}</div>
                    <div class="test-message">${test.message}</div>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}
    
    ${results.integrationTests ? `
    <div class="test-group">
        <div class="test-group-header">
            <span>Pruebas de Integración</span>
            <span>${results.integrationTests.summary.passed}/${results.integrationTests.summary.total} (${results.integrationTests.summary.successRate}%)</span>
        </div>
        <div class="test-group-body">
            ${results.integrationTests.results.map(test => `
                <div class="test-item ${test.success ? 'success' : 'failure'}">
                    <div class="test-name">${test.name}</div>
                    <div class="test-message">${test.message}</div>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}
    
    ${results.rolesTests ? `
    <div class="test-group">
        <div class="test-group-header">
            <span>Pruebas de Roles y Permisos</span>
            <span>${results.rolesTests.summary.passed}/${results.rolesTests.summary.total} (${results.rolesTests.summary.successRate}%)</span>
        </div>
        <div class="test-group-body">
            ${results.rolesTests.results.map(test => `
                <div class="test-item ${test.success ? 'success' : 'failure'}">
                    <div class="test-name">${test.name}</div>
                    <div class="test-message">${test.message}</div>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}
    
    <div class="timestamp">
        Informe generado el ${results.timestamp.toString()}
    </div>
</body>
</html>
    `;
    
    fs.writeFileSync(
      path.join(resultsDir, `test-report-${timestamp}.html`),
      htmlReport
    );
    
    // Calcular tiempo total
    const totalTime = (Date.now() - startTime) / 1000;
    
    // Mostrar resumen final
    console.log('\n============================================='.yellow.bold);
    console.log('   RESUMEN FINAL DE PRUEBAS'.yellow.bold);
    console.log('============================================='.yellow.bold);
    console.log(`Total de pruebas: ${results.summary.totalTests}`.white);
    console.log(`Pruebas exitosas: ${results.summary.passedTests}`.green);
    console.log(`Pruebas fallidas: ${results.summary.failedTests}`.red);
    console.log(`Tasa de éxito global: ${results.summary.successRate}%`.yellow);
    console.log(`Tiempo total: ${totalTime.toFixed(2)} segundos`.gray);
    console.log(`\nInforme HTML generado: test-results/test-report-${timestamp}.html`.cyan);
    console.log('=============================================\n'.yellow.bold);
    
  } catch (error) {
    console.error(`Error al ejecutar pruebas: ${error.message}`.red.bold);
    console.error(error);
  }
};

// Ejecutar todas las pruebas
runAllTests(); 