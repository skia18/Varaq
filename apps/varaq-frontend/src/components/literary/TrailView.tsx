import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpLeft,
  AudioLines,
  Camera,
  Feather,
  Palette,
  Play,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { FeedPiece, PieceMedium, TrailGraph, TrailRelation } from '@/lib/api';
import { publicMediaUrl } from '@/features/media/storage';
import { LoadingState } from '@/components/ui/LoadingState';

const mediumLabel = (medium?: PieceMedium) =>
  medium === 'photography'
    ? 'Photograph'
    : medium === 'artwork'
      ? 'Artwork'
      : medium === 'audio'
        ? 'Audio'
        : 'Writing';
const relationLabel = (relation: TrailRelation) =>
  relation === 'continues' ? 'Continues the thread' : 'Inspired by';
function MediumIcon({ medium }: { medium?: PieceMedium }) {
  return medium === 'photography' ? (
    <Camera />
  ) : medium === 'artwork' ? (
    <Palette />
  ) : medium === 'audio' ? (
    <AudioLines />
  ) : (
    <Feather />
  );
}
function imageFor(piece: FeedPiece) {
  return piece.medium === 'audio'
    ? (piece.coverUrl ?? (piece.coverPath ? publicMediaUrl(piece.coverPath) : undefined))
    : (piece.imageUrl ?? (piece.mediaPath ? publicMediaUrl(piece.mediaPath) : undefined));
}

function TrailNodeCard({
  piece,
  root = false,
  relation,
}: {
  piece: FeedPiece;
  root?: boolean;
  relation?: TrailRelation;
}) {
  const image = imageFor(piece);
  return (
    <Link to={`/piece/${piece.id}`} className={`trail-node-card${root ? ' is-root' : ''}`}>
      {root && <span className="trail-root-tag">where it began</span>}
      {(piece.medium === 'photography' || piece.medium === 'artwork') && image && (
        <img
          src={image}
          alt={piece.imageAlt ?? piece.title}
          className="trail-node-image"
          loading="lazy"
        />
      )}
      {piece.medium === 'audio' && image && (
        <span className="trail-node-cover">
          <img
            src={image}
            alt={`Cover art for ${piece.title}`}
            className="trail-node-image"
            loading="lazy"
          />
          <AudioLines />
        </span>
      )}
      {(piece.medium ?? 'writing') === 'writing' && (
        <p className="trail-node-excerpt">
          {piece.body.slice(0, 130)}
          {piece.body.length > 130 ? '…' : ''}
        </p>
      )}
      <span className="trail-node-title">{piece.title}</span>
      <span className="trail-node-meta">
        {piece.author} · {mediumLabel(piece.medium)}
        {relation === 'continues' ? ' · continues a thread' : ''}
      </span>
    </Link>
  );
}

