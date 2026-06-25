"""
LogBuilder — servidor backend
Transforme bases analíticas em event logs para Process Mining.

Uso:
    pip install flask pandas openpyxl
    python server.py
"""

import io
import json
import os
import re
import tempfile
import uuid
from pathlib import Path
from typing import Optional

import pandas as pd
from flask import Flask, jsonify, request, send_file
from flask.wrappers import Response

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024  # 200 MB

SESSIONS: dict[str, dict] = {}
TEMP_DIR = Path(tempfile.gettempdir()) / "logbuilder"
TEMP_DIR.mkdir(exist_ok=True)


# ── helpers ────────────────────────────────────────────────────────────────

DATE_PREFIXES = ["dthr_", "dth_", "dt_", "dh_", "dat_", "data_", "date_"]
DATE_PREFIXES.sort(key=len, reverse=True)

ABBREVIATION_MAP = {
    "pgto": "pagamento", "pgt": "pagamento", "pg": "pagamento",
    "liquid": "liquidacao", "liq": "liquidacao",
    "fat": "faturamento", "fatur": "faturamento",
    "cobr": "cobranca", "receb": "recebimento", "rec": "recebimento",
    "aprov": "aprovacao", "apr": "aprovacao", "apro": "aprovacao",
    "analise": "analise", "anal": "analise",
    "aval": "avaliacao", "valid": "validacao", "val": "validacao",
    "verif": "verificacao", "conf": "confirmacao",
    "cancel": "cancelamento", "canc": "cancelamento", "can": "cancelamento",
    "encerr": "encerramento", "encer": "encerramento",
    "venc": "vencimento", "ven": "vencimento",
    "emiss": "emissao", "emis": "emissao", "emit": "emissao",
    "protoc": "protocolo", "prot": "protocolo",
    "regist": "registro", "reg": "registro",
    "cadastr": "cadastro", "cad": "cadastro",
    "envio": "envio", "env": "envio",
    "entr": "entrega", "entreg": "entrega",
    "desp": "despacho", "exped": "expedicao",
    "retorn": "retorno", "ret": "retorno",
    "devol": "devolucao", "dev": "devolucao",
    "abert": "abertura", "aber": "abertura",
    "inic": "inicio", "ini": "inicio",
    "concl": "conclusao", "conc": "conclusao",
    "fin": "finalizacao", "final": "finalizacao", "finaliz": "finalizacao",
    "assin": "assinatura", "ass": "assinatura",
    "contrat": "contrato", "contr": "contrato",
    "propos": "proposta", "prop": "proposta",
    "atend": "atendimento", "aten": "atendimento",
    "solic": "solicitacao", "sol": "solicitacao", "solicit": "solicitacao",
    "transf": "transferencia", "trans": "transferencia",
    "bloq": "bloqueio", "desbloq": "desbloqueio",
    "suspens": "suspensao", "suspen": "suspensao",
    "ativ": "ativacao", "atualiz": "atualizacao", "atual": "atualizacao",
    "alterac": "alteracao", "alter": "alteracao",
    "homolog": "homologacao", "homol": "homologacao",
    "certif": "certificacao",
    "desemb": "desembolso", "reemb": "reembolso",
    "cred": "credito", "deb": "debito",
    "ocorr": "ocorrencia", "ocor": "ocorrencia",
    "negoc": "negociacao", "neg": "negociacao",
    "audit": "auditoria", "aud": "auditoria",
    "revis": "revisao", "rev": "revisao",
    "estorn": "estorno", "estor": "estorno",
    "remit": "remessa", "rem": "remessa",
    "distrib": "distribuicao",
    "migr": "migracao", "integ": "integracao",
}

