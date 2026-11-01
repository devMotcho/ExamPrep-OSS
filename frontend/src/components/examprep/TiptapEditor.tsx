import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  List, ListOrdered, Quote, WrapText, Undo, Redo
} from 'lucide-react';

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  value,
  onChange,
  placeholder,
  editable = true
}) => {
  const { t } = useTranslation();
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {},
        orderedList: {},
      }),
      Underline,
      Strike,
      Placeholder.configure({
        placeholder: placeholder ?? t('editor.placeholder', 'Write here...'),
      }),
    ],
    content: value,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (event.key === 'Tab') {
          if (editor?.isActive('bulletList') || editor?.isActive('orderedList')) {
            return false;
          }
          event.preventDefault();
          editor?.commands.insertContent('    ');
          return true;
        }
        return false;
      }
    }
  });

  React.useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const handleEditorClick = () => {
    editor.commands.focus();
  };

  if (!editable) {
    return (
      <div className="tiptap-editor-container max-w-none p-4 rounded-xl border bg-muted/20 text-foreground">
        <style>{`
          .tiptap {
            outline: none;
          }
          .tiptap ul {
            list-style-type: disc !important;
            padding-left: 1.5rem !important;
            margin-top: 0.5rem !important;
            margin-bottom: 0.5rem !important;
          }
          .tiptap ol {
            list-style-type: decimal !important;
            padding-left: 1.5rem !important;
            margin-top: 0.5rem !important;
            margin-bottom: 0.5rem !important;
          }
          .tiptap li {
            margin-bottom: 0.25rem !important;
          }
          .tiptap blockquote {
            border-left: 4px solid hsl(var(--primary) / 0.3) !important;
            padding-left: 1rem !important;
            font-style: italic !important;
            margin: 0.5rem 0 !important;
            color: hsl(var(--muted-foreground)) !important;
          }
          .tiptap code {
            background-color: hsl(var(--muted)) !important;
            color: hsl(var(--primary)) !important;
            font-family: monospace !important;
            padding: 0.1rem 0.3rem !important;
            border-radius: 0.25rem !important;
            font-size: 0.85em !important;
          }
          .tiptap strong {
            font-weight: bold !important;
          }
          .tiptap em {
            font-style: italic !important;
          }
          .tiptap u {
            text-decoration: underline !important;
          }
          .tiptap s {
            text-decoration: line-through !important;
          }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className="tiptap-editor-container border border-border/80 rounded-xl overflow-hidden transition-all bg-background">
      <style>{`
        .tiptap {
          outline: none;
          min-height: 120px;
        }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          opacity: 0.6;
          pointer-events: none;
          height: 0;
        }
        .tiptap ul {
          list-style-type: disc !important;
          padding-left: 1.5rem !important;
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }
        .tiptap ol {
          list-style-type: decimal !important;
          padding-left: 1.5rem !important;
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }
        .tiptap li {
          margin-bottom: 0.25rem !important;
        }
        .tiptap blockquote {
          border-left: 4px solid hsl(var(--primary) / 0.3) !important;
          padding-left: 1rem !important;
          font-style: italic !important;
          margin: 0.5rem 0 !important;
          color: hsl(var(--muted-foreground)) !important;
        }
        .tiptap code {
          background-color: hsl(var(--muted)) !important;
          color: hsl(var(--primary)) !important;
          font-family: monospace !important;
          padding: 0.1rem 0.3rem !important;
          border-radius: 0.25rem !important;
          font-size: 0.85em !important;
        }
        .tiptap strong {
          font-weight: bold !important;
        }
        .tiptap em {
          font-style: italic !important;
        }
        .tiptap u {
          text-decoration: underline !important;
        }
        .tiptap s {
          text-decoration: line-through !important;
        }
        .tiptap-editor-container:focus-within {
          border-color: hsl(var(--primary)) !important;
          box-shadow: 0 0 0 2px hsl(var(--primary) / 0.15) !important;
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/40 border-b border-border">
        <Button
          aria-label={t('editor.bold', 'Bold')}
          title={t('editor.bold', 'Bold')}
          type="button"
          variant={editor.isActive('bold') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 w-8 p-0 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-primary text-primary-foreground hover:bg-primary/95' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          aria-label={t('editor.italic', 'Italic')}
          title={t('editor.italic', 'Italic')}
          type="button"
          variant={editor.isActive('italic') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 w-8 p-0 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-primary text-primary-foreground hover:bg-primary/95' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          aria-label={t('editor.underline', 'Underline')}
          title={t('editor.underline', 'Underline')}
          type="button"
          variant={editor.isActive('underline') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 w-8 p-0 rounded-lg transition-colors ${editor.isActive('underline') ? 'bg-primary text-primary-foreground hover:bg-primary/95' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          aria-label={t('editor.strikethrough', 'Strikethrough')}
          title={t('editor.strikethrough', 'Strikethrough')}
          type="button"
          variant={editor.isActive('strike') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 w-8 p-0 rounded-lg transition-colors ${editor.isActive('strike') ? 'bg-primary text-primary-foreground hover:bg-primary/95' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          aria-label={t('editor.code', 'Code')}
          title={t('editor.code', 'Code')}
          type="button"
          variant={editor.isActive('code') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 w-8 p-0 rounded-lg transition-colors ${editor.isActive('code') ? 'bg-primary text-primary-foreground hover:bg-primary/95' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-4 w-4" />
        </Button>

        <div className="w-[1px] h-6 bg-border mx-1" />

        <Button
          aria-label={t('editor.bulletlist', 'Bullet list')}
          title={t('editor.bulletlist', 'Bullet list')}
          type="button"
          variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 w-8 p-0 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-primary text-primary-foreground hover:bg-primary/95' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          aria-label={t('editor.numberedlist', 'Numbered list')}
          title={t('editor.numberedlist', 'Numbered list')}
          type="button"
          variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 w-8 p-0 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-primary text-primary-foreground hover:bg-primary/95' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          aria-label={t('editor.quote', 'Quote')}
          title={t('editor.quote', 'Quote')}
          type="button"
          variant={editor.isActive('blockquote') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 w-8 p-0 rounded-lg transition-colors ${editor.isActive('blockquote') ? 'bg-primary text-primary-foreground hover:bg-primary/95' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          aria-label={t('editor.linebreak', 'Line break')}
          title={t('editor.linebreak', 'Line break')}
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => editor.chain().focus().setHardBreak().run()}
        >
          <WrapText className="h-4 w-4" />
        </Button>

        <div className="w-[1px] h-6 bg-border mx-1" />

        <Button
          aria-label={t('editor.undo', 'Undo')}
          title={t('editor.undo', 'Undo')}
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          aria-label={t('editor.redo', 'Redo')}
          title={t('editor.redo', 'Redo')}
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor Content Area */}
      <div 
        onClick={handleEditorClick}
        className="p-4 bg-background min-h-[140px] max-h-[300px] overflow-y-auto cursor-text focus:outline-none"
      >
        <EditorContent editor={editor} className="outline-none" />
      </div>
    </div>
  );
};
