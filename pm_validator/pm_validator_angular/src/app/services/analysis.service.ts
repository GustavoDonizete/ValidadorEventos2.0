import { Injectable, signal } from '@angular/core';
import { AnalysisResult, ColumnMapping, FileData, autoDetectColumnType } from '../models';

declare const XLSX: any;

@Injectable({ providedIn: 'root' })
export class AnalysisService {

  serverUrl   = signal('http://localhost:5000');
  serverOnline = signal(false);
  serverStatus = signal<'checking' | 'ok' | 'err'>('checking');
  serverText   = signal('— verificando...');

  async checkServer(manual = false): Promise<void> {
    this.serverStatus.set('checking');
    this.serverText.set('verificando...');
    try {
      const r = await fetch(this.serverUrl() + '/health', {
        signal: AbortSignal.timeout(4000)
      });
      if (r.ok) {
        this.serverStatus.set('ok');
        this.serverText.set('✓ online');
        this.serverOnline.set(true);
      } else {
        this.serverStatus.set('err');
        this.serverText.set('✗ erro ' + r.status);
        this.serverOnline.set(false);
      }
    } catch {
      this.serverStatus.set('err');
      this.serverText.set(manual ? '✗ offline' : '✗ offline — inicie o servidor');
      this.serverOnline.set(false);
    }
  }

  async fetchColumns(file: File, delimiter: string): Promise<FileData> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('config', JSON.stringify({ delimiter }));
    const resp = await fetch(this.serverUrl() + '/columns', {
      method: 'POST', body: fd, signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) throw new Error('Erro ' + resp.status);
    const data = await resp.json();
    return {
      name: file.name,
      size: file.size,
      headers: data.columns,
      totalRows: data.n_rows,
      encodingUsed: data.encoding_used,
      delimiterDetected: data.delimiter_detected,
    };
  }

  readFileSheetJS(file: File, isFallback = false): Promise<FileData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          resolve({
            name: file.name,
            size: file.size,
            headers: (json[0] || []).map(String),
            totalRows: json.slice(1).filter((r: any[]) => r.some((c: any) => c !== undefined && c !== '')).length,
            encodingUsed: isFallback ? 'desconhecido (servidor offline)' : undefined,
          });
        } catch (err: any) {
          reject(new Error('Erro ao ler arquivo: ' + err.message));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  buildMappings(headers: string[]): ColumnMapping[] {
    return headers.map(h => ({
      name: h,
      type: autoDetectColumnType(h),
      description: '',
    }));
  }

  getDuplicateTypes(mappings: ColumnMapping[]): string[] {
    const uniqueTypes = ['Case_ID', 'Atividade', 'Timestamp_Inicio', 'Timestamp_Fim'];
    const counts: Record<string, number> = {};
    mappings.forEach(m => {
      if (uniqueTypes.includes(m.type)) counts[m.type] = (counts[m.type] || 0) + 1;
    });
    return Object.entries(counts).filter(([, n]) => n > 1).map(([t]) => t);
  }

  async analyze(
    file: File,
    mappings: ColumnMapping[],
    delimiter: string,
    dayfirst: boolean,
  ): Promise<AnalysisResult> {
    const caseMap  = mappings.find(m => m.type === 'Case_ID');
    const actMap   = mappings.find(m => m.type === 'Atividade');
    const startMap = mappings.find(m => m.type === 'Timestamp_Inicio');
    const endMap   = mappings.find(m => m.type === 'Timestamp_Fim');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('mapping', JSON.stringify({
      case_id:          caseMap!.name,
      activity:         actMap!.name,
      timestamp_inicio: startMap!.name,
      timestamp_fim:    endMap?.name || null,
    }));
    fd.append('config', JSON.stringify({ delimiter, dayfirst }));

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 300_000);
    const resp = await fetch(this.serverUrl() + '/analyze', {
      method: 'POST', body: fd, signal: ctrl.signal,
    });
    clearTimeout(tid);

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Erro ' + resp.status }));
      throw new Error(err.error || 'Erro ' + resp.status);
    }
    return resp.json();
  }
}