PORTUGUESE_WORD_MAP = {
    "abertura": "Abertura", "aprovacao": "Aprovação", "analise": "Análise",
    "atendimento": "Atendimento", "ativacao": "Ativação", "atualizacao": "Atualização",
    "alteracao": "Alteração", "auditoria": "Auditoria", "avaliacao": "Avaliação",
    "assinatura": "Assinatura", "autorizacao": "Autorização", "aceite": "Aceite",
    "baixa": "Baixa", "bloqueio": "Bloqueio",
    "cadastro": "Cadastro", "cancelamento": "Cancelamento", "certificacao": "Certificação",
    "cobranca": "Cobrança", "conclusao": "Conclusão", "confirmacao": "Confirmação",
    "contrato": "Contrato", "criacao": "Criação", "credito": "Crédito",
    "debito": "Débito", "desativacao": "Desativação", "desbloqueio": "Desbloqueio",
    "despacho": "Despacho", "desembolso": "Desembolso", "distribuicao": "Distribuição",
    "devolucao": "Devolução",
    "emissao": "Emissão", "encerramento": "Encerramento", "entrega": "Entrega",
    "envio": "Envio", "execucao": "Execução", "expedicao": "Expedição",
    "expiracao": "Expiração", "estorno": "Estorno",
    "faturamento": "Faturamento", "finalizacao": "Finalização", "fim": "Fim",
    "homologacao": "Homologação",
    "importacao": "Importação", "inicio": "Início", "integracao": "Integração",
    "liquidacao": "Liquidação",
    "migracao": "Migração",
    "negociacao": "Negociação",
    "ocorrencia": "Ocorrência",
    "pagamento": "Pagamento", "prazo": "Prazo", "proposta": "Proposta",
    "protocolo": "Protocolo",
    "reabertura": "Reabertura", "recebimento": "Recebimento", "recepcao": "Recepção",
    "reembolso": "Reembolso", "registro": "Registro", "remessa": "Remessa",
    "requisicao": "Requisição", "retomada": "Retomada", "retorno": "Retorno",
    "revisao": "Revisão",
    "solicitacao": "Solicitação", "suspensao": "Suspensão",
    "transferencia": "Transferência", "transito": "Trânsito",
    "validacao": "Validação", "vencimento": "Vencimento", "verificacao": "Verificação",
    "de": "de", "da": "da", "do": "do", "das": "das", "dos": "dos",
    "e": "e", "em": "em", "por": "por", "para": "para", "com": "com",
}

DIRECT_MAP = {
    "data_pagamento": "Pagamento", "dt_pagamento": "Pagamento",
    "dt_pgto": "Pagamento", "dt_pgt": "Pagamento", "data_pgto": "Pagamento",
    "data_analise": "Análise", "dt_analise": "Análise",
    "data_fim_analise": "Fim da Análise", "dt_fim_analise": "Fim da Análise",
    "data_inicio_analise": "Início da Análise",
    "data_aprovacao": "Aprovação", "dt_aprovacao": "Aprovação", "dt_aprov": "Aprovação",
    "data_liquidacao": "Liquidação", "dt_liquidacao": "Liquidação",
    "dh_envio": "Envio", "data_envio": "Envio", "dt_envio": "Envio",
    "data_cancelamento": "Cancelamento", "dt_cancelamento": "Cancelamento",
    "dt_cancel": "Cancelamento", "dt_canc": "Cancelamento",
    "data_vencimento": "Vencimento", "dt_vencimento": "Vencimento", "dt_venc": "Vencimento",
    "data_emissao": "Emissão", "dt_emissao": "Emissão", "dt_emiss": "Emissão",
    "data_protocolo": "Protocolo", "dt_protocolo": "Protocolo",
    "data_abertura": "Abertura", "dt_abertura": "Abertura",
    "data_recebimento": "Recebimento", "dt_recebimento": "Recebimento",
    "data_encerramento": "Encerramento", "dt_encerramento": "Encerramento",
    "data_cadastro": "Cadastro", "dt_cadastro": "Cadastro",
    "data_faturamento": "Faturamento", "dt_faturamento": "Faturamento",
}


def suggest_activity_name(col: str) -> str:
    key = col.strip().lower()
    if key in DIRECT_MAP:
        return DIRECT_MAP[key]

    stem = key
    for prefix in DATE_PREFIXES:
        if key.startswith(prefix):
            stem = key[len(prefix):]
            break

    tokens = [t for t in stem.split("_") if t]
    expanded = []
    for tok in tokens:
        expanded.append(ABBREVIATION_MAP.get(tok, tok))

    flat = []
    for tok in expanded:
        flat.extend(tok.split("_"))

    mapped = []
    for i, tok in enumerate(flat):
        if tok in PORTUGUESE_WORD_MAP:
            word = PORTUGUESE_WORD_MAP[tok]
            if i > 0 and tok in {"de", "da", "do", "das", "dos", "e", "em", "por", "para", "com"}:
                word = word.lower()
            mapped.append(word)
        else:
            mapped.append(tok.capitalize() if tok else tok)

    return " ".join(mapped) if mapped else col.replace("_", " ").title()


def is_date_column(col: str) -> bool:
    key = col.strip().lower()
    return any(key.startswith(p) for p in DATE_PREFIXES)


