// ─── Mapeamento de coluna ──────────────────────────────────────────────────────
export interface ColumnMapping {
  name: string;
  type: string;
  description: string;
}

// ─── Dados do arquivo ─────────────────────────────────────────────────────────
export interface FileData {
  name: string;
  size: number;
  headers: string[];
  totalRows: number;
  encodingUsed?: string;
  delimiterDetected?: string;
}

// ─── Resultado do engine ──────────────────────────────────────────────────────
export interface SubcategoryDetail {
  subcategoria: string;
  score_obtido: number;
  score_max: number;
  pts_perdidos: number;
  status: 'PASSOU' | 'REDUZIU' | 'ZEROU';
  barra: string;
  impacto_texto: string;
}

export interface PillarBreakdown {
  pilar_key: string;
  pilar: string;
  score: number;
  barra_pilar: string;
  pts_perdidos: number;
  pts_perdidos_ponderados: number;
  peso: number;
  status: 'APTO' | 'INAPTO';
  gates: string[];
  subcategorias: SubcategoryDetail[];
  frase_diagnostico: string;
}

export interface Diagnostic {
  pilar: string;
  check: string;
  descricao: string;
  severidade: string;
  valor?: string;
  threshold?: string;
  impacto?: string;
}

export interface Gate {
  pilar: string;
  gate: string;
}

export interface FinalResult {
  final_score: number;
  barra_final: string;
  rating: string;
  color: string;
  label: string;
  summary: string;
  ranking_foco: string;
  frase_resumo: string;
  gates_triggered: Gate[];
  diagnostics: Diagnostic[];
  pillar_breakdown: PillarBreakdown[];
  pillar_scores: Record<string, number>;
  pillar_status: Record<string, string>;
}

export interface AnalysisResult {
  input_file: string;
  n_rows: number;
  n_cases: number;
  n_atividades: number;
  periodo_dias: number;
  ts_inicio: string;
  ts_fim: string;
  tempo_minutos: number;
  veredicto: 'APTA' | 'NAO_APTA';
  risco_consultivo: 'BAIXO' | 'MEDIO' | 'ALTO';
  media_consultiva: number;
  ts_format_inferred?: { formato: string; dayfirst: boolean };
  encoding_used?: string;
  final: FinalResult;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
export const COLUMN_TYPES = [
  'Case_ID', 'Atividade', 'Timestamp_Inicio', 'Timestamp_Fim',
  'Texto', 'Número', 'Data', 'Outro'
];

export const UNIQUE_TYPES = ['Case_ID', 'Atividade', 'Timestamp_Inicio', 'Timestamp_Fim'];

export const PILLAR_ORDER = [
  'pillar1', 'pillar2', 'pillar3', 'pillar4', 'pillar5', 'pillar6'
];

export const PILLAR_WEIGHTS: Record<string, number> = {
  pillar1: 20, pillar2: 15, pillar3: 20,
  pillar4: 15, pillar5: 15, pillar6: 15,
};

export function autoDetectColumnType(header: string): string {
  const s = header.toLowerCase();
  if (/case|processo|id|chave|protocolo|numero|número/.test(s)) return 'Case_ID';
  if (/etapa|atividade|evento|activity|step|fase/.test(s))      return 'Atividade';
  if (/inicio|início|start|abertura|criado/.test(s))            return 'Timestamp_Inicio';
  if (/fim|end|fechamento|conclus|encerr/.test(s))              return 'Timestamp_Fim';
  if (/data|date/.test(s))                                       return 'Data';
  if (/tempo|time|min|seg|dur/.test(s))                         return 'Número';
  if (/obs|descr|coment|texto|text|note/.test(s))               return 'Texto';
  return 'Outro';
}

export function scoreColor(score: number): string {
  return score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--yellow)' : 'var(--red)';
}

export function isConsultivo(pillarKey: string): boolean {
  return !['pillar1', 'pillar2'].includes(pillarKey);
}
