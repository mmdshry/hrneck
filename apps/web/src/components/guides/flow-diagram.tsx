import { guidesDiagramIcon } from "@/lib/guides/icons";
import type { GuideDiagram } from "@/lib/guides/types";
import { cn } from "@/lib/utils";

const NODE_WIDTH = 140;
const NODE_HEIGHT = 44;
const GAP_Y = 28;
const PAD_X = 24;
const PAD_Y = 20;

export function FlowDiagram({
  diagram,
  className,
}: {
  diagram: GuideDiagram;
  className?: string;
}) {
  const width = NODE_WIDTH + PAD_X * 2;
  const height =
    PAD_Y * 2 +
    diagram.nodes.length * NODE_HEIGHT +
    Math.max(0, diagram.nodes.length - 1) * GAP_Y;

  const positions = new Map(
    diagram.nodes.map((node, index) => [
      node.id,
      {
        x: PAD_X,
        y: PAD_Y + index * (NODE_HEIGHT + GAP_Y),
        cx: PAD_X + NODE_WIDTH / 2,
        top: PAD_Y + index * (NODE_HEIGHT + GAP_Y),
        bottom: PAD_Y + index * (NODE_HEIGHT + GAP_Y) + NODE_HEIGHT,
      },
    ]),
  );

  const DiagramIcon = guidesDiagramIcon;

  return (
    <figure
      className={cn(
        "overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-4",
        className,
      )}
    >
      <figcaption className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
        <DiagramIcon
          className="h-4 w-4 shrink-0 text-[var(--primary)]"
          aria-hidden
        />
        {diagram.title}
      </figcaption>
      <svg
        role="img"
        aria-label={diagram.title}
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto h-auto w-full max-w-xs"
      >
        {diagram.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) {
            return null;
          }
          const x = from.cx;
          const y1 = from.bottom;
          const y2 = to.top;
          const midY = (y1 + y2) / 2;
          return (
            <g key={`${edge.from}-${edge.to}-${edge.label ?? ""}`}>
              <path
                d={`M ${x} ${y1} L ${x} ${y2}`}
                fill="none"
                stroke="var(--border)"
                strokeWidth={2}
                markerEnd="url(#guide-arrow)"
              />
              {edge.label ? (
                <text
                  x={x + 8}
                  y={midY}
                  className="fill-[var(--muted-foreground)] text-[10px]"
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <defs>
          <marker
            id="guide-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--muted-foreground)" />
          </marker>
        </defs>
        {diagram.nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) {
            return null;
          }
          return (
            <g key={node.id}>
              <rect
                x={pos.x}
                y={pos.y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={10}
                fill="var(--muted)"
                stroke="var(--border)"
              />
              <text
                x={pos.cx}
                y={pos.y + NODE_HEIGHT / 2 + 4}
                textAnchor="middle"
                className="fill-[var(--foreground)] text-[11px] font-medium"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
