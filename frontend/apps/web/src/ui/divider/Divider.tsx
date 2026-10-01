import './divider.css';

import type { CSSProperties, ReactNode } from 'react';

import { imageSetOf, pictureIn, sourcesOf, usePictures } from '../art/pictures';
import { ruleStyleOf } from './rule';
import type { Caps } from './rule';

/**
 * A divider: a painted rule between two things, as the moodboard draws them between its sections, laid
 * across whatever width it is given, with a **knot** in its middle or a title on it when it is asked for
 * one.
 *
 * The rule is a picture in `world/ui/dividers/`, cut at its two ends as a border is at its four, so the
 * ends are drawn once and the line between them stretches. A knot is an embellishment, so any knot goes
 * on any rule. See docs/UI-COMPONENTS.md.
 */
export function Divider({
  rule = 'gilt',
  knot,
  knotHeight,
  title,
  align = 'start',
}: {
  /** A picture in `world/ui/dividers/`, by its name. */
  rule?: string;
  /** A picture in `world/ui/embellishments/` to stand in its middle: `knot-fleur`, `knot-boss`, `sunburst`. */
  knot?: string;
  /** How tall the knot is drawn, when not at the size its picture is shown. */
  knotHeight?: number;
  /** Words on it, a section's name: at its start with the rule running on after them, or in its middle. */
  title?: ReactNode;
  align?: 'start' | 'middle';
}) {
  if (title !== undefined) {
    const words = <span className="ui-divider__title ui-caps">{title}</span>;
    return align === 'start' ? (
      <span className="ui-divider ui-divider--titled">
        {words}
        <Rule name={rule} caps="right" />
      </span>
    ) : (
      <span className="ui-divider ui-divider--titled">
        <Rule name={rule} caps="left" />
        {words}
        <Rule name={rule} caps="right" />
      </span>
    );
  }
  if (knot !== undefined) {
    return (
      <span className="ui-divider ui-divider--knotted" role="separator">
        <Rule name={rule} caps="left" />
        <Knot name={knot} {...(knotHeight === undefined ? {} : { height: knotHeight })} />
        <Rule name={rule} caps="right" />
      </span>
    );
  }
  return (
    <span className="ui-divider" role="separator">
      <Rule name={rule} />
    </span>
  );
}

/** A divider's rule on its own, for a component that puts one beside something of its own. */
export function Rule({ name = 'gilt', caps = 'both' }: { name?: string; caps?: Caps }) {
  const { list } = usePictures();
  const picture = pictureIn(list, 'dividers', name);
  if (picture === undefined) {
    return (
      <span
        className="ui-divider__rule ui-divider__rule--missing"
        title={`no divider called ${name}`}
        aria-hidden
      />
    );
  }
  // A rule with no cuts is stretched whole, its ends and all.
  const style: CSSProperties =
    picture.border === undefined
      ? { height: picture.height, backgroundImage: imageSetOf(picture), backgroundSize: '100% 100%' }
      : ruleStyleOf(picture, picture.border, caps);
  return <span className="ui-divider__rule" style={style} aria-hidden />;
}

function Knot({ name, height }: { name: string; height?: number }) {
  const { list } = usePictures();
  const picture = pictureIn(list, 'embellishments', name);
  if (picture === undefined) {
    return (
      <span
        className="ui-divider__knot ui-divider__knot--missing"
        title={`no knot called ${name}`}
        aria-hidden
      />
    );
  }
  const tall = height ?? picture.height;
  const { src, srcSet } = sourcesOf(picture);
  return (
    <img
      className="ui-divider__knot"
      src={src}
      srcSet={srcSet}
      width={Math.round((picture.width * tall) / picture.height)}
      height={tall}
      alt=""
      draggable={false}
    />
  );
}