def read_uploaded_file(file) -> pd.DataFrame:
    fname = file.filename.lower()
    content = file.read()
    if fname.endswith(".csv"):
        for sep in [",", ";", "\t", "|"]:
            try:
                df = pd.read_csv(io.BytesIO(content), sep=sep)
                if len(df.columns) > 1:
                    return df
            except Exception:
                continue
        return pd.read_csv(io.BytesIO(content))
    elif fname.endswith((".xlsx", ".xls")):
        return pd.read_excel(io.BytesIO(content))
    raise ValueError("Formato não suportado. Use CSV ou Excel.")


# ── CORS ────────────────────────────────────────────────────────────────────

@app.after_request
def add_cors(response: Response) -> Response:
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response

@app.route("/api/<path:p>", methods=["OPTIONS"])
def preflight(p):
    return "", 204


# ── ROTAS ───────────────────────────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado."}), 400

    file = request.files["file"]
    try:
        df = read_uploaded_file(file)
    except Exception as e:
        return jsonify({"error": str(e)}), 422

    if df.empty:
        return jsonify({"error": "Arquivo vazio ou sem dados."}), 422

    session_id = str(uuid.uuid4())

    # Salvar em disco para sessões grandes
    path = TEMP_DIR / f"{session_id}.parquet"
    try:
        df.to_parquet(path, index=False)
    except Exception:
        df.to_csv(TEMP_DIR / f"{session_id}.csv", index=False)

    # Detectar colunas de data
    all_cols = list(df.columns)
    date_cols = [c for c in all_cols if is_date_column(c)]

    columns_meta = []
    for col in all_cols:
        sample = df[col].dropna().head(4).astype(str).tolist()
        columns_meta.append({
            "name": col,
            "dtype": str(df[col].dtype),
            "null_pct": round(df[col].isna().mean() * 100, 1),
            "sample": sample,
            "is_date": col in date_cols,
            "suggested_activity": suggest_activity_name(col) if col in date_cols else None,
        })

    SESSIONS[session_id] = {"path": str(path), "filename": file.filename}

    return jsonify({
        "session_id": session_id,
        "filename": file.filename,
        "rows": len(df),
        "columns": columns_meta,
        "preview": df.head(5).fillna("").astype(str).to_dict(orient="records"),
    })


def build_log(df, case_id_col, mappings, timestamp_format=None):
    """Constrói um event log a partir de um DataFrame e configuração de mapeamento.
    Retorna (log_df, skipped_nulls, warnings)."""
    events = []
    warnings = []
    skipped_nulls = 0

    for mapping in mappings:
        col = mapping.get("col")
        activity = mapping.get("activity_name", col)
        if not col or col not in df.columns:
            continue

        sub = df[[case_id_col, col]].copy()
        sub.columns = ["case_id", "timestamp"]
        sub["activity"] = activity

        null_before = int(sub["timestamp"].isna().sum())
        try:
            if timestamp_format:
                sub["timestamp"] = pd.to_datetime(sub["timestamp"], format=timestamp_format, errors="coerce")
            else:
                sub["timestamp"] = pd.to_datetime(sub["timestamp"], dayfirst=True, errors="coerce")
        except Exception:
            sub["timestamp"] = pd.to_datetime(sub["timestamp"], errors="coerce")

        null_after = int(sub["timestamp"].isna().sum())
        new_nulls = null_after - null_before
        if new_nulls > 0:
            warnings.append(f"'{col}': {new_nulls} datas não convertidas e ignoradas.")
        skipped_nulls += null_after

        sub = sub.dropna(subset=["timestamp"])
        events.append(sub)

    if not events:
        return None, skipped_nulls, warnings

    log = pd.concat(events, ignore_index=True)
    log = log.sort_values(["case_id", "timestamp"]).reset_index(drop=True)
    return log, skipped_nulls, warnings


