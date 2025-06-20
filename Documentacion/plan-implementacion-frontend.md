# Plan de Implementación del Frontend para Visualización de Estado de Archivos

## 1. Estructura de Componentes

### Componentes a Desarrollar

1. **PuzzleVisualizationComponent**
   - Componente principal que muestra el gráfico tipo rompecabezas.
   - Integra D3.js para renderizar el gráfico.
   - Gestiona las opciones de visualización y filtros.

2. **FileStatusDashboardComponent**
   - Contenedor para el PuzzleVisualizationComponent.
   - Incluye las opciones de filtrado y visualización.
   - Muestra estadísticas básicas sobre los archivos.

3. **StatusMetricsComponent**
   - Muestra métricas adicionales sobre el estado de archivos.
   - Incluye tarjetas de resumen con estadísticas clave.

4. **StatusHistoryComponent** (Opcional)
   - Muestra un historial de cambios de estado para seguimiento.
   - Presenta una línea de tiempo o tabla de actividad.

### Servicios

1. **FileStatusService**
   - Interfaz con las APIs de backend para obtener datos de estado.
   - Métodos para actualizar estados de archivos.
   - Funciones de transformación de datos para D3.js.

2. **StatusMetricsService**
   - Gestiona la obtención y procesamiento de métricas.
   - Funciones para calcular tendencias y agregados.

## 2. Endpoints de API Disponibles

### 2.1. Obtener estado agregado de archivos

**Endpoint:** `/api/files/status`  
**Método:** GET  
**Autenticación:** Requerida  
**Parámetros:**

- `groupBy` (string, opcional): Especifica cómo agrupar los datos
  - `folder` (predeterminado): Agrupa por carpeta
  - `date`: Agrupa por fecha de creación
  - `type`: Agrupa por tipo de archivo (extensión)

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "60d5ec7d8f3e5d1234567890",
      "total": 15,
      "pendiente": 5,
      "procesando": 3,
      "procesado": 6,
      "error": 1,
      "totalSize": 1542678,
      "folderId": "60d5ec7d8f3e5d1234567890",
      "folderName": "Contabilidad"
    }
  ],
  "meta": {
    "groupBy": "folder"
  }
}
```

### 2.2. Obtener métricas para visualización

**Endpoint:** `/api/files/metrics`  
**Método:** GET  
**Autenticación:** Requerida  
**Parámetros:**

- `timeFrame` (string, opcional): Rango temporal para los datos
  - `week` (predeterminado): Últimos 7 días
  - `month`: Último mes
  - `all`: Todos los registros

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": {
    "puzzle": [
      {
        "id": "pendiente",
        "label": "pendiente",
        "value": 12,
        "color": "#e74c3c"
      },
      {
        "id": "procesando",
        "label": "procesando",
        "value": 5,
        "color": "#3498db"
      },
      {
        "id": "procesado",
        "label": "procesado",
        "value": 25,
        "color": "#2ecc71"
      },
      {
        "id": "error",
        "label": "error",
        "value": 2,
        "color": "#f39c12"
      }
    ],
    "statusCounts": [
      { "_id": "pendiente", "count": 12 },
      { "_id": "procesando", "count": 5 },
      { "_id": "procesado", "count": 25 },
      { "_id": "error", "count": 2 }
    ],
    "typeCounts": [
      { "_id": ".xlsx", "count": 35 },
      { "_id": ".xls", "count": 8 },
      { "_id": ".ods", "count": 1 }
    ],
    "sizeMetrics": {
      "totalSize": 58640283,
      "avgSize": 1329097.34,
      "minSize": 15264,
      "maxSize": 9548732,
      "count": 44
    },
    "uploadTrend": [
      { "_id": "2023-05-01", "count": 5, "totalSize": 5489732 },
      { "_id": "2023-05-02", "count": 7, "totalSize": 6847215 }
    ]
  },
  "meta": {
    "timeFrame": "week",
    "generatedAt": "2023-05-09T14:32:56.782Z"
  }
}
```

### 2.3. Actualizar estado de un archivo

**Endpoint:** `/api/files/:id/status`  
**Método:** PATCH  
**Autenticación:** Requerida  
**Parámetros URL:**
- `id`: ID del archivo a actualizar

**Cuerpo de la solicitud:**
```json
{
  "status": "procesado",
  "notes": "Procesamiento completado correctamente"
}
```

