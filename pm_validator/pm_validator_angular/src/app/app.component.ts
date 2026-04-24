import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalysisService } from './services/analysis.service';
import {
  AnalysisResult, ColumnMapping, FileData,
  PILLAR_ORDER, PILLAR_WEIGHTS, COLUMN_TYPES, UNIQUE_TYPES
} from './models';
import { HeaderComponent }    from './components/header/header.component';
import { StepsComponent }     from './components/steps/steps.component';
import { ServerBarComponent } from './components/server-bar/server-bar.component';
import { UploadComponent }    from './components/upload/upload.component';
import { MappingComponent }   from './components/mapping/mapping.component';
import { LoadingComponent }   from './components/loading/loading.component';
import { ResultComponent }    from './components/result/result.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    HeaderComponent, StepsComponent, ServerBarComponent,
    UploadComponent, MappingComponent, LoadingComponent, ResultComponent,
  ],
  template: `
    <div class="wrap">
      <app-header />

      <app-steps [currentStep]="currentStep()" />

      <app-server-bar
        [statusClass]="serverStatusClass()"
        [statusText]="svc.serverText()"
        (check)="svc.checkServer(true)"
      />

      <app-upload
        *ngIf="currentStep() === 1"
        (fileSelected)="onFileSelected($event)"
      />

      <app-mapping
        *ngIf="currentStep() === 2"
        [fileData]="fileData()!"
        [mappings]="mappings"
        [delimiter]="delimiter"
        [dayfirst]="dayfirst"
        [duplicates]="duplicates()"
        [canAnalyze]="canAnalyze()"
        [isAnalyzing]="isAnalyzing()"
        [errorMsg]="errorMsg()"
        (analyze)="analyze()"
        (reset)="reset()"
        (delimiterChange)="delimiter = $event"
        (dayfirstChange)="dayfirst = $event"
      />

      <app-loading
        *ngIf="isLoading()"
        [step]="loadingStep()"
      />

      <app-result
        *ngIf="result()"
        [result]="result()!"
        (goToMapping)="goToMapping()"
        (reset)="reset()"
      />
    </div>
  `,
  styles: [`
    .wrap {
      position: relative; z-index: 1;
      max-width: 1080px; margin: 0 auto;
      padding: 0 32px 100px;
    }
  `]
})
export class AppComponent implements OnInit {
  currentStep  = signal(1);
  fileData     = signal<FileData | null>(null);
  mappings: ColumnMapping[] = [];
  delimiter    = ',';
  dayfirst     = true;
  isLoading    = signal(false);
  isAnalyzing  = signal(false);
  loadingStep  = signal(0);
  errorMsg     = signal('');
  result       = signal<AnalysisResult | null>(null);

  private _rawFile: File | null = null;
  private _loadingTimer: any    = null;

  duplicates = computed(() => this.svc.getDuplicateTypes(this.mappings));

  canAnalyze = computed(() => {
    const types = this.mappings.map(m => m.type);
    return (
      types.includes('Case_ID') &&
      types.includes('Atividade') &&
      types.includes('Timestamp_Inicio') &&
      this.duplicates().length === 0
    );
  });

  serverStatusClass = computed(() => `status-badge status-${this.svc.serverStatus()}`);

  constructor(public svc: AnalysisService) {}

  ngOnInit() { this.svc.checkServer(false); }

  async onFileSelected(file: File) {
    this._rawFile = file;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isSpreadsheet = ['xlsx', 'xls', 'ods'].includes(ext);
    try {
      if (isSpreadsheet) {
        const fd = await this.svc.readFileSheetJS(file);
        this.fileData.set(fd);
      } else {
        try {
          const fd = await this.svc.fetchColumns(file, this.delimiter);
          if (fd.delimiterDetected) this.delimiter = fd.delimiterDetected;
          this.fileData.set(fd);
        } catch {
          const fd = await this.svc.readFileSheetJS(file, true);
          this.fileData.set(fd);
        }
      }
      this.mappings = this.svc.buildMappings(this.fileData()!.headers);
      this.currentStep.set(2);
    } catch (err: any) {
      this.errorMsg.set(err.message);
    }
  }

  async analyze() {
    if (!this.canAnalyze() || this.isAnalyzing()) return;
    this.errorMsg.set('');
    this.result.set(null);
    this.isLoading.set(true);
    this.isAnalyzing.set(true);
    this.currentStep.set(3);
    this.startLoadingAnim();
    try {
      const data = await this.svc.analyze(
        this._rawFile!,
        this.mappings,
        this.delimiter,
        this.dayfirst,
      );
      this.result.set(data);
    } catch (err: any) {
      this.currentStep.set(2);
      this.errorMsg.set(
        err.name === 'AbortError'
          ? 'Tempo limite excedido (5 min).'
          : 'Erro ao conectar: ' + err.message + '. Verifique se o motor está rodando.'
      );
    } finally {
      this.stopLoadingAnim();
      this.isLoading.set(false);
      this.isAnalyzing.set(false);
    }
  }

  startLoadingAnim() {
    this.loadingStep.set(0);
    this._loadingTimer = setInterval(() => {
      this.loadingStep.update(s => Math.min(s + 1, 4));
    }, 1800);
  }

  stopLoadingAnim() {
    if (this._loadingTimer) { clearInterval(this._loadingTimer); this._loadingTimer = null; }
    this.loadingStep.set(5);
  }

  goToMapping() { this.currentStep.set(2); this.result.set(null); }

  reset() {
    this.currentStep.set(1);
    this.fileData.set(null);
    this.result.set(null);
    this.mappings = [];
    this.errorMsg.set('');
    this._rawFile = null;
  }
}
