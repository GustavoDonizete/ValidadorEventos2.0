import { Component, Output, EventEmitter } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [NgClass],
  template: `
    <div
      class="upload-zone"
      [class.drag]="isDragging"
      (dragover)="onDragOver($event)"
      (dragleave)="isDragging = false"
      (drop)="onDrop($event)"
      (click)="fileInput.click()">
      <input
        #fileInput
        type="file"
        accept=".csv,.xlsx,.xls,.tsv,.ods"
        style="display:none"
        (change)="onFileSelected($event)"
      />
      <span class="upload-icon">📂</span>
      <h2>Arraste sua base de logs aqui</h2>
      <p>ou clique para selecionar o arquivo</p>
      <button class="btn" (click)="$event.stopPropagation(); fileInput.click()">
        Selecionar arquivo
      </button>
      <div class="upload-formats">
        CSV · XLSX · XLS · TSV · ODS — UTF-8, UTF-16, ANSI/CP1252, Latin-1
      </div>
    </div>
  `,
  styles: [`
    .upload-zone {
      border: 2px dashed var(--orange-border);
      border-radius: 16px; padding: 64px 40px;
      text-align: center; cursor: pointer;
      transition: all 0.25s;
      background: rgba(236,112,0,0.02);
    }
    .upload-zone:hover, .upload-zone.drag {
      border-color: rgba(236,112,0,0.65);
      background: rgba(236,112,0,0.06);
    }
    .upload-zone h2 {
      font-family: 'Playfair Display', serif;
      font-size: 22px; font-weight: 400; margin-bottom: 8px;
    }
    .upload-zone p { font-size: 14px; color: var(--text-mid); margin-bottom: 24px; }
    .upload-icon { font-size: 52px; margin-bottom: 20px; display: block; }
    .upload-formats {
      margin-top: 16px; font-size: 11px; color: var(--text-dim);
      letter-spacing: 0.08em; text-transform: uppercase;
    }
  `]
})
export class UploadComponent {
  @Output() fileSelected = new EventEmitter<File>();
  isDragging = false;

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragging = true; }
  onDrop(e: DragEvent) {
    e.preventDefault(); this.isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.fileSelected.emit(file);
  }
  onFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.fileSelected.emit(file);
  }
}