@app.route("/api/convert", methods=["POST"])
def convert():
    body = request.get_json()
    session_id   = body.get("session_id")
    mappings     = body.get("mappings", [])
    perspective  = body.get("perspective", "process")   # "process" | "client" | "both"
    case_id_col  = body.get("case_id_col")              # usado em mode process
    client_id_col= body.get("client_id_col")            # usado em mode client / both
    timestamp_format = body.get("timestamp_format")

    if not session_id or not mappings:
        return jsonify({"error": "session_id e mappings são obrigatórios."}), 400
    if session_id not in SESSIONS:
        return jsonify({"error": "Sessão não encontrada. Faça o upload novamente."}), 404

    sess = SESSIONS[session_id]
    try:
        path = Path(sess["path"])
        df = pd.read_parquet(path) if path.suffix == ".parquet" else pd.read_csv(path.with_suffix(".csv"))
    except Exception as e:
        return jsonify({"error": f"Erro ao ler dados: {e}"}), 500

    # Validar colunas necessárias conforme perspectiva
    if perspective in ("process", "both") and (not case_id_col or case_id_col not in df.columns):
        return jsonify({"error": f"Coluna de processo '{case_id_col}' não encontrada."}), 422
    if perspective in ("client", "both") and (not client_id_col or client_id_col not in df.columns):
        return jsonify({"error": f"Coluna de cliente '{client_id_col}' não encontrada."}), 422

    result = {}
    all_warnings = []

    if perspective in ("process", "both"):
        log, skipped, warns = build_log(df, case_id_col, mappings, timestamp_format)
        if log is None:
            return jsonify({"error": "Nenhum evento gerado para perspectiva de processo."}), 422
        path_proc = TEMP_DIR / f"{session_id}_log_process.parquet"
        log.to_parquet(path_proc, index=False)
        SESSIONS[session_id]["log_process_path"] = str(path_proc)
        result["process"] = {
            "total_cases": int(log["case_id"].nunique()),
            "total_events": len(log),
            "skipped_nulls": skipped,
            "preview": (log.head(20).assign(timestamp=log.head(20)["timestamp"].astype(str))
                        .to_dict(orient="records")),
        }
        all_warnings.extend(warns)

    if perspective in ("client", "both"):
        log, skipped, warns = build_log(df, client_id_col, mappings, timestamp_format)
        if log is None:
            return jsonify({"error": "Nenhum evento gerado para perspectiva de cliente."}), 422
        path_cli = TEMP_DIR / f"{session_id}_log_client.parquet"
        log.to_parquet(path_cli, index=False)
        SESSIONS[session_id]["log_client_path"] = str(path_cli)
        result["client"] = {
            "total_cases": int(log["case_id"].nunique()),
            "total_events": len(log),
            "skipped_nulls": skipped,
            "preview": (log.head(20).assign(timestamp=log.head(20)["timestamp"].astype(str))
                        .to_dict(orient="records")),
        }
        all_warnings.extend([w for w in warns if w not in all_warnings])

    SESSIONS[session_id]["perspective"] = perspective
    return jsonify({"perspective": perspective, "logs": result, "warnings": all_warnings})


@app.route("/api/export", methods=["GET"])
def export():
    session_id = request.args.get("session_id")
    fmt        = request.args.get("format", "csv")
    which      = request.args.get("which", "process")  # "process" | "client" | "both"

    if not session_id or session_id not in SESSIONS:
        return jsonify({"error": "Sessão não encontrada."}), 404

    sess = SESSIONS[session_id]
    base_name = Path(sess["filename"]).stem

    def log_to_content(log, fmt):
        if fmt == "csv":
            return log.to_csv(index=False), "csv"
        elif fmt == "celonis":
            out = log[["case_id","activity","timestamp"]].copy()
            out.columns = ["Case ID","Activity","Timestamp"]
            return out.to_csv(index=False), "csv"
        elif fmt == "disco":
            out = log[["case_id","activity","timestamp"]].copy()
            out.columns = ["case","activity","start timestamp"]
            return out.to_csv(index=False), "csv"
        return log.to_csv(index=False), "csv"

    # Exportar ambas as perspectivas como ZIP
    if which == "both":
        import zipfile
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for key, label in [("log_process_path","process"), ("log_client_path","client")]:
                if key not in sess:
                    continue
                log = pd.read_parquet(sess[key])
                content, ext = log_to_content(log, fmt)
                zf.writestr(f"{base_name}_event_log_{label}_{fmt}.{ext}",
                            content.encode("utf-8-sig"))
        zip_buf.seek(0)
        return send_file(zip_buf, mimetype="application/zip", as_attachment=True,
                         download_name=f"{base_name}_event_logs_{fmt}.zip")

    # Exportar uma perspectiva só
    path_key = "log_process_path" if which == "process" else "log_client_path"
    if path_key not in sess:
        return jsonify({"error": "Log não encontrado. Execute a conversão primeiro."}), 422

    log = pd.read_parquet(sess[path_key])
    content, ext = log_to_content(log, fmt)
    buf = io.BytesIO(content.encode("utf-8-sig"))
    return send_file(buf, mimetype="text/csv", as_attachment=True,
                     download_name=f"{base_name}_event_log_{which}_{fmt}.{ext}")


if __name__ == "__main__":
    print("LogBuilder rodando em http://localhost:5000")
    print("Abra o arquivo index.html no navegador.")
    app.run(port=5000, debug=False)
