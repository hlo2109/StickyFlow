import React, { useState, useEffect } from 'react';
import { ExternalLink, Cloud, HardDrive, Download, Upload, History, FileJson, CheckCircle2, Trash2 } from 'lucide-react';
import { AppSettings, BackupStatusInfo, BackupFileItem, DbMode, RemoteDbProvider } from '../../../types';
import { SettingsTabProps } from '../types';

function pathNormalize(p?: string): string {
  if (!p) return '';
  return p.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
}

/** Copias de seguridad, carpeta en la nube y base de datos remota. */
export const DatabaseTab: React.FC<SettingsTabProps> = ({ formData, setFormData, onOpenNotesFolder }) => {
  const [showRemoteDbKey, setShowRemoteDbKey] = useState(false);
  const [backupInfo, setBackupInfo] = useState<BackupStatusInfo | null>(null);
  const [backupsList, setBackupsList] = useState<BackupFileItem[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [showAdvancedDb, setShowAdvancedDb] = useState(false);
  const [showBackupHistory, setShowBackupHistory] = useState(false);

  const [isCleaningGarbage, setIsCleaningGarbage] = useState(false);
  const [garbageCleanResult, setGarbageCleanResult] = useState<string | null>(null);

  const refreshBackupData = () => {
    if (window.electronAPI?.getBackupInfo) {
      window.electronAPI.getBackupInfo().then((info) => {
        setBackupInfo(info);
      }).catch(() => {});
    }
    if (window.electronAPI?.listBackups) {
      window.electronAPI.listBackups().then((list) => {
        setBackupsList(list);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    refreshBackupData();
  }, []);

  const handleCleanGarbage = async () => {
    if (!window.electronAPI?.cleanNotesGarbage) return;
    setIsCleaningGarbage(true);
    setGarbageCleanResult(null);
    try {
      const res = await window.electronAPI.cleanNotesGarbage();
      if (res && res.success) {
        setGarbageCleanResult(`🧹 ¡Limpieza completa! Se eliminaron ${res.removedCount} elementos de basura/huérfanos. Quedan ${res.remainingCount} notas activas reales.`);
        refreshBackupData();
        setTimeout(() => setGarbageCleanResult(null), 6000);
      } else {
        alert('No se pudo completar la limpieza: ' + (res.error || 'Error desconocido'));
      }
    } catch (err: any) {
      alert('Error al limpiar basura: ' + err.message);
    } finally {
      setIsCleaningGarbage(false);
    }
  };

  const handleCreateBackupNow = async () => {
    if (!window.electronAPI?.createBackup) return;
    setIsCreatingBackup(true);
    setBackupSuccessMessage('');
    try {
      const res = await window.electronAPI.createBackup();
      if (res && res.success) {
        setBackupSuccessMessage(`¡Copia de seguridad guardada! (${res.notesCount || 0} notas, ${res.size})`);
        refreshBackupData();
        setTimeout(() => setBackupSuccessMessage(''), 5000);
      } else {
        alert(res.error || 'No se pudo crear la copia de seguridad.');
      }
    } catch (e: any) {
      alert('Error creando respaldo: ' + e.message);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreFromPath = async (filePath?: string) => {
    if (!window.electronAPI?.restoreBackup) return;
    const ok = window.confirm('¿Deseas restaurar esta copia de seguridad? Tus notas se sincronizarán con este respaldo.');
    if (!ok) return;

    setIsRestoring(true);
    try {
      const res = await window.electronAPI.restoreBackup(filePath);
      if (res && res.success) {
        setBackupSuccessMessage(`¡Copia restaurada con éxito! (${res.count || 0} notas cargadas)`);
        refreshBackupData();
        setTimeout(() => setBackupSuccessMessage(''), 5000);
      } else {
        alert(res.error || 'No se pudo restaurar la copia.');
      }
    } catch (e: any) {
      alert('Error al restaurar: ' + e.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleImportBackup = async () => {
    if (!window.electronAPI?.importBackupDialog) return;
    setIsRestoring(true);
    try {
      const res = await window.electronAPI.importBackupDialog();
      if (res && res.success) {
        setBackupSuccessMessage(`¡Copia importada con éxito! (${res.count || 0} notas restauradas)`);
        refreshBackupData();
        setTimeout(() => setBackupSuccessMessage(''), 5000);
      } else if (res && res.error) {
        alert(res.error);
      }
    } catch (e: any) {
      alert('Error importando copia: ' + e.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExportBackup = async () => {
    if (!window.electronAPI?.exportBackupDialog) return;
    try {
      const res = await window.electronAPI.exportBackupDialog();
      if (res && res.success) {
        setBackupSuccessMessage('Copia de seguridad exportada con éxito.');
        setTimeout(() => setBackupSuccessMessage(''), 4000);
      }
    } catch (e: any) {
      alert('Error exportando: ' + e.message);
    }
  };

  const handleChangeStorageFolder = async (folderPath: string) => {
    if (!window.electronAPI?.changeStorageDir) return;
    try {
      const res = await window.electronAPI.changeStorageDir(folderPath, true);
      if (res && res.success) {
        refreshBackupData();
        setBackupSuccessMessage('Carpeta de sincronización actualizada.');
        setTimeout(() => setBackupSuccessMessage(''), 4000);
      }
    } catch (e: any) {
      alert('Error cambiando carpeta: ' + e.message);
    }
  };

  const handleSelectCustomFolder = async () => {
    if (!window.electronAPI?.selectFolderDialog) return;
    try {
      const folder = await window.electronAPI.selectFolderDialog();
      if (folder) {
        await handleChangeStorageFolder(folder);
      }
    } catch (e: any) {
      alert('Error seleccionando carpeta: ' + e.message);
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in">
      <div>
        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <Cloud size={16} className="text-emerald-600 dark:text-emerald-400" />
          Copia de Seguridad & Nube
        </h4>
        <p className="text-[11px] text-slate-500">
          Respaldo y sincronización automática sin configuraciones complejas. Tus notas se respaldan en tu nube personal (OneDrive / Google Drive) con 1 solo clic.
        </p>
      </div>

      {garbageCleanResult && (
        <div className="p-2 bg-blue-100 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800 rounded-lg text-blue-900 dark:text-blue-200 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={15} className="text-blue-600 shrink-0" />
          <span className="font-medium">{garbageCleanResult}</span>
        </div>
      )}

      {/* 0. GARBAGE CLEANUP CARD */}
      <div className="flex items-center justify-between p-2.5 bg-slate-100/90 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
        <div className="pr-2">
          <span className="font-bold block text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Trash2 size={14} className="text-amber-500" />
            Limpieza de Basura y Archivos Obsoletos
          </span>
          <span className="text-[10px] text-slate-500">
            Elimina notas vacías, fantasmas y archivos .md de notas borradas para que tu copia contenga exactamente tus notas reales.
          </span>
        </div>
        <button
          type="button"
          onClick={handleCleanGarbage}
          disabled={isCleaningGarbage}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 active:scale-95 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
        >
          <span>{isCleaningGarbage ? 'Limpiando...' : '🧹 Limpiar Basura'}</span>
        </button>
      </div>

      {backupSuccessMessage && (
        <div className="p-2 bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 rounded-lg text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          <span className="font-medium">{backupSuccessMessage}</span>
        </div>
      )}

      {/* 1. BACKUP STATUS CARD */}
      <div className="p-3 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 dark:from-emerald-950/40 dark:to-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/60 space-y-2.5 shadow-2xs">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <HardDrive size={15} className="text-emerald-600" />
              <span className="font-bold text-xs text-emerald-950 dark:text-emerald-100">
                Estado de Copia de Seguridad
              </span>
            </div>
            <div className="text-[11px] text-emerald-900/90 dark:text-emerald-200/90">
              Última copia:{' '}
              <strong className="text-emerald-950 dark:text-white">
                {backupInfo?.lastBackupTime
                  ? new Date(backupInfo.lastBackupTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                  : (formData.lastBackupTime ? new Date(formData.lastBackupTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Nunca realizada')}
              </strong>
            </div>
            <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
              Tamaño:{' '}
              {backupInfo?.lastBackupSize || formData.lastBackupSize || '0 KB'} •{' '}
              {backupInfo?.backupCount || backupsList.length} copias guardadas
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateBackupNow}
            disabled={isCreatingBackup}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Download size={13} className={isCreatingBackup ? 'animate-bounce' : ''} />
            <span>{isCreatingBackup ? 'Guardando...' : 'Hacer Copia Ahora'}</span>
          </button>
        </div>

        {/* Secondary Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 text-[11px]">
          <button
            type="button"
            onClick={handleImportBackup}
            disabled={isRestoring}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
          >
            <Upload size={12} className="text-emerald-600" />
            <span>Restaurar Copia...</span>
          </button>

          <button
            type="button"
            onClick={handleExportBackup}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
          >
            <FileJson size={12} className="text-blue-600" />
            <span>Exportar Archivo (.json)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBackupHistory(!showBackupHistory)}
            className="ml-auto text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
          >
            <History size={11} />
            <span>{showBackupHistory ? 'Ocultar Historial' : `Historial (${backupsList.length})`}</span>
          </button>
        </div>

        {/* Expandable Backup History */}
        {showBackupHistory && (
          <div className="p-2 bg-white/80 dark:bg-slate-900/80 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40 space-y-1.5 max-h-36 overflow-y-auto animate-in fade-in">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Copias de seguridad disponibles en tu equipo:
            </div>
            {backupsList.length === 0 ? (
              <div className="text-[11px] text-slate-400 py-1">No hay copias previas aún. Haz clic en "Hacer Copia Ahora".</div>
            ) : (
              backupsList.map((b) => (
                <div
                  key={b.fileName}
                  className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 text-[11px]"
                >
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">{b.fileName}</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(b.time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} • {b.size} • {b.notesCount} notas
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestoreFromPath(b.filePath)}
                    className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-semibold border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                  >
                    Restaurar
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 2. CLOUD SYNC LOCATION SELECTOR (ZERO SETUP) */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
        <div>
          <span className="font-semibold block text-slate-800 dark:text-slate-100 text-xs">
            Ubicación de Sincronización en la Nube
          </span>
          <span className="text-[10px] text-slate-500">
            Tus notas se sincronizan automáticamente con la nube mediante tu carpeta personal:
          </span>
        </div>

        {/* Cloud Providers Detected Grid */}
        <div className="grid grid-cols-2 gap-2">
          {(backupInfo?.detectedClouds || []).map((cloud) => {
            const isCurrent = backupInfo?.activeStorageDir ? pathNormalize(backupInfo.activeStorageDir) === pathNormalize(cloud.path) : false;
            return (
              <button
                key={cloud.id}
                type="button"
                onClick={() => handleChangeStorageFolder(cloud.path)}
                className={`p-2 rounded-lg border text-left flex items-start gap-2 transition-all cursor-pointer ${
                  isCurrent
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-base mt-0.5">
                  {cloud.type === 'onedrive' ? '☁️' : cloud.type === 'gdrive' ? '📁' : cloud.type === 'dropbox' ? '📦' : cloud.type === 'icloud' ? '🍏' : '💻'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold truncate text-slate-800 dark:text-slate-100">
                      {cloud.name}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold shrink-0">
                        ACTIVA
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {cloud.exists ? (cloud.isCloud ? 'Sincronizado en tiempo real' : 'Carpeta local') : 'No detectada'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Path Display & Custom Folder Button */}
        <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
          <div className="truncate pr-2 text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-500">Ruta: </span>
            <code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
              {backupInfo?.activeStorageDir || 'Documentos\\StickyFlow_Notas'}
            </code>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleSelectCustomFolder}
              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded text-[10px] font-medium border border-slate-300 dark:border-slate-700 cursor-pointer"
            >
              Cambiar carpeta...
            </button>
            <button
              type="button"
              onClick={onOpenNotesFolder}
              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              title="Abrir en el Explorador de Windows"
            >
              <ExternalLink size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. AUTO-BACKUP FREQUENCY */}
      <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
        <div>
          <span className="font-semibold block text-slate-800 dark:text-slate-200 text-xs">
            Copia de Seguridad Automática
          </span>
          <span className="text-[10px] text-slate-500">
            Crea un respaldo automático periódico en tu nube sin interrumpirte
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={formData.autoBackupFrequency || 'daily'}
            onChange={(e) => setFormData({ ...formData, autoBackupFrequency: e.target.value as any })}
            className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-[11px] font-medium"
          >
            <option value="daily">Diaria (WhatsApp)</option>
            <option value="weekly">Semanal</option>
            <option value="manual">Solo manual</option>
          </select>
          <input
            type="checkbox"
            checked={formData.autoBackupEnabled !== false}
            onChange={(e) => setFormData({ ...formData, autoBackupEnabled: e.target.checked })}
            className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
          />
        </div>
      </div>

      {/* 4. ADVANCED REMOTE DB (COLLAPSIBLE) */}
      <div className="pt-0.5">
        <button
          type="button"
          onClick={() => setShowAdvancedDb(!showAdvancedDb)}
          className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
        >
          <span>⚙️ Opciones avanzadas de Base de Datos externa (Supabase / Cloudflare D1)</span>
          <span className="text-[9px]">{showAdvancedDb ? '▲' : '▼'}</span>
        </button>

        {showAdvancedDb && (
          <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, dbMode: 'local' })}
                className={`p-2 rounded border text-left text-xs ${formData.dbMode !== 'remote' ? 'border-emerald-600 font-bold bg-white dark:bg-slate-900' : 'border-slate-200 dark:border-slate-700'}`}
              >
                Modo Normal (Local + Nube OneDrive/Google Drive)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, dbMode: 'remote' })}
                className={`p-2 rounded border text-left text-xs ${formData.dbMode === 'remote' ? 'border-blue-600 font-bold bg-white dark:bg-slate-900' : 'border-slate-200 dark:border-slate-700'}`}
              >
                Conectar Servidor SQL / REST Remoto
              </button>
            </div>

            {formData.dbMode === 'remote' && (
              <div className="space-y-2 pt-1">
                <div>
                  <label className="text-[10px] text-slate-500 block">Proveedor</label>
                  <select
                    value={formData.remoteDbProvider || 'supabase'}
                    onChange={(e) => setFormData({ ...formData, remoteDbProvider: e.target.value as any })}
                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                  >
                    <option value="supabase">Supabase (PostgreSQL / REST)</option>
                    <option value="cloudflare_d1">Cloudflare D1</option>
                    <option value="rest">API REST</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block">URL de la Base de Datos</label>
                  <input
                    type="text"
                    value={formData.remoteDbUrl || ''}
                    onChange={(e) => setFormData({ ...formData, remoteDbUrl: e.target.value })}
                    placeholder="https://xyz.supabase.co"
                    className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block">API Key</label>
                  <input
                    type="password"
                    value={formData.remoteDbApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, remoteDbApiKey: e.target.value })}
                    className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
