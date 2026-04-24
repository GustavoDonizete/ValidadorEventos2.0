import { Component, Input, Output, EventEmitter, signal, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-server-bar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="server-bar">
      <label>Servidor Python:</label>
      <input class="server-input" [(ngModel)]="serverUrl" placeholder="http://localhost:5000"/>
      <button class="btn-sm" (click)="check.emit()">Verificar</button>
      <span [class]="statusClass">{{ statusText }}</span>
      <span class="hint">
        Execute: <code>python pm_engine_v2.py --serve</code>
      </span>
    </div>
  `,
  styles: [`
    .server-bar {
      display: flex; align-items: center; gap: 12px;
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border2);
      border-radius: 10px; padding: 12px 18px;
      margin-bottom: 28px; flex-wrap: wrap;
    }
    label { font-size: 12px; color: var(--text-mid); }
    .server-input {
      background: var(--surface3); border: 1px solid var(--border2);
      color: var(--text); padding: 6px 12px; border-radius: 6px;
      font-size: 13px; font-family: 'DM Sans', sans-serif;
      outline: none; width: 200px;
    }
    .hint {
      font-size: 11px; color: var(--text-dim); margin-left: auto;
      code {
        background: rgba(255,255,255,0.06);
        padding: 2px 6px; border-radius: 4px;
      }
    }
    .status-badge { font-size: 11px; padding: 4px 10px; border-radius: 4px; border: 1px solid; }
    .status-ok       { color: var(--green);    background: var(--green-bg);            border-color: var(--green-border); }
    .status-err      { color: var(--red);      background: var(--red-bg);              border-color: var(--red-border); }
    .status-checking { color: var(--text-mid); background: rgba(255,255,255,0.04);     border-color: var(--border); }
  `]
})
export class ServerBarComponent {
  @Input()  serverUrl  = model('http://localhost:5000');
  @Input()  statusClass = 'status-badge status-checking';
  @Input()  statusText  = '— verificando...';
  @Output() check = new EventEmitter<void>();
}
