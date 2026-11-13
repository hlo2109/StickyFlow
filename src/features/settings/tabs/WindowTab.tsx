import React from 'react';
import { Sliders, FolderOpen, ExternalLink, StickyNote } from 'lucide-react';
import { AppSettings } from '../../../types';
import { SettingsTabProps } from '../types';

/** Comportamiento de la ventana, opacidad y dock de separadores. */
export const WindowTab: React.FC<SettingsTabProps> = ({ formData, setFormData, onOpenNotesFolder }) => {
  return (
    <div className="space-y-3 animate-in fade-in">
      <div>
        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <Sliders size={16} className="text-slate-600 dark:text-slate-300" />
          Comportamiento de Ventana & Sistema
        </h4>
        <p className="text-[11px] text-slate-500">Ajustes visuales y acceso directo a archivos.</p>
      </div>

      <div className="space-y-3">
        {/* Inicio discreto con solo separadores */}
        <div className="flex items-center justify-between p-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
          <div className="pr-2">
            <span className="font-semibold block text-emerald-950 dark:text-emerald-200 text-xs">
              Al Iniciar la PC: Mostrar solo pestañas pequeñas (Dock)
            </span>
            <span className="text-[10px] text-emerald-800/80 dark:text-emerald-300/80">
              No abre la ventana grande al arrancar la PC; únicamente muestra los separadores discretos en el borde. Las notas se abren cuando haces clic en ellas.
            </span>
          </div>
          <input
            type="checkbox"
            checked={formData.startDockOnly !== false}
            onChange={(e) => setFormData({ ...formData, startDockOnly: e.target.checked })}
            className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer shrink-0"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold block text-slate-700 dark:text-slate-200">Icono en la bandeja del sistema</span>
            <span className="text-[10px] text-slate-500">
              Acceso rápido junto al reloj de Windows: Reunión, Entrevista, Nota de voz y Ajustes con un clic
            </span>
          </div>
          <input
            type="checkbox"
            checked={formData.showTrayIcon !== false}
            onChange={(e) => setFormData({ ...formData, showTrayIcon: e.target.checked })}
            className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer shrink-0"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold block text-slate-700 dark:text-slate-200">Siempre Flotante por Defecto</span>
            <span className="text-[10px] text-slate-500">Fija la ventana por encima de todas las aplicaciones</span>
          </div>
          <input
            type="checkbox"
            checked={formData.alwaysOnTop}
            onChange={(e) => setFormData({ ...formData, alwaysOnTop: e.target.checked })}
            className="w-4 h-4 rounded text-blue-600"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Opacidad de la Ventana ({Math.round((formData.opacity || 1) * 100)}%)
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.0"
            step="0.05"
            value={formData.opacity || 0.98}
            onChange={(e) => setFormData({ ...formData, opacity: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>

        {/* SECCIÓN DE SEPARADORES DE CUADERNO / DOCK */}
        <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <StickyNote size={15} className="text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-xs text-amber-950 dark:text-amber-200">
                Separadores de Cuaderno en Pantalla (Dock)
              </span>
            </div>
            <input
              type="checkbox"
              checked={formData.dockEnabled !== false}
              onChange={(e) => setFormData({ ...formData, dockEnabled: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600"
            />
          </div>

          <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
            Agrupa tus notas ancladas como pequeños separadores centrados en el borde de tu pantalla. Al pasar el cursor se expande una descripción completa, sin saturar la barra de tareas de Windows.
          </p>

          {formData.dockEnabled !== false && (
            <div className="space-y-2.5 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
              {/* Position selector */}
              <div>
                <label className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 block mb-1">
                  Borde de la pantalla:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'left', label: 'Izquierda', icon: '⬅️' },
                    { id: 'right', label: 'Derecha', icon: '➡️' },
                    { id: 'top', label: 'Arriba', icon: '⬆️' },
                    { id: 'bottom', label: 'Abajo', icon: '⬇️' }
                  ].map((pos) => {
                    const isSelected = (formData.dockPosition || 'right') === pos.id;
                    return (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, dockPosition: pos.id as any })}
                        className={`py-1.5 px-2 rounded-md border text-center transition-all text-xs font-medium flex flex-col items-center gap-0.5 ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-amber-100/50'
                        }`}
                      >
                        <span>{pos.icon}</span>
                        <span className="text-[10px]">{pos.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Show / Hide Titles toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                <div>
                  <span className="font-medium text-[11px] text-amber-950 dark:text-amber-200 block">
                    Mostrar nombres de notas en los separadores
                  </span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400">
                    {formData.dockShowTitles !== false
                      ? 'Nombre visible en cada pestaña'
                      : 'Modo discreto / compacto (solo pestaña de color)'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.dockShowTitles !== false}
                  onChange={(e) => setFormData({ ...formData, dockShowTitles: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600"
                />
              </div>

              {/* Always on top toggle for dock */}
              <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                <div>
                  <span className="font-medium text-[11px] text-amber-950 dark:text-amber-200 block">
                    Separadores siempre visibles (Fijos e independientes)
                  </span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400">
                    {formData.dockAlwaysOnTop !== false
                      ? 'Permanece siempre fijo en el borde sin afectarse si desanclas la ventana grande'
                      : 'Permite que otras ventanas cubran los separadores'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.dockAlwaysOnTop !== false}
                  onChange={(e) => setFormData({ ...formData, dockAlwaysOnTop: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900 space-y-1.5">
          <span className="font-semibold text-xs text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
            <FolderOpen size={14} className="text-blue-600" />
            Carpeta Local de Notas (.md)
          </span>
          <p className="text-[11px] text-blue-800 dark:text-blue-300">
            Ubicación: <code>Documentos\StickyFlow_Notas</code> (Sincronizada para Claude y Cursor).
          </p>
          <button
            type="button"
            onClick={onOpenNotesFolder}
            className="mt-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-medium flex items-center gap-1 shadow-xs"
          >
            <ExternalLink size={12} />
            Abrir carpeta de notas
          </button>
        </div>
      </div>
    </div>
  );
};
