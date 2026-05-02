import React from "react";
import { MousePointer2, Maximize2, RotateCcw, type LucideIcon } from "lucide-react";

export type CanvasTool = "move" | "scale" | "rotate" | "crop" | "text";

interface ToolsRailProps {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
}

interface ToolItem {
  id: CanvasTool;
  icon: LucideIcon;
  label: string;
  shortcut: string;
}

const TOOLS: ToolItem[] = [
  { id: "move",   icon: MousePointer2, label: "Move",   shortcut: "V" },
  { id: "scale",  icon: Maximize2,     label: "Scale",  shortcut: "S" },
  { id: "rotate", icon: RotateCcw,     label: "Rotate", shortcut: "R" },
];

export const ToolsRail: React.FC<ToolsRailProps> = ({
  activeTool,
  onToolChange,
}) => (
  <div className="flex flex-col items-center gap-1 py-3 px-1 bg-background-secondary border-r border-border z-10">
    {TOOLS.map((tool) => {
      const Icon = tool.icon;
      const isActive = activeTool === tool.id;
      return (
        <div key={tool.id} className="relative group">
          <button
            onClick={() => onToolChange(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            aria-label={tool.label}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
              isActive
                ? "bg-primary/20 text-primary ring-1 ring-primary/50"
                : "text-text-muted hover:text-text-primary hover:bg-background-elevated"
            }`}
          >
            <Icon size={16} />
          </button>
          {/* Tooltip — visible only on hover */}
          <div
            role="tooltip"
            className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-background-elevated border border-border rounded text-[10px] text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
          >
            {tool.label}
            <span className="ml-1 text-text-muted">({tool.shortcut})</span>
          </div>
        </div>
      );
    })}
  </div>
);

export default ToolsRail;
