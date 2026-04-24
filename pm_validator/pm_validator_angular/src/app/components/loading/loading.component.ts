import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="loading">
      <div class="spinner"></div>
      <h3>Motor Python analisando...</h3>
      <p>Executando os 6 pilares de validação</p>
      <div class="loading-steps">
        <div *ngFor="let s of steps; let i = index"
          class="ls-item"
          [class.active]="step === i"
          [class.done]="step > i">
          {{ s }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .loading {
      text-align: center; padding: 60px 40px;
      background: rgba(236,112,0,0.03);
      border: 1px solid var(--orange-border); border-radius: 16px;
    }
    .spinner {
      width: 48px; height: 48px;
      border: 3px solid rgba(236,112,0,0.18);
      border-top: 3px solid var(--orange);
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
      margin: 0 auto 20px;
    }
    h3 { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 400; margin-bottom: 8px; }
    p  { font-size: 13px; color: var(--text-mid); }
    .loading-steps {
      margin-top: 20px; display: flex; flex-direction: column; gap: 6px;
      text-align: left; max-width: 320px; margin-left: auto; margin-right: auto;
    }
    .ls-item { font-size: 12px; color: var(--text-dim); padding: 4px 0; transition: color 0.3s; }
    .ls-item.active { color: var(--orange); }
    .ls-item.done   { color: var(--green); }
  `]
})
export class LoadingComponent {
  @Input() step = 0;

  steps = [
    '↗ Enviando arquivo ao servidor',
    '🔍 Detectando encoding e lendo dados',
    '⚙ Calculando Pilares 1–3',
    '⚙ Calculando Pilares 4–6',
    '📊 Compilando resultado final',
  ];
}
