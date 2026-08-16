import { Undo2 } from "lucide-react";

/** Bottom-corner toast shown after a delete — pairs with useUndoAction. */
export default function UndoToast({
  message,
  onUndo,
}: {
  message: string;
  onUndo: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 sm:justify-end sm:pr-8">
      <div className="animate-fade-in pointer-events-auto flex items-center gap-3 rounded-full bg-forest py-2.5 pl-4 pr-2.5 text-sm text-ivory shadow-lg">
        <span className="truncate">{message}</span>
        <button
          onClick={onUndo}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-medium text-bronze-light transition-colors hover:bg-white/15 hover:text-white"
        >
          <Undo2 size={14} /> Visszavonás
        </button>
      </div>
    </div>
  );
}
