import React from "react";
import { MousePointer2, Maximize2, RotateCcw, Crop, Type, type LucideIcon } from "lucide-react";
import { toast } from "../../stores/notification-store";

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
  stubbed?: boolean;
}

const TOOLS: ToolItem[] = [
  { id: "move", icon: MousePointer2, label: "Move", shortcut: "V" },
  { id: "scale", icon: Maximize2, label: "Scale", shortcut: "S" },
  { id: "rotate", icon: RotateCcw, label: "Rotate", shortcut: "R" },
  { id: "crop", icon: Crop, label: "Crop", shortcut: "C", stubbed: true },
  { id: "text", icon: Type, label: "Text", shortcut: "T", stubbed: true },
];

export const ToolsRail: React.FC<ToolsRailProps> = ({
  activeTool,
  onToolChange,
}) => {
  const handleToolClick = (tool: ToolItem) => {
    onToolChange(tool.id);
    if (tool.stubbed) {
      toast.info(`${tool.label} tool — coming soon!`);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1 py-3 px-1 bg-background-secondary border-r border-border z-10">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool)}
            title={`${tool.label} (${tool.shortcut})`}
            className={`w-9 h-9 flex flex-col items-center justify-center rounded-lg transition-all group relative ${
              isActive
                ? "bg-primary/20 text-primary ring-1 ring-primary/50"
                : "text-text-muted hover:text-text-primary hover:bg-background-elevated"
            }`}
          >
            <Icon size={15} />
            <span className="text-[8px] mt-0.5 leading-none">{tool.shortcut}</span>
            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-background-elevated border border-border rounded text-[10px] text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              {tool.label}
              {tool.stubbed && (
                <span className="ml-1 text-text-muted">(soon)</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ToolsRail;
