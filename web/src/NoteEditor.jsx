import React, { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, CheckSquare, Code, Highlighter, Italic, List, ListOrdered, Quote, Redo2, Strikethrough, Undo2,
} from 'lucide-react';
import { htmlToMarkdown } from '../../src/utils/markdown';
import { colorOf } from './colors.js';

const norm = (h) => (!h || h === '<p></p>' ? '' : h.trim());

function Btn({ on, onClick, title, disabled, children }) {
  return (
    <button type="button" className={'tb' + (on ? ' on' : '')} title={title} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

export default function NoteEditor({ note, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Image.configure({ inline: false, allowBase64: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Placeholder.configure({ placeholder: 'Escribe tu nota aquí… (admite listas, tareas, citas y pegar imágenes)' }),
    ],
    content: note.content || '',
    editorProps: {
      attributes: { class: 'tiptap', spellcheck: 'true', lang: 'es' },
      handlePaste: (view, event) => {
        for (const item of event.clipboardData?.items || []) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (!file) continue;
            const reader = new FileReader();
            reader.onload = () => reader.result && view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src: reader.result })));
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange({ content: html, markdownContent: htmlToMarkdown(html) });
    },
  });

  // Cambios que llegan de otro dispositivo para la nota abierta
  useEffect(() => {
    if (editor && norm(editor.getHTML()) !== norm(note.content)) editor.commands.setContent(note.content || '', { emitUpdate: false });
  }, [editor, note.content]);

  const tint = colorOf(note.color);
  const words = (note.markdownContent || '').trim().split(/\s+/).filter(Boolean).length;
  const c = (fn) => () => fn(editor.chain().focus()).run();

  return (
    <div className="editor" style={{ '--tint': tint.tint, '--tint-dark': tint.tintDark, '--tint-solid': tint.solid }}>
      <input className="title" value={note.title} placeholder="Título" maxLength={200} onChange={(e) => onChange({ title: e.target.value })} />
      {editor && (
        <div className="toolbar">
          <Btn title="Negrita" on={editor.isActive('bold')} onClick={c((x) => x.toggleBold())}><Bold size={16} /></Btn>
          <Btn title="Cursiva" on={editor.isActive('italic')} onClick={c((x) => x.toggleItalic())}><Italic size={16} /></Btn>
          <Btn title="Tachado" on={editor.isActive('strike')} onClick={c((x) => x.toggleStrike())}><Strikethrough size={16} /></Btn>
          <Btn title="Resaltar" on={editor.isActive('highlight')} onClick={c((x) => x.toggleHighlight())}><Highlighter size={16} /></Btn>
          <span className="sep" />
          <Btn title="Título grande" on={editor.isActive('heading', { level: 1 })} onClick={c((x) => x.toggleHeading({ level: 1 }))}>H1</Btn>
          <Btn title="Título" on={editor.isActive('heading', { level: 2 })} onClick={c((x) => x.toggleHeading({ level: 2 }))}>H2</Btn>
          <span className="sep" />
          <Btn title="Lista" on={editor.isActive('bulletList')} onClick={c((x) => x.toggleBulletList())}><List size={16} /></Btn>
          <Btn title="Lista numerada" on={editor.isActive('orderedList')} onClick={c((x) => x.toggleOrderedList())}><ListOrdered size={16} /></Btn>
          <Btn title="Tareas" on={editor.isActive('taskList')} onClick={c((x) => x.toggleTaskList())}><CheckSquare size={16} /></Btn>
          <Btn title="Cita" on={editor.isActive('blockquote')} onClick={c((x) => x.toggleBlockquote())}><Quote size={16} /></Btn>
          <Btn title="Código" on={editor.isActive('codeBlock')} onClick={c((x) => x.toggleCodeBlock())}><Code size={16} /></Btn>
          <span className="grow" />
          <Btn title="Deshacer" disabled={!editor.can().undo()} onClick={c((x) => x.undo())}><Undo2 size={16} /></Btn>
          <Btn title="Rehacer" disabled={!editor.can().redo()} onClick={c((x) => x.redo())}><Redo2 size={16} /></Btn>
        </div>
      )}
      <div className="paper"><EditorContent editor={editor} /></div>
      <footer className="editor-foot">{words} {words === 1 ? 'palabra' : 'palabras'}</footer>
    </div>
  );
}
