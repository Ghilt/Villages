import type { QuestFile, QuestNodeFile } from '@villages/world';

import { FlagField, NumberField, WordsField } from '../frame/Fields';
import type { CatalogueEditor } from '../frame/useCatalogueEditor';

/** Where a node leads, as the page says it. */
function sayThen(node: QuestNodeFile): string {
  if (node.then.length === 0) return 'the end of the quest';
  return node.then
    .map((lead) =>
      lead.verdict !== undefined
        ? `to ${lead.to} if ${lead.verdict}`
        : lead.endings.length === 0
          ? `on to ${lead.to}`
          : `to ${lead.to} after ${lead.endings.join(', ')}`,
    )
    .join('; ');
}

/**
 * The node chosen on the road, to change: its title, whether it is a question mark until reached and whether it is
 * shown ahead, and what it is - the dialogue it offers, a link to its own page; each objective's numbers; each
 * resource its reward gives - in place, with where it leads said. A node added or a road moved is the whole file's.
 * See decision record 0097.
 */
export function NodeEditor({ editor, node }: { editor: CatalogueEditor<QuestFile>; node: QuestNodeFile }) {
  const at = ['nodes', node.id] as const;
  return (
    <section className="quest-node-editor" aria-label={`node ${node.id}`}>
      <h3 className="inspect-group__subtitle">
        {node.id} <span className="inspect-key">{node.is.kind}</span>
      </h3>
      <p>
        <WordsField editor={editor} path={[...at, 'title']} label={`${node.id} title`} wide />
      </p>
      <p className="inspect-each">
        <FlagField editor={editor} path={[...at, 'hidden']} label="a question mark until reached" />
        <FlagField editor={editor} path={[...at, 'shownAhead']} label="shown ahead" />
      </p>
      <table className="inspect-table">
        <tbody>
          {node.is.kind === 'dialogue' && (
            <tr>
              <th scope="row">offers</th>
              <td>
                <a href={`/admin/inspect-dialogues/${node.is.dialogue}`}>{node.is.dialogue}</a>
              </td>
            </tr>
          )}
          {node.is.kind === 'objectives' &&
            node.is.objectives.map((objective) => {
              const here = [...at, 'objectives', objective.id] as const;
              return (
                <tr key={objective.id}>
                  <th scope="row">{objective.id}</th>
                  <td>
                    {objective.kind === 'holds' ? (
                      `holds a ${objective.structure}${objective.onAnIsland ? ' on an island' : ''}`
                    ) : (
                      <>
                        {objective.kind}{' '}
                        <NumberField
                          editor={editor}
                          path={[...here, 'amount']}
                          label={`${objective.id} amount`}
                        />{' '}
                        {objective.resource}
                        {objective.kind === 'pledges' && (
                          <>
                            {' '}
                            for{' '}
                            <NumberField
                              editor={editor}
                              path={[...here, 'months']}
                              label={`${objective.id} months`}
                            />{' '}
                            months
                          </>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          {node.is.kind === 'challenge' && (
            <>
              <tr>
                <th scope="row">puts</th>
                <td>
                  a {node.is.challenge.kind} against {node.is.challenge.against.name}{' '}
                  <span className="inspect-key" style={{ color: node.is.challenge.against.colour }}>
                    {node.is.challenge.against.colour}
                  </span>
                </td>
              </tr>
              {node.is.challenge.slices.map((slice, index) => (
                <tr key={index}>
                  <th scope="row">their slice {index + 1}</th>
                  <td>
                    {slice.aspect}, power {slice.power}, integrity {slice.integrity}, {slice.summonCount}{' '}
                    summons: {slice.effects.join(', ')}
                    {Object.entries(slice.slotted).map(
                      ([effect, standIn]) => ` (${standIn.name} in ${effect})`,
                    )}
                  </td>
                </tr>
              ))}
            </>
          )}
          {node.is.kind === 'reward' &&
            Object.keys(node.is.gives).map((resource) => (
              <tr key={resource}>
                <th scope="row">gives</th>
                <td>
                  <NumberField
                    editor={editor}
                    path={[...at, 'gives', resource]}
                    label={`${node.id} gives ${resource}`}
                  />{' '}
                  {resource}
                </td>
              </tr>
            ))}
          <tr>
            <th scope="row">then</th>
            <td>{sayThen(node)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
