"""
pm_cache.py
Cache de DataFrame para o PM Engine.

Salva o DataFrame pré-processado (normalizado + timestamps parseados + ordenado)
em pickle após o primeiro carregamento. Na próxima análise do mesmo arquivo
(mesmo nome + tamanho + mtime), carrega o cache em ~0.5s em vez de reler o CSV.

O cache é invalidado automaticamente se o arquivo mudar.
Sem dependências externas — usa apenas stdlib + pandas.

Uso:
    from pm_cache import CacheManager
    cache = CacheManager(cache_dir="pm_cache")
    df = cache.load(path) or None   # None = cache miss
    cache.save(path, df)            # salva após processar
"""

import hashlib
import logging
import os
import pickle
import time
from pathlib import Path

logger = logging.getLogger(__name__)

# Tamanho máximo do cache em disco (bytes). Padrão: 4 GB.
CACHE_MAX_BYTES = 4 * 1024 ** 3

# Tempo máximo de vida de uma entrada (segundos). Padrão: 7 dias.
CACHE_TTL_SECONDS = 7 * 24 * 3600


def _file_key(file_path: str) -> str:
    """
    Gera chave de cache baseada em nome, tamanho e mtime do arquivo.
    Não lê o conteúdo — opera só em metadados, então é instantâneo
    mesmo para arquivos de 1.5 GB.
    """
    p = Path(file_path)
    try:
        stat = p.stat()
        raw = f"{p.name}|{stat.st_size}|{stat.st_mtime_ns}"
    except OSError:
        raw = str(file_path)
    return hashlib.md5(raw.encode()).hexdigest()


class CacheManager:
    """
    Gerencia cache de DataFrames em disco via pickle.

    Cada entrada do cache é um arquivo .pkl nomeado pelo hash dos
    metadados do arquivo original (nome + tamanho + mtime).
    Entradas são invalidadas automaticamente quando o arquivo muda.
    """

    def __init__(self, cache_dir: str = "pm_cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _cache_path(self, file_path: str) -> Path:
        key = _file_key(file_path)
        return self.cache_dir / f"{key}.pkl"

    def load(self, file_path: str):
        """
        Tenta carregar o DataFrame do cache.
        Retorna o DataFrame se cache hit, None se miss ou expirado.
        """
        cache_path = self._cache_path(file_path)
        if not cache_path.exists():
            return None

        try:
            # Verificar TTL
            age = time.time() - cache_path.stat().st_mtime
            if age > CACHE_TTL_SECONDS:
                logger.debug("Cache expirado para %s (%.0fh)", file_path, age / 3600)
                cache_path.unlink(missing_ok=True)
                return None

            t0 = time.time()
            with open(cache_path, "rb") as f:
                df = pickle.load(f)
            elapsed = time.time() - t0
            size_mb = cache_path.stat().st_size / 1e6
            logger.info("Cache hit: %s (%.1f MB, %.2fs)", Path(file_path).name, size_mb, elapsed)
            return df

        except Exception as e:
            logger.warning("Falha ao ler cache %s: %s", cache_path, e)
            cache_path.unlink(missing_ok=True)
            return None

    def save(self, file_path: str, df) -> bool:
        """
        Salva o DataFrame no cache.
        Retorna True se salvou, False se falhou ou se excederia o limite de disco.
        """
        cache_path = self._cache_path(file_path)
        try:
            # Não salvar se o cache já está cheio
            self._evict_if_needed()

            t0 = time.time()
            with open(cache_path, "wb") as f:
                pickle.dump(df, f, protocol=pickle.HIGHEST_PROTOCOL)
            elapsed = time.time() - t0
            size_mb = cache_path.stat().st_size / 1e6
            logger.info("Cache salvo: %s (%.1f MB, %.2fs)", Path(file_path).name, size_mb, elapsed)
            return True

        except Exception as e:
            logger.warning("Falha ao salvar cache: %s", e)
            try:
                cache_path.unlink(missing_ok=True)
            except Exception:
                pass
            return False

    def invalidate(self, file_path: str) -> bool:
        """Remove a entrada de cache para um arquivo específico."""
        cache_path = self._cache_path(file_path)
        if cache_path.exists():
            cache_path.unlink()
            return True
        return False

    def clear(self) -> int:
        """Remove todo o cache. Retorna número de entradas removidas."""
        count = 0
        for p in self.cache_dir.glob("*.pkl"):
            try:
                p.unlink()
                count += 1
            except Exception:
                pass
        return count

    def info(self) -> dict:
        """Retorna estatísticas do cache."""
        entries = list(self.cache_dir.glob("*.pkl"))
        total_bytes = sum(p.stat().st_size for p in entries if p.exists())
        return {
            "entries": len(entries),
            "total_mb": round(total_bytes / 1e6, 1),
            "cache_dir": str(self.cache_dir),
            "max_gb": round(CACHE_MAX_BYTES / 1e9, 1),
            "ttl_days": round(CACHE_TTL_SECONDS / 86400, 1),
        }

    def _evict_if_needed(self):
        """
        Remove entradas mais antigas se o cache total ultrapassar CACHE_MAX_BYTES.
        Estratégia LRU simples baseada em mtime.
        """
        entries = [(p, p.stat().st_size, p.stat().st_mtime)
                   for p in self.cache_dir.glob("*.pkl") if p.exists()]
        total = sum(e[1] for e in entries)

        if total < CACHE_MAX_BYTES:
            return

        # Ordenar por mtime crescente (mais antigos primeiro)
        entries.sort(key=lambda x: x[2])
        for path, size, _ in entries:
            if total < CACHE_MAX_BYTES * 0.8:
                break
            try:
                path.unlink()
                total -= size
                logger.info("Cache evicted (LRU): %s", path.name)
            except Exception:
                pass


# Instância global usada pelo pm_engine.py
_default_cache = CacheManager()


def get_default_cache() -> CacheManager:
    return _default_cache
