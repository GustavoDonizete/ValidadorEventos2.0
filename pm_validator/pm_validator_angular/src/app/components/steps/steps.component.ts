import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-steps',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="steps">
      <div class="step" [class.active]="currentStep === 1">
        <div class="step-n">1</div> Enviar base
      </div>
      <div class="step" [class.active]="currentStep === 2">
        <div class="step-n">2</div> Mapear colunas
      </div>
      <div class="step" [class.active]="currentStep === 3">
        <div class="step-n">3</div> Rating & diagnóstico
      </div>
    </div>
    <section class="hero" *ngIf="currentStep === 1">
      <h1>Valide sua base de logs<br>para <em>Process Mining</em></h1>
      <p>Envie sua base de dados, mapeie as colunas e receba um diagnóstico completo sobre a aptidão para Process Mining — calculado por 6 pilares de qualidade.</p>
    </section>
  `,
  styles: [`
    .steps {
      display: flex; gap: 10px; margin-bottom: 40px; flex-wrap: wrap;
    }
    .step {
      display: flex; align-items: center; gap: 10px;
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border);
      border-radius: 8px; padding: 10px 16px;
      font-size: 12px; color: var(--text-mid);
      letter-spacing: 0.04em; transition: all 0.2s;
    }
    .step.active {
      border-color: var(--orange-border);
      background: var(--orange-dim);
      color: var(--text);
    }
    .step-n {
      width: 20px; height: 20px; border-radius: 50%;
      background: var(--orange-dim);
      border: 1px solid var(--orange-border);
      color: var(--orange);
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 600; flex-shrink: 0;
    }
    .step.active .step-n {
      background: var(--orange); border-color: var(--orange); color: #fff;
    }
    .hero { margin-bottom: 44px; }
    .hero h1 {
      font-family: 'Playfair Display', serif;
      font-size: 48px; font-weight: 400; line-height: 1.12; margin-bottom: 14px;
    }
    .hero h1 em { color: var(--orange); font-style: italic; }
    .hero p {
      font-size: 15px; color: var(--text-mid);
      line-height: 1.7; max-width: 520px; font-weight: 300;
    }
  `]
})
export class StepsComponent {
  @Input() currentStep = 1;
}
