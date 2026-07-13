import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

export interface HtmlEditorHandle {
  getContent: () => string;
  getText: () => string;
  clearEditor: () => void;
  focus: () => void;
}

interface HtmlEditorProps {
  defaultValue?: string;
  onChange?: (content: string, text: string) => void;
  onFocus?: () => void;
  className?: string;
  placeholder?: string;
}

/**
 * Simple HTML text editor. Vue version used TinyMCE for a full WYSIWYG
 * experience; here we use a contenteditable div with basic toolbar so the
 * compose drawer stays self-contained.
 */
const HtmlEditor = forwardRef<HtmlEditorHandle, HtmlEditorProps>(function HtmlEditor(
  { defaultValue = '', onChange, onFocus, className, placeholder },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string>(defaultValue);

  useEffect(() => {
    if (editorRef.current && defaultValue !== undefined) {
      // only set if different and editor is empty
      if (editorRef.current.innerHTML !== defaultValue && !editorRef.current.innerText) {
        editorRef.current.innerHTML = defaultValue;
        lastValueRef.current = defaultValue;
      }
    }
  }, [defaultValue]);

  useImperativeHandle(
    ref,
    () => ({
      getContent: () => editorRef.current?.innerHTML ?? '',
      getText: () => editorRef.current?.innerText ?? '',
      clearEditor: () => {
        if (editorRef.current) {
          editorRef.current.innerHTML = '';
          lastValueRef.current = '';
          onChange?.('', '');
        }
      },
      focus: () => editorRef.current?.focus(),
    }),
    [onChange],
  );

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    emit();
  }

  function emit() {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const text = editorRef.current.innerText;
    lastValueRef.current = html;
    onChange?.(html, text);
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    emit();
  }

  function onInput() {
    emit();
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-1 text-sm">
        <ToolbarButton title="Bold" onClick={() => exec('bold')}><b>B</b></ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => exec('italic')}><i>I</i></ToolbarButton>
        <ToolbarButton title="Underline" onClick={() => exec('underline')}><u>U</u></ToolbarButton>
        <ToolbarButton title="Strike" onClick={() => exec('strikeThrough')}><s>S</s></ToolbarButton>
        <ToolbarButton title="Bullet list" onClick={() => exec('insertUnorderedList')}>•</ToolbarButton>
        <ToolbarButton title="Ordered list" onClick={() => exec('insertOrderedList')}>1.</ToolbarButton>
        <ToolbarButton title="Quote" onClick={() => formatBlock('BLOCKQUOTE')}>“</ToolbarButton>
        <ToolbarButton title="Code" onClick={() => exec('formatBlock', 'pre')}>&lt;/&gt;</ToolbarButton>
        <ToolbarButton title="Link" onClick={() => {
          const url = window.prompt('URL');
          if (url) exec('createLink', url);
        }}>🔗</ToolbarButton>
        <ToolbarButton title="Font size +" onClick={() => exec('fontSize', '5')}>A+</ToolbarButton>
        <ToolbarButton title="Font size -" onClick={() => exec('fontSize', '2')}>A-</ToolbarButton>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={onFocus}
        onInput={onInput}
        onPaste={onPaste}
        className="tiptap min-h-[260px] max-h-[420px] overflow-auto p-3 outline-none"
      />
    </div>
  );
});

function ToolbarButton({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="min-w-[28px] rounded px-1.5 py-0.5 text-foreground hover:bg-accent"
    >
      {children}
    </button>
  );
}

function formatBlock(tag: string) {
  document.execCommand('formatBlock', false, tag);
}

export default HtmlEditor;
