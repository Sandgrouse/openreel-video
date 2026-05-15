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
  { id: "scale",  icon: Maximize2,     label: "Scale",  shortcut: "E" },
  { id: "rotate", icon: RotateCcw,     label: "Rotate", shortcut: "R" },
];

export const ToolsRail: React.FC<ToolsRailProps> = ({
  activeTool,
  onToolChange,
}) => (
  <div className="flex items-center gap-1">
    {TOOLS.map((tool) => {
      const Icon = tool.icon;
      const isActive = activeTool === tool.id;
      return (
        <button
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
          title={`${tool.label} (${tool.shortcut})`}
          aria-label={tool.label}
          className={`p-2 rounded-lg transition-colors ${
            isActive
              ? "text-primary bg-primary/20"
              : "text-text-secondary hover:text-text-primary hover:bg-background-elevated"
          }`}
        >
          <Icon size={16} />
        </button>
      );
    })}
  </div>
);

export default ToolsRail;
