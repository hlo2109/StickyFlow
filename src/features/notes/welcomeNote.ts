import { Note } from '../../types';

/** Nota que se crea la primera vez (o cuando no queda ninguna con contenido). */
export const INITIAL_WELCOME_NOTE: Note = {
  id: 'welcome-1',
  title: '👋 ¡Bienvenido a StickyFlow!',
  content: `<h2>📌 Tu Bloc de Notas Flotante e Inteligente</h2>
<p>Esta es tu nueva aplicación de notas tipo <strong>sticky note</strong> para Windows, siempre flotante, rápida y sin lag.</p>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Ventana flotante configurable (📌 arriba a la izquierda)</p></div></li>
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Lista de notas en su propia ventana (botón de lista o Ctrl+B)</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Configurar tu clave API en ⚙️ Ajustes</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Probar el botón <strong>✨ IA</strong> (Resumir, Crear nota desde ideas o RAG)</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Presionar <strong>🎙️ Dictar</strong> para escribir con tu voz</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Presionar <strong>📅 Fecha</strong> para registrar en la bitácora</p></div></li>
</ul>
<p>💡 <em>Tip: Puedes pegar imágenes directamente con <strong>Ctrl+V</strong> o cambiar a modo Markdown puro en cualquier momento.</em></p>`,
  markdownContent: `## 📌 Tu Bloc de Notas Flotante e Inteligente

Esta es tu nueva aplicación de notas tipo **sticky note** para Windows, siempre flotante, rápida y sin lag.

- [x] Ventana flotante configurable (📌 arriba a la izquierda)
- [x] Lista de notas en su propia ventana (botón de lista o Ctrl+B)
- [ ] Configurar tu clave API en ⚙️ Ajustes
- [ ] Probar el botón **✨ IA** (Resumir, Crear nota desde ideas o RAG)
- [ ] Presionar **🎙️ Dictar** para escribir con tu voz
- [ ] Presionar **📅 Fecha** para registrar en la bitácora

💡 *Tip: Puedes pegar imágenes directamente con **Ctrl+V** o cambiar a modo Markdown puro en cualquier momento.*`,
  color: 'yellow',
  isPinned: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tags: ['bienvenida', 'guía'],
  bitacora: [
    {
      id: 'b-init',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action: 'creacion',
      summary: 'Nota de bienvenida creada automáticamente'
    }
  ]
};
