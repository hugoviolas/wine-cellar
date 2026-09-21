import type { MapPoint } from './interfaces/map-point.interface';
import type { MapCluster } from './interfaces/map-cluster.interface';
import type { BuildMapClustersArgs } from './interfaces/build-map-clusters-args.interface';
import type { SpiderfyClusterArgs } from './interfaces/spiderfy-cluster-args.interface';
import type { SpiderfyPosition } from './interfaces/spiderfy-position.interface';

export type { MapPoint, MapCluster, SpiderfyPosition };

/** Deux disques se touchent : la distance des centres est plus courte que la somme des rayons. */
const touches = (a: MapPoint, b: MapPoint): boolean => {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius;
};

/**
 * Points regroupés par chevauchement.
 *
 * Sans ça, un point disparaît sous un autre et le compte affiché ment :
 * quatre champagnes en cave n'en montraient que trois, le quatrième étant
 * caché sous son voisin. Ici chaque point est dans une grappe et une seule,
 * donc la somme des disques affichés égale toujours le nombre de bouteilles
 * placées.
 *
 * Le regroupement est transitif — A touche B, B touche C, les trois n'en
 * font qu'un — mais il se calcule sur les disques d'origine, jamais sur le
 * disque fusionné (plus gros). C'est délibéré : réinjecter le rayon de la
 * grappe ferait boule de neige et finirait par avaler la carte entière dès
 * que la cave se remplit.
 */
export const buildMapClusters = ({ points, radiusOf }: BuildMapClustersArgs): readonly MapCluster[] => {
  const groups: MapPoint[][] = [];

  for (const point of points) {
    const hit = groups.filter((group) => group.some((other) => touches(other, point)));
    const merged = hit.flat();
    merged.push(point);
    for (const group of hit) {
      groups.splice(groups.indexOf(group), 1);
    }
    groups.push(merged);
  }

  const clusters = groups.map((group): MapCluster => {
    const members = [...group].sort((a, b) => {
      return b.place.bottles - a.place.bottles || a.place.label.localeCompare(b.place.label, 'fr');
    });
    const bottles = members.reduce((sum, member) => sum + member.place.bottles, 0);
    const first = members[0];
    return {
      // La grappe porte la clé de son lieu le plus fourni : stable d'un
      // rendu à l'autre, et lisible dans le DOM.
      key: `cluster:${first?.place.key ?? ''}`,
      points: members,
      bottles,
      x: members.reduce((sum, member) => sum + member.x, 0) / members.length,
      y: members.reduce((sum, member) => sum + member.y, 0) / members.length,
      radius: radiusOf(bottles),
    };
  });

  // Même tri que les lieux : les grosses grappes d'abord, donc dessinées
  // en dessous des petites plutôt que par-dessus.
  return clusters.sort((a, b) => {
    return (
      b.bottles - a.bottles ||
      (a.points[0]?.place.label ?? '').localeCompare(b.points[0]?.place.label ?? '', 'fr')
    );
  });
};

/**
 * Positions des points d'une grappe dépliée en étoile.
 *
 * Le rayon de l'étoile se calcule sur ce qu'elle doit contenir : à rayon
 * fixe, les neuf sous-régions bordelaises se recouvraient à nouveau une
 * fois dépliées. On demande donc que le périmètre suffise à poser tous les
 * disques côte à côte.
 *
 * Les positions sont bornées au cadre : une grappe collée au bord de la
 * carte (le Médoc est à trois millimètres de l'Atlantique) verrait sinon la
 * moitié de son étoile sortir du `viewBox`.
 */
export const spiderfyCluster = ({
  cluster,
  bounds,
  gap,
}: SpiderfyClusterArgs): readonly SpiderfyPosition[] => {
  const count = cluster.points.length;
  const widest = cluster.points.reduce((max, point) => Math.max(max, point.radius), 0);
  const needed = (count * (widest * 2 + gap)) / (Math.PI * 2);
  const spread = Math.max(cluster.radius + gap, needed);

  return cluster.points.map((point, index): SpiderfyPosition => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const limit = point.radius + gap;
    return {
      point,
      x: Math.min(bounds.width - limit, Math.max(limit, cluster.x + Math.cos(angle) * spread)),
      y: Math.min(bounds.height - limit, Math.max(limit, cluster.y + Math.sin(angle) * spread)),
    };
  });
};