**Estados válidos:**
- `pendiente`: Archivo pendiente de procesamiento
- `procesando`: Archivo en proceso de análisis
- `procesado`: Archivo procesado completamente
- `error`: Error durante el procesamiento

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": {
    "_id": "60d5ec7d8f3e5d1234567890",
    "name": "Informe-Mensual.xlsx",
    "status": "procesado",
    "processingDetails": {
      "startDate": "2023-05-09T14:15:23.456Z",
      "endDate": "2023-05-09T14:32:45.789Z",
      "duration": 1042333,
      "processingNotes": "Procesamiento completado correctamente"
    }
  }
}
```

## 3. Integración con D3.js

### Instalación y Configuración

```bash
npm install d3 @types/d3 --save
```

### Módulo Dedicado para Visualizaciones

```typescript
// d3-visualizations.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PuzzleVisualizationComponent } from './puzzle-visualization/puzzle-visualization.component';

@NgModule({
  declarations: [
    PuzzleVisualizationComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    PuzzleVisualizationComponent
  ]
})
export class D3VisualizationsModule { }
```

## 4. Implementación de Componentes

### PuzzleVisualizationComponent

```typescript
// puzzle-visualization.component.ts
import { Component, OnInit, ViewChild, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import * as d3 from 'd3';

@Component({
  selector: 'app-puzzle-visualization',
  templateUrl: './puzzle-visualization.component.html',
  styleUrls: ['./puzzle-visualization.component.scss']
})
export class PuzzleVisualizationComponent implements OnInit, OnChanges {
  @ViewChild('puzzleContainer', { static: true }) private puzzleContainer: ElementRef;
  @Input() puzzleData: any[] = [];
  @Input() groupBy: 'folder' | 'date' | 'type' = 'folder';
  
  private svg: any;
  private width: number;
  private height: number;
  private margin = { top: 20, right: 20, bottom: 30, left: 40 };
  private tooltip: any;
  
  constructor() { }
  
  ngOnInit() {
    this.initializeSvg();
    this.createTooltip();
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if ((changes.puzzleData && !changes.puzzleData.firstChange) || 
        (changes.groupBy && !changes.groupBy.firstChange)) {
      this.updateVisualization();
    }
  }
  
  private initializeSvg(): void {
    // Configurar SVG con D3
    const element = this.puzzleContainer.nativeElement;
    this.width = element.offsetWidth - this.margin.left - this.margin.right;
    this.height = 400 - this.margin.top - this.margin.bottom;
    
    // Limpiar SVG existente si hay
    d3.select(element).select('svg').remove();
    
    this.svg = d3.select(element).append('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom)
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    
    // Renderizar visualización inicial
    this.updateVisualization();
  }
  
  private createTooltip(): void {
    this.tooltip = d3.select('body').append('div')
      .attr('class', 'puzzle-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background-color', 'white')
      .style('border', '1px solid #ddd')
      .style('border-radius', '3px')
      .style('padding', '8px')
      .style('pointer-events', 'none')
      .style('font-size', '12px')
      .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)');
  }
  
  private updateVisualization(): void {
    if (!this.puzzleData || this.puzzleData.length === 0) return;
    
    // Limpiar visualización anterior
    this.svg.selectAll('*').remove();
    
    // Implementar visualización usando D3 treemap para el rompecabezas
    const root = d3.hierarchy({ children: this.puzzleData })
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value);
    
    const treemapLayout = d3.treemap()
      .size([this.width, this.height])
      .padding(4);
    
    treemapLayout(root);
    
    // Dibujar rectángulos para cada pieza del rompecabezas
    this.svg.selectAll('rect')
      .data(root.leaves())
      .enter()
      .append('rect')
        .attr('x', d => d.x0)
        .attr('y', d => d.y0)
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0)
        .attr('fill', d => d.data.color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('rx', 4)
        .attr('ry', 4)
        .on('mouseover', (event, d) => {
          // Destacar elemento al pasar el mouse
          d3.select(event.currentTarget)
            .attr('stroke', '#333')
            .attr('stroke-width', 3);
            
          // Mostrar tooltip
          this.tooltip.transition()
            .duration(200)
            .style('opacity', 1);
            
          this.tooltip.html(`
            <strong>${d.data.label}</strong><br>
            Cantidad: ${d.data.value}
          `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', (event) => {
          // Restaurar estilo al quitar el mouse
          d3.select(event.currentTarget)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
            
          // Ocultar tooltip
          this.tooltip.transition()
            .duration(500)
            .style('opacity', 0);
        });
    
    // Añadir etiquetas
    this.svg.selectAll('text')
      .data(root.leaves())
      .enter()
      .append('text')
        .attr('x', d => d.x0 + 5)
        .attr('y', d => d.y0 + 15)
        .text(d => d.data.label + ': ' + d.data.value)
        .attr('font-size', '12px')
        .attr('fill', 'white');
  }
}
```

```html
<!-- puzzle-visualization.component.html -->
<div #puzzleContainer class="puzzle-container"></div>
```

```scss
/* puzzle-visualization.component.scss */
.puzzle-container {
  width: 100%;
  height: 400px;
  border: 1px solid #eaeaea;
  border-radius: 4px;
  overflow: hidden;
}
```

### FileStatusService

```typescript
// file-status.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface FileStatus {
  _id: string;
  name: string;
  status: 'pendiente' | 'procesando' | 'procesado' | 'error';
  processingDetails?: {
    startDate?: Date;
    endDate?: Date;
    duration?: number;
    errorMessage?: string;
    processingNotes?: string;
  };
}

