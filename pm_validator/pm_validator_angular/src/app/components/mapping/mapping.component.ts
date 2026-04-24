import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileData, ColumnMapping, COLUMN_TYPES, UNIQUE_TYPES } from '../../models';

@Component({
  selector: 'app-mapping',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- File info -->
    <div class="file-info">
      <div class="file-info-left">
        <span class="file-icon">📊</span>
        <div>
          <div class="file-name">{{ fileData.name }}</div>
          <div class="file-meta">
            {{ fileData.totalRows.toLocaleString('pt-BR') }} linhas ·
            {{ fileData.headers.length }} colunas ·
            {{ (fileData.size / 1024).toFixed(1) }} KB
          </div>
        </div>
      </div>
      <div class="file-actions">
        <span *ngIf="fileData.encodingUsed" class="enc-badge" [class.warn]="isEncWarn">
          🔤 {{ fileData.encodingUsed }}
        </span>
        <button class="btn-ghost" (click)="reset.emit()">← Trocar arquivo</button>
      </div>
    </div>

    <!-- Config -->
    <div class="config-row">
      <div class="config-item">
        <label>Separador CSV:</label>
        <select class="cfg-select" [(ngModel)]="delimiter" (ngModelChange)="delimiterChange.emit($event)">
          <option value=",">, (vírgula)</option>
          <option value=";">; (ponto-vírgula)</option>
          <option value="&#9;">↹ (tab)</option>
          <option value="|">| (pipe)</option>
        </select>
      </div>
      <div class="config-item">
        <input type="checkbox" id="dayfirst" [(ngModel)]="dayfirst" (ngModelChange)="dayfirstChange.emit($event)"/>
        <label for="dayfirst">Datas no formato DD/MM/AAAA</label>
      </div>
    </div>

    <!-- Prereqs -->
    <div class="prereq-row">
      <span class="tag" [class.ok]="hasCaseId" [class.miss]="!hasCaseId">
        {{ hasCaseId ? '✓' : '✗' }} Case_ID
      </span>
      <span class="tag" [class.ok]="hasAtividade" [class.miss]="!hasAtividade">
        {{ hasAtividade ? '✓' : '✗' }} Atividade
      </span>
      <span class="tag" [class.ok]="hasTimestamp" [class.miss]="!hasTimestamp">
        {{ hasTimestamp ? '✓' : '✗' }} Timestamp
      </span>
    </div>

    <!-- Duplicates warning -->
    <div *ngIf="duplicates.length > 0" class="dup-warning">
      ⚠ Referência duplicada:
      <strong *ngFor="let d of duplicates">{{ d }} </strong>
      — cada tipo só pode ser mapeado para uma coluna.
    </div>

    <!-- Mapping table -->
    <div class="section-title">Mapeamento de colunas</div>
    <div class="section-sub">
      Identifique o tipo de cada coluna. O motor Python usará estas referências independente do nome original.
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:30%">Coluna da base</th>
            <th style="width:26%">Tipo / Referência</th>
            <th>Descrição (opcional)</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let col of mappings">
            <td><span class="col-name" [title]="col.name">{{ col.name }}</span></td>
            <td>
              <select
                class="col-select"
                [(ngModel)]="col.type"
                [class.dup-error]="isDuplicate(col.type)"
                (ngModelChange)="onMappingChange()">
                <option *ngFor="let t of COLUMN_TYPES" [value]="t">{{ t }}</option>
              </select>
            </td>
            <td>
              <input class="col-input" [(ngModel)]="col.description" placeholder="Descreva esta coluna..."/>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button
      class="btn-analyze"
      (click)="analyze.emit()"
      [disabled]="!canAnalyze || isAnalyzing">
      ⚙ Analisar base de dados
    </button>

    <div *ngIf="errorMsg" class="error-msg">⚠ {{ errorMsg }}</div>
  `,
  styles: [`
    .file-info {
      display: flex; align-items: center; justify-content: space-between;
      background: var(--orange-dim); border: 1px solid var(--orange-border);
      border-radius: 10px; padding: 14px 20px; margin-bottom: 20px;
      gap: 12px; flex-wrap: wrap;
    }
    .file-info-left { display: flex; align-items: center; gap: 12px; }
    .file-icon { font-size: 26px; }
    .file-name { font-weight: 600; font-size: 15px; color: var(--orange); }
    .file-meta { font-size: 12px; color: var(--text-mid); margin-top: 2px; }
    .file-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .prereq-row { display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; align-items: center; }
    .config-row { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .config-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-mid); }
    .config-item label { font-size: 12px; white-space: nowrap; }
    .config-item input[type="checkbox"] { width: auto; accent-color: var(--orange); }
    .cfg-select {
      background: var(--surface3); border: 1px solid var(--border2);
      color: var(--text); padding: 6px 30px 6px 10px; border-radius: 6px;
      font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none;
      appearance: none; min-width: 80px; cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%23EC7000' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 8px center;
    }
    .dup-warning {
      display: flex; align-items: center; gap: 8px;
      background: var(--red-bg); border: 1px solid var(--red-border);
      border-radius: 6px; padding: 8px 14px; margin-bottom: 16px;
      font-size: 12px; color: var(--red);
    }
    .section-title {
      font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 400; margin-bottom: 6px;
    }
    .section-sub { font-size: 13px; color: var(--text-mid); margin-bottom: 20px; line-height: 1.6; }
    .table-wrap { border-radius: 12px; overflow: hidden; border: 1px solid var(--border); margin-bottom: 28px; }
    table { width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.015); }
    th {
      background: var(--orange-dim); padding: 13px 18px; text-align: left;
      font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase;
      color: var(--orange); font-weight: 600; border-bottom: 1px solid var(--orange-border);
    }
    td { padding: 12px 18px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: rgba(255,255,255,0.012); }
    .col-name {
      font-family: 'DM Mono', monospace; font-size: 12px; color: var(--text);
      background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 4px;
      display: inline-block; max-width: 200px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .col-select, .col-input {
      width: 100%; background: var(--surface3); border: 1px solid var(--border2);
      color: var(--text); padding: 8px 12px; border-radius: 6px;
      font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none;
    }
    .col-select {
      appearance: none; padding-right: 34px; cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%23EC7000' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 12px center;
      background-color: var(--surface3);
    }
    .dup-error { border-color: var(--red) !important; background: rgba(192,57,43,0.12) !important; }
    .btn-analyze {
      width: 100%;
      background: linear-gradient(135deg, var(--orange) 0%, var(--orange-light) 100%);
      color: #fff; border: none; padding: 18px; border-radius: 12px;
      font-size: 15px; font-weight: 700; cursor: pointer;
      letter-spacing: 0.1em; text-transform: uppercase;
      font-family: 'DM Sans', sans-serif; transition: all 0.3s;
      box-shadow: 0 8px 32px rgba(236,112,0,0.28); margin-bottom: 20px;
      &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 44px rgba(236,112,0,0.42); }
      &:disabled { opacity: 0.35; cursor: not-allowed; transform: none; box-shadow: none; }
    }
    .error-msg {
      background: var(--red-bg); border: 1px solid var(--red-border);
      color: #e74c3c; padding: 14px 18px; border-radius: 10px; font-size: 14px;
    }
  `]
})
export class MappingComponent {
  @Input() fileData!: FileData;
  @Input() mappings: ColumnMapping[] = [];
  @Input() delimiter = ',';
  @Input() dayfirst  = true;
  @Input() duplicates: string[] = [];
  @Input() canAnalyze = false;
  @Input() isAnalyzing = false;
  @Input() errorMsg = '';

  @Output() mappingsChange   = new EventEmitter<ColumnMapping[]>();
  @Output() delimiterChange  = new EventEmitter<string>();
  @Output() dayfirstChange   = new EventEmitter<boolean>();
  @Output() analyze = new EventEmitter<void>();
  @Output() reset   = new EventEmitter<void>();

  COLUMN_TYPES = COLUMN_TYPES;

  get isEncWarn(): boolean {
    return !!this.fileData?.encodingUsed?.includes('desconhecido') ||
           !!this.fileData?.encodingUsed?.includes('latin');
  }

  get hasCaseId():    boolean { return this.mappings.some(m => m.type === 'Case_ID'); }
  get hasAtividade(): boolean { return this.mappings.some(m => m.type === 'Atividade'); }
  get hasTimestamp(): boolean { return this.mappings.some(m => m.type === 'Timestamp_Inicio'); }

  isDuplicate(type: string): boolean {
    return UNIQUE_TYPES.includes(type) && this.duplicates.includes(type);
  }

  onMappingChange() { this.mappingsChange.emit(this.mappings); }
}