export function TrailTeaser({
  graph,
  pieceId,
  loading = false,
  error = '',
}: {
  graph: TrailGraph | null;
  pieceId: string;
  loading?: boolean;
  error?: string;
}) {
  const related = graph?.nodes.filter((node) => node.id !== pieceId) ?? [];
  const sourceEdge = graph?.edges.find((edge) => edge.responseId === pieceId);
  const source = sourceEdge
    ? graph?.nodes.find((node) => node.id === sourceEdge.sourceId)
    : undefined;
  return (
    <section className="trail-teaser">
      <div className="section-caption">
        <span className="eyebrow">Trails</span>
        <span>
          {loading
            ? 'Following the thread…'
            : related.length
              ? `${related.length} connected ${related.length === 1 ? 'work' : 'works'}`
              : 'No echoes yet'}
        </span>
      </div>
      {loading && <LoadingState variant="compact" label="Following the thread…" />}
      {source && sourceEdge && (
        <Link className="source-chip" to={`/piece/${source.id}`}>
          <ArrowUpLeft />
          {relationLabel(sourceEdge.relation)} <strong>{source.title}</strong>
        </Link>
      )}
      {error && (
        <p className="trail-status trail-status-error" role="alert">
          {error}
        </p>
      )}
      {related.length ? (
        <>
          <div className="teaser-list">
            {related.slice(0, 4).map((node) => (
              <Link key={node.id} className="teaser-item" to={`/piece/${node.id}`}>
                <MediumIcon medium={node.medium} />
                <span>
                  <strong>{node.title}</strong>
                  <small>
                    {node.author} · {mediumLabel(node.medium)}
                  </small>
                </span>
                <ArrowRight />
              </Link>
            ))}
          </div>
          <div className="teaser-actions">
            <Link className="varaq-action varaq-action--primary" to={`/trail/${pieceId}`}>
              Explore this Trail <ArrowRight />
            </Link>
            <Link className="varaq-action" to={`/write?respondTo=${encodeURIComponent(pieceId)}`}>
              Create a response
            </Link>
            <Link
              className="varaq-action"
              to={`/wall/manage/edit?respondTo=${encodeURIComponent(pieceId)}`}
            >
              Add an existing piece
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="trail-invite">
            This page hasn’t inspired anything yet. A photograph can become a poem; a poem, a story;
            a story, a song. Everything starts somewhere.
          </p>
          <div className="teaser-actions">
            <Link
              className="varaq-action varaq-action--primary"
              to={`/write?respondTo=${encodeURIComponent(pieceId)}`}
            >
              Create the first response
            </Link>
            <Link
              className="varaq-action"
              to={`/wall/manage/edit?respondTo=${encodeURIComponent(pieceId)}`}
            >
              Add an existing piece
            </Link>
            <Link className="varaq-action" to={`/trail/${pieceId}`}>
              View Trail
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

function trailDepths(graph: TrailGraph) {
  const result = new Map<string, number>([[graph.rootId, 0]]),
    queue = [graph.rootId];
  while (queue.length) {
    const id = queue.shift()!,
      depth = result.get(id) ?? 0;
    graph.edges
      .filter((edge) => edge.sourceId === id)
      .forEach((edge) => {
        if (!result.has(edge.responseId)) {
          result.set(edge.responseId, depth + 1);
          queue.push(edge.responseId);
        }
      });
  }
  graph.nodes.forEach((node) => {
    if (!result.has(node.id)) result.set(node.id, 0);
  });
  return result;
}

function LineageBranch({
  graph,
  parentId,
  depth,
}: {
  graph: TrailGraph;
  parentId: string;
  depth: number;
}) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node])),
    children = graph.edges.filter((edge) => edge.sourceId === parentId);
  if (!children.length) return null;
  return (
    <div className="trail-branch">
      {children.map((edge) => {
        const node = byId.get(edge.responseId);
        if (!node) return null;
        const further = graph.edges.filter((item) => item.sourceId === edge.responseId);
        return (
          <div className="trail-lineage-item" key={edge.responseId}>
            <span className="trail-relation">
              <ArrowDownRight />
              {relationLabel(edge.relation)}
            </span>
            <TrailNodeCard piece={node} relation={edge.relation} />
            {further.length > 0 && (
              <details className="trail-details" open={depth < 1}>
                <summary>
                  {further.length} further {further.length === 1 ? 'response' : 'responses'}
                </summary>
                <LineageBranch graph={graph} parentId={edge.responseId} depth={depth + 1} />
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TrailGraphView({ graph }: { graph: TrailGraph }) {
  const depths = trailDepths(graph),
    columns = new Map<number, FeedPiece[]>(),
    byId = new Map(graph.nodes.map((node) => [node.id, node])),
    incoming = new Map(graph.edges.map((edge) => [edge.responseId, edge]));
  graph.nodes.forEach((node) => {
    const depth = depths.get(node.id) ?? 0;
    columns.set(depth, [...(columns.get(depth) ?? []), node]);
  });
  const COL = 286,
    ROW = 250,
    NODE_W = 230,
    NODE_H = 214,
    PAD = 46;
  const maxCount = Math.max(1, ...[...columns.values()].map((list) => list.length)),
    width = PAD * 2 + Math.max(1, columns.size) * COL,
    height = PAD * 2 + maxCount * ROW;
  const positions = new Map<string, { x: number; y: number }>();
  for (const [depth, list] of columns) {
    const offset = (height - list.length * ROW) / 2;
    list.forEach((node, index) =>
      positions.set(node.id, {
        x: PAD + depth * COL + NODE_W / 2,
        y: offset + index * ROW + NODE_H / 2,
      }),
    );
  }
  const root = byId.get(graph.rootId);
  return (
    <div className="trail-wrap">
      {root && (
        <div className="trail-stage" style={{ width, height }}>
          <svg className="trail-lines" width={width} height={height} aria-hidden="true">
            <defs>
              <marker
                id="trail-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path
                  d="M0,1 L9,5 L0,9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </marker>
            </defs>
            {graph.edges.map((edge) => {
              const from = positions.get(edge.sourceId),
                to = positions.get(edge.responseId);
              if (!from || !to) return null;
              const x1 = from.x + NODE_W / 2,
                y1 = from.y,
                x2 = to.x - NODE_W / 2,
                y2 = to.y,
                bend = Math.max(40, Math.abs(x2 - x1) / 2);
              return (
                <path
                  key={`${edge.sourceId}-${edge.responseId}`}
                  className={`trail-line${edge.relation === 'continues' ? ' is-continues' : ''}`}
                  d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
                  markerEnd="url(#trail-arrow)"
                >
                  <title>{relationLabel(edge.relation)}</title>
                </path>
              );
            })}
          </svg>
          {graph.nodes.map((node, index) => {
            const spot = positions.get(node.id);
            if (!spot) return null;
            return (
              <div
                key={node.id}
                className={`trail-node trail-node-${index % 2 ? 'even' : 'odd'}`}
                style={{ left: spot.x - NODE_W / 2, top: spot.y - NODE_H / 2 }}
              >
                <TrailNodeCard
                  piece={node}
                  root={node.id === graph.rootId}
                  relation={incoming.get(node.id)?.relation}
                />
              </div>
            );
          })}
        </div>
      )}
      <div className="trail-lineage" aria-label="Trail as a vertical lineage">
        {root && <TrailNodeCard piece={root} root />}
        {root && <LineageBranch graph={graph} parentId={graph.rootId} depth={0} />}
      </div>
    </div>
  );
}

export function TrailLegend() {
  return (
    <div className="trail-legend">
      <span>
        <ArrowUpLeft />
        Inspired by
      </span>
      <span>
        <ArrowRight />
        Continues the thread
      </span>
      <span>
        <Play />
        Audio node
      </span>
    </div>
  );
}