export interface StatusData {
  _id: string;
  total: number;
  pendiente: number;
  procesando: number;
  procesado: number;
  error: number;
  totalSize: number;
  folderId?: string;
  folderName?: string;
  date?: string;
  formattedDate?: string;
  extension?: string;
  fileType?: string;
}

export interface PuzzlePiece {
  id: string;
  label: string;
  value: number;
  color: string;
}

@Injectable({
  providedIn: 'root'
})
export class FileStatusService {
  private apiUrl = `${environment.apiBaseUrl}/api/files`;

  constructor(private http: HttpClient) { }

  /**
   * Obtiene el estado agregado de los archivos
   */
  getFileStatus(groupBy: string = 'folder'): Observable<StatusData[]> {
    const params = new HttpParams().set('groupBy', groupBy);
    return this.http.get<any>(`${this.apiUrl}/status`, { params })
      .pipe(
        map(response => response.data as StatusData[])
      );
  }

  /**
   * Obtiene métricas para la visualización
   */
  getFileMetrics(timeFrame: string = 'week'): Observable<any> {
    const params = new HttpParams().set('timeFrame', timeFrame);
    return this.http.get(`${this.apiUrl}/metrics`, { params });
  }

  /**
   * Actualiza el estado de un archivo
   */
  updateFileStatus(fileId: string, status: string, notes?: string): Observable<FileStatus> {
    return this.http.patch<any>(`${this.apiUrl}/${fileId}/status`, { status, notes })
      .pipe(
        map(response => response.data as FileStatus)
      );
  }

  /**
   * Prepara datos para la visualización en formato D3
   */
  preparePuzzleData(metrics: any): PuzzlePiece[] {
    if (!metrics || !metrics.data || !metrics.data.puzzle) {
      return [];
    }
    return metrics.data.puzzle;
  }
}
```

## 5. Uso de Servicios desde Componentes

```typescript
// file-status-dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { FileStatusService, PuzzlePiece, StatusData } from '../../services/file-status.service';

@Component({
  selector: 'app-file-status-dashboard',
  templateUrl: './file-status-dashboard.component.html',
  styleUrls: ['./file-status-dashboard.component.scss']
})
export class FileStatusDashboardComponent implements OnInit {
  puzzleData: PuzzlePiece[] = [];
  statusData: StatusData[] = [];
  loading = false;
  error: string | null = null;
  
  groupByControl = new FormControl('folder');
  timeFrameControl = new FormControl('week');
  
  constructor(private fileStatusService: FileStatusService) { }
  
  ngOnInit(): void {
    this.loadData();
    
    // Recargar datos cuando cambian los controles
    this.groupByControl.valueChanges.subscribe(() => this.loadData());
    this.timeFrameControl.valueChanges.subscribe(() => this.loadData());
  }
  
  loadData(): void {
    this.loading = true;
    this.error = null;
    
    // Cargar datos de estado
    this.fileStatusService.getFileStatus(this.groupByControl.value)
      .subscribe(
        data => {
          this.statusData = data;
          this.loading = false;
        },
        error => {
          this.error = 'Error al cargar datos de estado';
          console.error('Error cargando estado:', error);
          this.loading = false;
        }
      );
    
    // Cargar métricas para la visualización
    this.fileStatusService.getFileMetrics(this.timeFrameControl.value)
      .subscribe(
        response => {
          this.puzzleData = this.fileStatusService.preparePuzzleData(response);
        },
        error => {
          console.error('Error cargando métricas:', error);
        }
      );
  }
}
```

```html
<!-- file-status-dashboard.component.html -->
<div class="dashboard-container">
  <h2>Visualización del Estado de Archivos</h2>
  
  <div class="filter-controls">
    <mat-form-field appearance="outline">
      <mat-label>Agrupar por</mat-label>
      <mat-select [formControl]="groupByControl">
        <mat-option value="folder">Carpeta</mat-option>
        <mat-option value="date">Fecha</mat-option>
        <mat-option value="type">Tipo</mat-option>
      </mat-select>
    </mat-form-field>
    
    <mat-form-field appearance="outline">
      <mat-label>Periodo</mat-label>
      <mat-select [formControl]="timeFrameControl">
        <mat-option value="week">Última semana</mat-option>
        <mat-option value="month">Último mes</mat-option>
        <mat-option value="all">Todo</mat-option>
      </mat-select>
    </mat-form-field>
  </div>
  
  <div class="visualization-container">
    <mat-card>
      <mat-card-title>Estado de Archivos (Rompecabezas)</mat-card-title>
      <mat-card-content>
        <app-puzzle-visualization 
          [puzzleData]="puzzleData" 
          [groupBy]="groupByControl.value">
        </app-puzzle-visualization>
      </mat-card-content>
    </mat-card>
  </div>
  
  <div class="metrics-container">
    <app-status-metrics [statusData]="statusData"></app-status-metrics>
  </div>
