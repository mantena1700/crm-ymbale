'use client';

import { useState } from 'react';
import { importExcelFile } from '../actions';
import styles from './ImportExcel.module.css';

export default function ImportExcelClient() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    imported?: number;
    skipped?: number;
    errors?: number;
    processed?: number;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      // Adicionar todos os arquivos
      files.forEach((file, index) => {
        formData.append(`files`, file);
      });

      const result = await importExcelFile(formData);
      setResult(result);
      
      if (result.success) {
        setFiles([]);
        // Reset file input
        const fileInput = document.getElementById('excel-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Erro ao importar planilhas'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Faça upload de planilhas Excel (.xlsx, .xls) ou arquivos de texto (.txt, .csv) para importar restaurantes automaticamente.
        Os leads serão direcionados para os vendedores baseado na região. Você pode selecionar vários arquivos de uma vez!
      </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fileInputWrapper}>
            <input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls,.txt,.csv"
              multiple
              onChange={handleFileChange}
              className={styles.fileInput}
              disabled={loading}
            />
            <label htmlFor="excel-file" className={styles.fileLabel}>
              {files.length > 0 
                ? `${files.length} arquivo(s) selecionado(s)` 
                : '📄 Escolher arquivo(s) - Excel (.xlsx, .xls) ou Texto (.txt, .csv)'}
            </label>
          </div>

          {files.length > 0 && (
            <div className={styles.filesList}>
              <strong>Arquivos selecionados:</strong>
              <ul>
                {files.map((file, index) => (
                  <li key={index}>{file.name}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="submit"
            disabled={files.length === 0 || loading}
            className={styles.submitButton}
          >
            {loading ? '⏳ Importando...' : `🚀 Importar ${files.length > 0 ? files.length : ''} Arquivo(s)`}
          </button>
        </form>

        {result && (
          <div className={`${styles.result} ${result.success ? styles.success : styles.error}`}>
            <h3>{result.success ? '✅ Sucesso!' : '❌ Erro'}</h3>
            <p>{result.message}</p>
            {result.imported !== undefined && (
              <div className={styles.stats}>
                {result.processed !== undefined && (
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{result.processed}</span>
                    <span className={styles.statLabel}>Planilhas Processadas</span>
                  </div>
                )}
                <div className={styles.stat}>
                  <span className={styles.statValue}>{result.imported}</span>
                  <span className={styles.statLabel}>Restaurantes Importados</span>
                </div>
                {result.skipped !== undefined && (
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{result.skipped}</span>
                    <span className={styles.statLabel}>Ignorados (duplicados)</span>
                  </div>
                )}
                {result.errors !== undefined && result.errors > 0 && (
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{result.errors}</span>
                    <span className={styles.statLabel}>Erros</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className={styles.info}>
          <h3>ℹ️ Informações:</h3>
          <ul>
            <li>✅ Restaurantes duplicados serão ignorados automaticamente</li>
            <li>👥 Leads serão atribuídos aos vendedores baseado na cidade</li>
            <li>📊 Todos os comentários serão importados</li>
            <li>🔄 Você pode importar múltiplas planilhas</li>
          </ul>
        </div>
    </div>
  );
}

