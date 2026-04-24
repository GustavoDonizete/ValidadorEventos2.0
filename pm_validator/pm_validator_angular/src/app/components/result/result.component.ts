import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalysisResult, PillarBreakdown, PILLAR_ORDER, PILLAR_WEIGHTS, scoreColor, isConsultivo } from '../../models';

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="result-card">

      <!-- Header -->
      <div class="result-header">
        <div class="rating-info">
          <div class="rating-label" [style.color]="result.final.color">{{ result.final.label }}</div>
          <div class="rating-summary">{{ result.final.summary }}</div>
        </div>
        <div class="donut-section">
          <div class="donut-label">Score Final</div>
          <div class="donut-wrap">
            <svg width="120" height="120" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10"/>
              <circle
                cx="55" cy="55" r="46" fill="none" stroke-width="10" stroke-linecap="round"
                [attr.stroke]="result.final.color"
                [attr.stroke-dasharray]="'289 289'"
                [attr.stroke-dashoffset]="donutOffset"
                transform="rotate(-90 55 55)"
                style="transition: stroke-dashoffset 1.3s cubic-bezier(0.4,0,0.2,1)"
              />
            </svg>
            <div class="donut-center">
              <span class="donut-score" [style.color]="result.final.color">{{ result.final.final_score }}</span>
              <span class="donut-sub">/ 100</span>
            </div>
          </div>
          <div class="donut-caption">todos os pilares</div>
        </div>
      </div>

      <!-- Meta bar -->
      <div class="result-meta">
        <div class="meta-item">📄 <strong>{{ result.input_file }}</strong></div>
        <div class="meta-item">🔢 <strong>{{ result.n_rows?.toLocaleString('pt-BR') }}</strong> linhas</div>
        <div class="meta-item">👤 <strong>{{ result.n_cases?.toLocaleString('pt-BR') }}</strong> cases</div>
        <div class="meta-item">📅 <strong>{{ result.periodo_dias }}</strong> dias</div>
        <div class="meta-item">⚡ <strong>{{ result.tempo_minutos }}</strong> min</div>
        <div class="meta-item" *ngIf="result.ts_format_inferred?.formato">
          🗓 <span class="meta-mono">{{ result.ts_format_inferred?.formato }}</span>
        </div>
        <div class="meta-item" *ngIf="result.veredicto">
          <span class="meta-badge" [ngClass]="result.veredicto === 'APTA' ? 'ok' : 'err'">
            {{ result.veredicto === 'APTA' ? '✓ APTA' : '✗ NÃO APTA' }} (P1+P2)
          </span>
        </div>
        <div class="meta-item" *ngIf="result.risco_consultivo">
          <span class="meta-badge"
            [ngClass]="result.risco_consultivo==='BAIXO'?'ok':result.risco_consultivo==='MEDIO'?'warn':'err'">
            Risco {{ result.risco_consultivo }}
          </span>
        </div>
      </div>

      <!-- Ranking foco -->
      <div class="ranking-bar" *ngIf="rankingParts.length > 0">
        <span class="ranking-label">📍 Onde focar</span>
        <div class="ranking-pills">
          <ng-container *ngFor="let p of rankingParts; let i = index">
            <span *ngIf="i > 0" class="rank-arrow">›</span>
            <span class="rank-pill" [ngClass]="i===0?'r1':i===1?'r2':'rn'">{{ p }}</span>
          </ng-container>
        </div>
      </div>

      <!-- Frase resumo -->
      <div class="frase-resumo" *ngIf="result.final.frase_resumo">
        {{ result.final.frase_resumo }}
      </div>

      <!-- Pilares breakdown -->
      <div class="pillars-section">
        <div class="section-eyebrow">Detalhamento por pilar</div>
        <div class="pillars-grid">
          <div class="pillar-card" *ngFor="let pb of sortedBreakdown">
            <div class="pc-header">
              <div class="pc-name">{{ pb.pilar }}</div>
              <span class="pc-badge"
                [ngClass]="isConsultivo(pb.pilar_key) ? 'consultivo' : pb.status === 'APTO' ? 'apto' : 'inapto'">
                {{ isConsultivo(pb.pilar_key) ? 'CONSULTIVO' : pb.status }}
              </span>
            </div>
            <div class="pc-score-row">
              <div class="pc-score-num" [style.color]="scoreColor(pb.score)">{{ pb.score }}</div>
              <div class="bar-track">
                <div class="bar-fill" [style.width]="pb.score + '%'" [style.background]="scoreColor(pb.score)"></div>
              </div>
              <div class="pc-weight">peso {{ getWeight(pb.pilar_key) }}%</div>
            </div>
            <div class="pc-frase" *ngIf="pb.frase_diagnostico">{{ pb.frase_diagnostico }}</div>
            <div class="subcats-list">
              <div class="sc-row" *ngFor="let sd of pb.subcategorias">
                <div class="sc-dot" [ngClass]="sd.status.toLowerCase()"></div>
                <div class="sc-name" [title]="sd.subcategoria">{{ formatSubcat(sd.subcategoria) }}</div>
                <div class="sc-bar">
                  <div class="sc-bar-fill"
                    [style.width]="(sd.score_obtido / sd.score_max * 100) + '%'"
                    [style.background]="sd.status==='PASSOU'?'var(--green)':sd.status==='ZEROU'?'var(--red)':'var(--yellow)'">
                  </div>
                </div>
                <div class="sc-score">{{ sd.score_obtido }}/{{ sd.score_max }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Gates -->
      <div class="gates-section" *ngIf="result.final.gates_triggered?.length > 0">
        <div class="eyebrow red">⛔ Gates de reprovação acionados</div>
        <div class="gate-item" *ngFor="let g of result.final.gates_triggered">
          ⛔ <strong>{{ g.pilar }}:</strong>&nbsp;{{ g.gate }}
        </div>
      </div>

      <!-- Diagnósticos -->
      <div class="result-body">
        <div class="diag-group" *ngIf="criticos.length > 0">
          <div class="diag-group-title red">❌ Problemas críticos — score zerado</div>
          <div class="finding critico" *ngFor="let d of criticos">
            <span class="finding-icon">❌</span>
            <div class="finding-body">
              <div class="finding-pilar">{{ d.pilar }}</div>
              <div class="finding-title">{{ d.check }}</div>
              <div class="finding-meta">
                <span *ngIf="d.valor"     class="fv">encontrado: {{ d.valor }}</span>
                <span *ngIf="d.threshold" class="fv">limite: {{ d.threshold }}</span>
                <span *ngIf="d.impacto"   class="fi critico">{{ d.impacto }}</span>
              </div>
              <div class="finding-desc">{{ d.descricao }}</div>
            </div>
          </div>
        </div>

        <div class="diag-group" *ngIf="avisos.length > 0">
          <div class="diag-group-title yellow">⚠️ Avisos — score reduzido</div>
          <div class="finding alerta" *ngFor="let d of avisos">
            <span class="finding-icon">⚠️</span>
            <div class="finding-body">
              <div class="finding-pilar">{{ d.pilar }}</div>
              <div class="finding-title">{{ d.check }}</div>
              <div class="finding-meta">
                <span *ngIf="d.valor"     class="fv">encontrado: {{ d.valor }}</span>
                <span *ngIf="d.threshold" class="fv">limite: {{ d.threshold }}</span>
                <span *ngIf="d.impacto"   class="fi alerta">{{ d.impacto }}</span>
              </div>
              <div class="finding-desc">{{ d.descricao }}</div>
            </div>
          </div>
        </div>

        <div class="diag-group" *ngIf="criticos.length === 0 && avisos.length === 0">
          <div class="diag-group-title green">✅ Nenhum problema detectado</div>
          <div class="finding ok">
            <span class="finding-icon">✅</span>
            <span>Nenhum problema encontrado em todos os 6 pilares.</span>
          </div>
        </div>

        <div class="actions">
          <button class="btn-ghost" (click)="goToMapping.emit()">← Rever mapeamento</button>
          <button class="btn" (click)="reset.emit()">Nova análise</button>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .result-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 16px; overflow: hidden;
      animation: fadeIn 0.5s ease both;
    }
    .result-header {
      padding: 32px 36px; border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      gap: 24px; flex-wrap: wrap;
    }
    .rating-info { flex: 1; min-width: 200px; }
    .rating-label { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 400; margin-bottom: 8px; }
    .rating-summary { font-size: 14px; color: var(--text-mid); line-height: 1.6; max-width: 460px; }
    .donut-section { text-align: center; }
    .donut-label { font-size: 10px; color: var(--text-dim); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 8px; }
    .donut-wrap { position: relative; width: 120px; height: 120px; }
    .donut-wrap svg { display: block; }
    .donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .donut-score { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; line-height: 1; }
    .donut-sub { font-size: 10px; color: var(--text-mid); letter-spacing: 0.1em; margin-top: 2px; }
    .donut-caption { font-size: 11px; color: var(--text-dim); margin-top: 6px; }
    .result-meta {
      padding: 14px 36px; border-bottom: 1px solid var(--border);
      display: flex; gap: 12px; flex-wrap: wrap; align-items: center;
    }
    .meta-item { font-size: 12px; color: var(--text-dim); display: flex; align-items: center; gap: 5px; }
    .meta-item strong { color: var(--text-mid); }
    .ranking-bar {
      padding: 14px 36px; border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
      background: rgba(236,112,0,0.03);
    }
    .ranking-label { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); font-weight: 600; white-space: nowrap; }
    .ranking-pills { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .rank-pill { font-size: 11px; padding: 3px 10px; border-radius: 4px; font-weight: 600; border: 1px solid; }
    .rank-pill.r1 { background: var(--red-bg);    color: var(--red);    border-color: var(--red-border); }
    .rank-pill.r2 { background: var(--yellow-bg); color: var(--yellow); border-color: var(--yellow-border); }
    .rank-pill.rn { background: rgba(255,255,255,0.04); color: var(--text-mid); border-color: var(--border2); }
    .rank-arrow { color: var(--text-dim); font-size: 11px; padding: 0 2px; }
    .frase-resumo {
      padding: 12px 36px 14px; border-bottom: 1px solid var(--border);
      font-size: 12px; color: var(--text-mid); line-height: 1.6; font-style: italic;
    }
    .pillars-section { padding: 28px 36px; border-bottom: 1px solid var(--border); }
    .section-eyebrow { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--orange); font-weight: 600; margin-bottom: 18px; }
    .pillars-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
    .pillar-card { background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; transition: border-color 0.2s; }
    .pillar-card:hover { border-color: var(--border2); }
    .pc-header { padding: 14px 16px 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .pc-name { font-size: 12px; color: var(--text-mid); font-weight: 500; }
    .pc-badge { font-size: 9px; padding: 2px 8px; border-radius: 4px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
    .pc-badge.apto       { background: var(--green-bg);  color: var(--green);  border: 1px solid var(--green-border); }
    .pc-badge.inapto     { background: var(--red-bg);    color: var(--red);    border: 1px solid var(--red-border); }
    .pc-badge.consultivo { background: var(--orange-dim); color: var(--orange); border: 1px solid var(--orange-border); }
    .pc-score-row { padding: 0 16px 10px; display: flex; align-items: center; gap: 10px; }
    .pc-score-num { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; line-height: 1; min-width: 36px; }
    .pc-weight { font-size: 10px; color: var(--text-dim); white-space: nowrap; }
    .pc-frase { padding: 0 16px 8px; font-size: 11px; color: var(--text-mid); line-height: 1.5; font-style: italic; border-bottom: 1px solid var(--border); }
    .subcats-list { padding: 6px 0; }
    .sc-row { padding: 5px 16px; display: flex; align-items: center; gap: 8px; }
    .sc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .sc-dot.passou  { background: var(--green); }
    .sc-dot.reduziu { background: var(--yellow); }
    .sc-dot.zerou   { background: var(--red); }
    .sc-name { font-size: 11px; color: var(--text-mid); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sc-bar { width: 56px; height: 3px; background: rgba(255,255,255,0.07); border-radius: 2px; overflow: hidden; flex-shrink: 0; }
    .sc-bar-fill { height: 100%; border-radius: 2px; transition: width 1.2s cubic-bezier(0.4,0,0.2,1); }
    .sc-score { font-size: 10px; color: var(--text-dim); font-family: 'DM Mono', monospace; white-space: nowrap; min-width: 46px; text-align: right; }
    .gates-section { padding: 20px 36px; border-bottom: 1px solid var(--border); background: rgba(192,57,43,0.04); }
    .eyebrow { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; margin-bottom: 14px; }
    .eyebrow.red { color: var(--red); }
    .gate-item { display: flex; gap: 10px; align-items: flex-start; padding: 10px 14px; background: var(--red-bg); border: 1px solid var(--red-border); border-radius: 8px; margin-bottom: 8px; font-size: 13px; }
    .result-body { padding: 28px 36px; }
    .diag-group { margin-bottom: 22px; }
    .diag-group-title { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 600; margin-bottom: 12px; }
    .diag-group-title.red    { color: var(--red); }
    .diag-group-title.yellow { color: var(--yellow); }
    .diag-group-title.green  { color: var(--green); }
    .finding { display: flex; gap: 12px; padding: 13px 16px; border-radius: 8px; margin-bottom: 8px; align-items: flex-start; }
    .finding.ok     { background: var(--green-bg);  border: 1px solid var(--green-border); }
    .finding.alerta { background: var(--yellow-bg); border: 1px solid var(--yellow-border); }
    .finding.critico{ background: var(--red-bg);    border: 1px solid var(--red-border); }
    .finding-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
    .finding-body { flex: 1; }
    .finding-title { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
    .finding-pilar { font-size: 10px; color: var(--text-mid); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 4px; }
    .finding-desc { font-size: 13px; color: var(--text-mid); line-height: 1.55; }
    .finding-meta { display: flex; gap: 8px; margin-top: 5px; flex-wrap: wrap; align-items: center; }
    .fv { font-size: 11px; font-family: 'DM Mono', monospace; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 3px; color: var(--text-mid); }
    .fi { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 3px; }
    .fi.critico { color: var(--red);    background: var(--red-bg); }
    .fi.alerta  { color: var(--yellow); background: var(--yellow-bg); }
    .actions { display: flex; justify-content: space-between; align-items: center; padding-top: 24px; border-top: 1px solid var(--border); gap: 12px; flex-wrap: wrap; }
  `]
})
export class ResultComponent implements OnChanges {
  @Input() result!: AnalysisResult;
  @Output() goToMapping = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();

  donutOffset = 289;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['result'] && this.result) {
      setTimeout(() => {
        this.donutOffset = 289 * (1 - (this.result.final.final_score ?? 0) / 100);
      }, 100);
    }
  }

  get sortedBreakdown(): PillarBreakdown[] {
    return [...(this.result?.final?.pillar_breakdown || [])]
      .sort((a, b) => PILLAR_ORDER.indexOf(a.pilar_key) - PILLAR_ORDER.indexOf(b.pilar_key));
  }

  get rankingParts(): string[] {
    const rk = this.result?.final?.ranking_foco || '';
    if (!rk || rk === 'Nenhum problema') return [];
    return rk.split('>').map(s => s.trim()).filter(Boolean);
  }

  get criticos() {
    return (this.result?.final?.diagnostics || []).filter(d => d.severidade === 'CRITICO');
  }

  get avisos() {
    return (this.result?.final?.diagnostics || [])
      .filter(d => ['ALERTA', 'WARN_FORTE', 'WARN'].includes(d.severidade));
  }

  scoreColor(score: number)   { return scoreColor(score); }
  isConsultivo(key: string)   { return isConsultivo(key); }
  getWeight(key: string)      { return PILLAR_WEIGHTS[key] || 0; }
  formatSubcat(s: string)     { return s.replace(/^\d+\.\d+_/, '').replace(/_/g, ' '); }
}
