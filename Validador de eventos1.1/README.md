# PM Engine v2 — Documentação Técnica

> Motor de validação de bases de dados para Process Mining.
> Calcula score 0–100 por 6 pilares de qualidade com diagnóstico automático, gates eliminatórios e log em Excel.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Como Usar](#2-como-usar)
3. [Estrutura da Base Esperada](#3-estrutura-da-base-esperada)
4. [Arquitetura do Motor](#4-arquitetura-do-motor)
5. [Cálculo do Score Final](#5-cálculo-do-score-final)
6. [Pilar 1 — Qualidade Estrutural e de Formato](#6-pilar-1--qualidade-estrutural-e-de-formato)
7. [Pilar 2 — Completude e Cobertura](#7-pilar-2--completude-e-cobertura)
8. [Pilar 3 — Integridade Temporal](#8-pilar-3--integridade-temporal)
9. [Pilar 4 — Unicidade e Duplicidade](#9-pilar-4--unicidade-e-duplicidade)
10. [Pilar 5 — Coerência do Case ID](#10-pilar-5--coerência-do-case-id)
11. [Pilar 6 — Minerabilidade e Qualidade de Atividade](#11-pilar-6--minerabilidade-e-qualidade-de-atividade)
12. [Gates Eliminatórios](#12-gates-eliminatórios)
13. [Log de Saída em Excel](#13-log-de-saída-em-excel)
14. [Detecção Automática de Encoding e Separador](#14-detecção-automática-de-encoding-e-separador)
15. [Detecção de Formato de Timestamp](#15-detecção-de-formato-de-timestamp)
16. [Dependências](#16-dependências)

---

## 1. Visão Geral

O PM Engine v2 recebe um arquivo CSV ou XLSX com eventos de processo e retorna:

- **Score final** de 0 a 100
- **Classificação**: APTA / APTA_COM_RESSALVAS / NAO_APTA
- **Veredicto eliminatório** baseado nos Pilares 1 e 2
- **Risco consultivo** (BAIXO / MÉDIO / ALTO) baseado nos Pilares 3 a 6
- **Diagnóstico por subcategoria** com barra de progresso e texto explicativo
- **Ranking de foco**: pilares ordenados por impacto ponderado
- **Frases de diagnóstico automáticas** por pilar
- **Log em Excel** com três abas: `execucoes`, `diagnosticos`, `subcategorias`

---

## 2. Como Usar

### Servidor Flask (com frontend HTML)

```bash
pip install flask flask-cors openpyxl pandas numpy
python pm_engine_v2.py --serve
```

Acesse `pm_validator_v2.html` no navegador e aponte para `http://localhost:5000`.

### Via Python diretamente

```python
import pm_engine_v2 as eng

result = eng.run_analysis(
    input_path='minha_base.csv',
    case_col='Case_ID',
    act_col='Atividade',
    start_col='TS_Inicio',
    end_col='TS_Fim',          # opcional
    original_filename='minha_base.csv',
)

print(result['final']['final_score'])       # ex: 87.4
print(result['final']['rating'])            # APTA_COM_RESSALVAS
print(result['final']['ranking_foco'])      # P4 > P1 > P6

# Gravar log no Excel
eng.export_to_excel(result, 'pm_engine_log.xlsx')
```

### Via linha de comando

```bash
python pm_engine_v2.py \
  --file minha_base.csv \
  --case Case_ID \
  --activity Atividade \
  --start TS_Inicio \
  --end TS_Fim
```

---

## 3. Estrutura da Base Esperada

| Coluna | Tipo | Obrigatória | Descrição |
|--------|------|-------------|-----------|
| `Case_ID` | String ou Número | Sim | Identificador único do processo |
| `Atividade` | String | Sim | Nome da etapa/evento executado |
| `TS_Inicio` | Datetime | Sim | Timestamp de início da atividade |
| `TS_Fim` | Datetime | Não | Timestamp de fim — habilita P3.2, P3.3, P6.3 |

Os nomes das colunas podem ser quaisquer — o mapeamento é feito no frontend ou via parâmetros da função.

---

## 4. Arquitetura do Motor

```
CSV / XLSX
    │
    ▼
load_data()          ← detecta encoding + separador automaticamente
    │
    ▼
normalize_strings()  ← strip de espaços e normalização de tipos
    │
    ├── score_pillar1()   Qualidade Estrutural     (peso 20%)
    ├── score_pillar2()   Completude & Cobertura   (peso 15%)
    ├── score_pillar3()   Integridade Temporal     (peso 20%)
    ├── score_pillar4()   Unicidade & Duplicidade  (peso 15%)
    ├── score_pillar5()   Coerência do Case ID     (peso 15%)
    └── score_pillar6()   Minerabilidade           (peso 15%)
           │
           ▼
    compute_final_score()
           │
           ├── score final ponderado (0–100)
           ├── classificação (APTA / RESSALVAS / NAO_APTA)
           ├── pillar_breakdown com subcategorias detalhadas
           ├── ranking_foco (pilares por impacto ponderado)
           └── frases de diagnóstico automáticas
           │
           ▼
    export_to_excel()    ← grava ou acrescenta no log Excel
```

---

## 5. Cálculo do Score Final

### Fórmula

```
Score Final = (P1×20 + P2×15 + P3×20 + P4×15 + P5×15 + P6×15) / 100
```

### Classificação

| Score | Classificação | Interpretação |
|-------|--------------|---------------|
| ≥ 95  | SUPER_APTA | Base excelente, atende com folga todos os critérios |
| ≥ 85  | APTA | Base pronta para mineração |
| ≥ 75  | APTA_COM_RESSALVAS | Utilizável, mas com pontos de atenção |
| < 75  | NAO_APTA | Necessita correção antes de minerar |

### Veredicto eliminatório (P1 + P2)

Independente do score final, se P1 ou P2 tiverem gates ativos, o `veredicto` é `NAO_APTA`.

### Risco consultivo (P3 a P6)

```
media_consultiva = (score_P3 + score_P4 + score_P5 + score_P6) / 4

BAIXO  se media >= 80
MEDIO  se media >= 60
ALTO   se media < 60
```

---

## 6. Pilar 1 — Qualidade Estrutural e de Formato

**Peso: 20% | Determinativo**

Avalia se as colunas obrigatórias estão presentes e preenchidas, e se os timestamps são parseáveis e consistentes em formato.

### Sub 1.1 — Presença e Preenchimento de Colunas (máx 60 pts)

#### Case_ID (máx 20 pts)
| Condição | Pontos |
|----------|--------|
| 0% nulos | 20 |
| ≤ 0,5% nulos | 13 |
| ≤ 2% nulos | 6 |
| > 2% nulos | 0 + **GATE** |

#### Atividade (máx 20 pts)
| Condição | Pontos |
|----------|--------|
| 0% nulos | 20 |
| ≤ 0,1% nulos | 12 |
| ≤ 1% nulos | 5 |
| > 1% nulos | 0 + **GATE** |

#### TS_Inicio (máx 20 pts)
| Condição | Pontos |
|----------|--------|
| 0% nulos | 20 |
| ≤ 0,1% nulos | 10 |
| > 0,1% nulos | 0 + **GATE** |

#### Penalidade TS_Fim inválido
| Condição | Penalidade |
|----------|-----------|
| Taxa inválidos ≤ 0,1% | -5 pts |
| Taxa inválidos > 0,1% | -15 pts |

### Sub 1.2 — Parse e Consistência de Formato (máx 40 pts)

#### Timestamps inválidos (máx 25 pts)
| Condição | Pontos |
|----------|--------|
| 0% inválidos | 25 |
| ≤ 0,1% inválidos | 18 |
| ≤ 1% inválidos | 7 |
| > 1% inválidos | 0 + **GATE** |

#### Padrões de formato distintos (máx 15 pts)
| Condição | Pontos |
|----------|--------|
| 1 padrão detectado | 15 |
| 2 padrões detectados | 8 |
| 3+ padrões detectados | 0 |

> **Nota:** O engine detecta formatos por *família* (ISO, BR_slash, BR_dash, US, COMPACT). Variantes da mesma família (com/sem hora, com/sem segundos) contam como 1 padrão — evita falso positivo quando TS_Inicio e TS_Fim usam a mesma família mas com precisões diferentes.

---

## 7. Pilar 2 — Completude e Cobertura

**Peso: 15% | Determinativo**

Verifica se a base tem dados suficientes para mineração: densidade por case, ausência de nulos, e período temporal adequado.

### Sub 2.1 — Completude de Colunas de Conteúdo (máx 35 pts)

| Coluna | Condição | Pontos |
|--------|----------|--------|
| Atividade | 0% nulos | 10 |
| Atividade | ≤ 0,5% | 6 |
| Atividade | > 0,5% | 0 |
| TS_Inicio | 0% nulos | 25 |
| TS_Inicio | ≤ 0,1% | 15 |
| TS_Inicio | > 0,1% | 0 + **GATE** |

### Sub 2.2 — Densidade por Case (máx 50 pts)

#### % de cases com menos de 2 eventos (máx 35 pts)
| Condição | Pontos |
|----------|--------|
| ≤ 5% dos cases com 1 evento | 35 |
| ≤ 15% | 26 |
| ≤ 30% | 14 |
| ≤ 60% | 6 |
| > 60% | 0 |
| > 90% | 0 + **GATE** |

#### Mediana de eventos por case (máx 15 pts)
| Condição | Pontos |
|----------|--------|
| Mediana ≥ 6 | 15 |
| Mediana ≥ 4 | 12 |
| Mediana = 3 | 8 |
| Mediana = 2 | 4 |
| Mediana < 2 | 0 + **GATE** |

### Sub 2.3 — Cobertura Temporal (máx 20 pts)

| Condição | Pontos |
|----------|--------|
| Período ≥ 90 dias | 20 |
| Período ≥ 30 dias | 14 |
| Período ≥ 7 dias | 7 |
| Período < 7 dias | 0 |

---

## 8. Pilar 3 — Integridade Temporal

**Peso: 20% | Consultivo**

Verifica consistência cronológica: inversões de ordem, durações negativas, gaps absurdos intra-case e lacunas na base.

### Sub 3.1 — Inversões de Ordem (máx 30 pts)

Detecta eventos em que `TS_Inicio[n] > TS_Inicio[n+1]` dentro do mesmo case.

| Condição | Pontos |
|----------|--------|
| 0% inversões | 30 |
| ≤ 0,1% | 22 |
| ≤ 1% | 11 |
| ≤ 5% | 4 |
| > 5% | 0 + **GATE** |

### Sub 3.2 — Durações Negativas (máx 25 pts)

Detecta eventos em que `TS_Fim < TS_Inicio`. Requer TS_Fim.

| Condição | Pontos |
|----------|--------|
| 0% negativas | 25 |
| ≤ 0,1% | 17 |
| ≤ 1% | 7 |
| > 1% | 0 + **GATE** |

### Sub 3.3 — Gaps Absurdos Intra-Case (máx 25 pts)

Detecta intervalos > 365 dias entre dois eventos consecutivos do mesmo case.

| Condição | Pontos |
|----------|--------|
| 0% de gaps absurdos | 25 |
| ≤ 0,1% | 17 |
| ≤ 1% | 8 |
| > 1% | 0 |

### Sub 3.4 — Gap Máximo na Base (máx 20 pts)

Mede a maior lacuna entre dois dias consecutivos com eventos na base completa.

| Condição | Pontos |
|----------|--------|
| Gap máximo ≤ 3 dias | 20 |
| ≤ 7 dias | 14 |
| ≤ 30 dias | 7 |
| > 30 dias | 0 |

---

## 9. Pilar 4 — Unicidade e Duplicidade

**Peso: 15% | Consultivo**

Detecta linhas duplicadas e colisões de registro.

### Sub 4.1 — Duplicatas Exatas (máx 60 pts)

Chave de duplicação: `Case_ID + Atividade + TS_Inicio + TS_Fim` (quando presente).

| Condição | Pontos |
|----------|--------|
| 0% duplicatas | 60 |
| ≤ 0,05% | 50 |
| ≤ 0,2% | 35 |
| ≤ 1% | 15 |
| > 1% | 0 + **GATE** |

### Sub 4.2 — Colisões de Registro (máx 40 pts)

Mesmo `Case_ID + Atividade + TS_Inicio`, mas `TS_Fim` diferente — ambiguidade sobre qual valor é correto.

| Condição | Pontos |
|----------|--------|
| ≤ 1% dos cases com colisão | 40 |
| ≤ 5% | 30 |
| ≤ 15% | 18 |
| ≤ 30% | 8 |
| > 30% | 0 + **GATE** |

---

## 10. Pilar 5 — Coerência do Case ID

**Peso: 15% | Consultivo**

Detecta fragmentação (case dividido em múltiplos IDs), mescla (vários processos sob o mesmo ID) e inconsistência de formato.

### Sub 5.1 — Fragmentação (máx 35 pts)

```
r_duration = P99(duração do case) / P95(duração do case)
```

| Condição | Pontos |
|----------|--------|
| r_duration ≤ 2 | 35 |
| r_duration ≤ 5 | 25 |
| r_duration ≤ 10 | 10 |
| r_duration > 10 | 0 |

### Sub 5.2 — Mescla (máx 35 pts)

Composta por três subcomponentes:

**r_events** (máx 14 pts): `P99(qtd eventos por case) / P95`

| r_events | Pontos |
|----------|--------|
| ≤ 2 | 14 |
| ≤ 5 | 10 |
| ≤ 10 | 5 |
| > 10 | 0 |

**r_acts** (máx 14 pts): `P99(atividades distintas por case) / P95`

Mesmas faixas que r_events.

**top1pct_share** (máx 7 pts): % dos eventos concentrados no 1% dos cases com mais eventos.

| Condição | Pontos |
|----------|--------|
| ≤ 5% dos eventos | 7 |
| ≤ 15% | 4 |
| > 15% | 0 |

### Sub 5.3 — Normalização e Consistência (máx 30 pts)

**Formato** (máx 10 pts):

| Padrão | Pontos |
|--------|--------|
| UUID consistente | 10 |
| Alfanumérico consistente | 10 |
| Numérico consistente | 10 |
| Numérico com variação | 5 |
| Alta inconsistência | 0 |

**Espaços extras** (máx 10 pts):

| Condição | Pontos |
|----------|--------|
| 0% com espaços | 10 |
| ≤ 1% | 5 |
| > 1% | 0 |

**Caracteres de controle** (máx 10 pts):

| Condição | Pontos |
|----------|--------|
| 0% com chars controle | 10 |
| ≤ 0,5% | 5 |
| > 0,5% | 0 |

---

## 11. Pilar 6 — Minerabilidade e Qualidade de Atividade

**Peso: 15% | Consultivo**

Avalia se as atividades têm vocabulário rico e bem distribuído para gerar modelos de processo informativos.

### Sub 6.1 — Vocabulário de Atividades (máx 30 pts)

**Cardinalidade** (máx 20 pts):

| Condição | Pontos |
|----------|--------|
| 5 a 200 atividades | 20 |
| 2–4 ou 201–500 | 12 |
| 1 ou 501–1000 | 5 |
| > 1000 | 0 + **GATE** |

**Atividades raras** (máx 10 pts): % de atividades que aparecem em menos de 0,5% dos cases.

| Condição | Pontos |
|----------|--------|
| ≤ 10% raras | 10 |
| ≤ 30% | 5 |
| > 30% | 0 |

### Sub 6.2 — Diversidade de Variantes (máx 40 pts)

Uma variante é a sequência única de atividades de um case.

**variant_ratio** (máx 13 pts): `n_variantes / n_cases`

| Condição | Pontos |
|----------|--------|
| ≤ 0,3 | 13 |
| ≤ 0,5 | 9 |
| ≤ 0,7 | 5 |
| > 0,7 | 0 |

**top10_coverage** (máx 17 pts): % de cases cobertos pelas 10 variantes mais frequentes.

| Condição | Pontos |
|----------|--------|
| ≥ 80% | 17 |
| ≥ 60% | 12 |
| ≥ 40% | 5 |
| < 40% | 0 |

**Variantes raras** (máx 10 pts): % de variantes que aparecem em apenas 1 case.

| Condição | Pontos |
|----------|--------|
| ≤ 20% raras | 10 |
| ≤ 40% | 6 |
| > 40% | 0 |

### Sub 6.3 — Sobreposição de Eventos (máx 20 pts)

Detecta quando `TS_Inicio[n+1] < TS_Fim[n]` dentro do mesmo case. Requer TS_Fim.

| Condição | Pontos |
|----------|--------|
| ≤ 10% dos cases com sobreposição | 20 |
| ≤ 30% | 14 |
| ≤ 50% | 6 |
| > 50% | 0 |

### Sub 6.4 — Completude do Case_ID (máx 10 pts)

| Condição | Pontos |
|----------|--------|
| 0% nulos | 10 |
| ≤ 0,5% | 7 |
| ≤ 2% | 3 |
| > 2% | 0 |

---

## 12. Gates Eliminatórios

Gates zeram o score da subcategoria associada e marcam o pilar como INAPTO. Um pilar INAPTO propaga para o veredicto final.

| Gate | Pilar | Condição | Efeito |
|------|-------|----------|--------|
| Case_ID nulo > 2% | P1 | null_rate_case_id > 2% | P1 INAPTO, s11_case = 0 |
| Atividade nula > 1% | P1 | null_rate_atividade > 1% | P1 INAPTO, s11_act = 0 |
| TS_Inicio nulo > 0,1% | P1/P2 | null_rate_ts > 0,1% | P1 e P2 INAPTO |
| TS inválido > 1% | P1 | invalid_rate_ts > 1% | P1 INAPTO, s12_invalid = 0 |
| Cases com 1 evento > 90% | P2 | pct_lt2 > 90% | P2 INAPTO, sub2.2 = 0 |
| Mediana < 2 | P2 | mediana < 2 | P2 INAPTO, pts_median = 0 |
| Inversões > 5% | P3 | inversion_rate > 5% | P3 INAPTO, s31 = 0 |
| Durações negativas > 1% | P3 | neg_duration_rate > 1% | P3 INAPTO, s32 = 0 |
| Duplicatas > 1% | P4 | dup_rate > 1% | P4 INAPTO, s41 = 0 |
| Colisões > 30% | P4 | collision_case_rate > 30% | P4 INAPTO, s42 = 0 |
| Cardinalidade > 1000 | P6 | n_activities > 1000 | P6 INAPTO, s61 = 0 |

---

## 13. Log de Saída em Excel

A função `export_to_excel(result, path)` cria ou acrescenta linhas num arquivo Excel com três abas.

### Aba `execucoes` — 1 linha por execução

| Campo | Descrição |
|-------|-----------|
| `id_execucao` | Sequencial automático |
| `nome_base` | Nome original do arquivo |
| `responsavel` | Usuário do sistema operacional que executou a análise (`getpass.getuser()`) |
| `data_execucao` | Data da análise |
| `ts_inicio / ts_fim` | Timestamps de início e fim |
| `tempo_minutos` | Duração da análise |
| `n_linhas / n_cases / n_atividades / periodo_dias` | Tamanho da base |
| `score_p1` a `score_p6` | Score de cada pilar |
| `veredicto` | APTA / NAO_APTA (P1+P2) |
| `n_gates_disparados` | Quantidade de gates |
| `media_consultiva / risco_consultivo` | Média e risco dos consultivos |
| `score_final / barra_final` | Score e barra visual |
| `classificacao` | APTA / APTA_COM_RESSALVAS / NAO_APTA |
| `ranking_foco` | Pilares ordenados por impacto |
| `frase_resumo` | Resumo narrativo gerado automaticamente |

### Aba `diagnosticos` — 1 linha por problema encontrado

| Campo | Descrição |
|-------|-----------|
| `pilar` | P1 a P6 |
| `subcategoria` | Sub afetada |
| `score_obtido / score_max` | Pontuação real vs máxima |
| `tipo` | GATE / AVISO / INFO |
| `check` | Nome técnico do problema |
| `mensagem` | Descrição do problema |
| `valor_encontrado / limite_referencia` | Métrica e threshold |
| `impacto_pts` | Ex: `obteve 18 de 60 (-42 pts)` |
| `impacto` | ELIMINATORIO / REDUZ_SCORE / INFORMATIVO |
| `severidade` | CRITICO / ALERTA / WARN / INFO |

### Aba `subcategorias` — 1 linha por subcategoria por execução

| Campo | Descrição |
|-------|-----------|
| `pilar / subcategoria` | Identificação |
| `score_obtido / score_max / pts_perdidos` | Pontuação detalhada |
| `status` | PASSOU / REDUZIU / ZEROU |
| `barra` | Ex: `████████░░ 46/60` |
| `impacto_texto` | Ex: `obteve 46 de 60 (-14 pts)` |

---

## 14. Detecção Automática de Encoding e Separador

### Encoding

O engine usa a seguinte cascata:

1. **BOM** — detecta UTF-8-BOM, UTF-16, UTF-32 pelo cabeçalho do arquivo
2. **cascade** — tenta em ordem: `utf-8-sig`, `utf-8`, `cp1252`, `iso-8859-1`, `latin-1`
3. **fallback** — `latin-1` aceita qualquer byte sem erro

### Separador

Lê o cabeçalho e conta ocorrências de `;`, `,`, `\t` e `|`. O mais frequente é eleito. Funciona para arquivos brasileiros (ponto-e-vírgula) e internacionais (vírgula).

---

## 15. Detecção de Formato de Timestamp

A função `infer_datetime_format(series)` detecta o formato dominante por *família*:

| Família | Exemplos |
|---------|---------|
| ISO | `2024-01-15 08:30:00`, `2024-01-15T08:30` |
| BR_slash | `15/01/2024 08:30:00`, `15/01/2024` |
| BR_dash | `15-01-2024 08:30`, `15-01-2024` |
| US | `01/15/2024 08:30:00` |
| COMPACT | `20240115083000` |

**Resolução de ambiguidade BR vs US:** se qualquer valor tem primeiro campo > 12, confirma BR (dia não pode ser mês). Caso contrário, assume BR como padrão para bases brasileiras.

**`dayfirst` é inferido automaticamente** do formato eleito — não precisa ser configurado manualmente.

---

## 16. Dependências

```bash
pip install pandas numpy flask flask-cors openpyxl
```

| Pacote | Versão mínima | Uso |
|--------|--------------|-----|
| pandas | 1.5+ | Leitura e manipulação de dados |
| numpy | 1.21+ | Cálculos estatísticos |
| flask | 2.0+ | Servidor HTTP |
| flask-cors | 3.0+ | CORS para o frontend |
| openpyxl | 3.0+ | Geração do log Excel |

---

## Estrutura de Arquivos

```
pm_validator/
├── pm_engine_v2.py             Motor principal (Flask + lógica dos pilares)
├── pm_validator_v2.html        Frontend HTML/JS (vanilla)
├── pm_validator_angular.html   Frontend Angular 17 (standalone, sem build)
└── README.md                   Esta documentação
```

---

*PM Engine v2 — Itaú Unibanco · Data Product — Process Mining*
