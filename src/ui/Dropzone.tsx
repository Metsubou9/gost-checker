import { useRef, useState } from "react";

export function Dropzone({ onFile, busy }: { onFile: (f: File) => void; busy: boolean }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = () => {
    if (!busy) inputRef.current?.click();
  };

  return (
    <div
      className={`dropzone${drag ? " drag" : ""}`}
      onClick={pick}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (busy) return;
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") pick();
      }}
      aria-label="Загрузить .docx файл"
    >
      <div style={{ fontSize: 17, marginBottom: 6 }}>
        {busy ? "Обработка…" : <>Перетащите <b>.docx</b> сюда или нажмите для выбора</>}
      </div>
      <div className="small">Word 2007+ (.docx). Файл обрабатывается локально в браузере.</div>
      <input
        ref={inputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