</div>
```

## 6. Configuración de Servicios en el Módulo Principal

```typescript
// app.module.ts (fragmento)
@NgModule({
  // ...
  imports: [
    // ...
    HttpClientModule,
    FileStatusModule
  ],
  providers: [
    // ...
    FileStatusService
  ],
  // ...
})
```

## 7. Estilos y Temas

Definir un conjunto de variables SCSS para mantener consistencia en los estilos:

```scss
// _file-status-theme.scss
@mixin file-status-theme($theme) {
  $primary: map-get($theme, primary);
  $accent: map-get($theme, accent);
  $warn: map-get($theme, warn);
  $background: map-get($theme, background);
  $foreground: map-get($theme, foreground);

  .puzzle-container {
    background-color: mat-color($background, card);
  }
  
  // Status colors
  .status-procesado {
    background-color: #2ecc71;
    color: white;
  }
  
  .status-procesando {
    background-color: #3498db;
    color: white;
  }
  
  .status-pendiente {
    background-color: #e74c3c;
    color: white;
  }
  
  .status-error {
    background-color: #f39c12;
    color: white;
  }
}
```

## 8. Secuencia de Implementación

1. **Configuración inicial**:
   - Instalar dependencias (D3.js)
   - Crear módulos y estructura del proyecto

2. **Servicios**:
   - Implementar FileStatusService
   - Configurar llamadas a API
   - Crear funciones de transformación de datos

3. **Componentes de visualización**:
   - Desarrollar PuzzleVisualizationComponent con D3.js
   - Implementar lógica de interacción y renderizado

4. **Componentes de gestión**:
   - Crear FileStatusDashboardComponent
   - Implementar controles de filtrado
   - Conectar con servicios

5. **Refinamiento e integración**:
   - Mejorar la estética y experiencia de usuario
   - Optimizar rendimiento
   - Añadir animaciones y transiciones

## 9. Estimación de Tiempo

| Tarea | Tiempo estimado |
|-------|-----------------|
| Configuración inicial | 0.5 días |
| Implementación de servicios | 1 día |
| Componente de visualización D3 | 2 días |
| Componentes de gestión | 1 día |
| Integración y refinamiento | 1.5 días |
| Pruebas | 1 día |
| **Total** | **7 días** |

## 10. Pruebas

- **Pruebas unitarias** para servicios y lógica de componentes
- **Pruebas de integración** para verificar la correcta interacción con el backend
- **Pruebas de visualización** para asegurar que los gráficos se renderizan correctamente
- **Pruebas de rendimiento** con conjuntos de datos grandes

## 11. Resumen de Endpoints

Para facilitar la implementación del frontend, aquí tienes un resumen de los endpoints disponibles:

| Endpoint | Método | Propósito |
|----------|--------|-----------|
| `/api/files/status?groupBy=folder` | GET | Obtener estado agrupado por carpeta |
| `/api/files/status?groupBy=date` | GET | Obtener estado agrupado por fecha |
| `/api/files/status?groupBy=type` | GET | Obtener estado agrupado por tipo de archivo |
| `/api/files/metrics?timeFrame=week` | GET | Obtener métricas de última semana |
| `/api/files/metrics?timeFrame=month` | GET | Obtener métricas del último mes |
| `/api/files/metrics?timeFrame=all` | GET | Obtener métricas de todo el periodo |
| `/api/files/:id/status` | PATCH | Actualizar estado de un archivo específico |

---

## Notas Adicionales

- La visualización se puede mejorar con animaciones y transiciones suaves entre estados
- Considerar agregar un modo de "seguimiento en tiempo real" para actualizaciones automáticas
- Explorar opciones para exportar visualizaciones como imágenes o PDFs 