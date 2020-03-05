/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import { Node as DomNode } from '@ephox/dom-globals';
import { Arr, Option } from '@ephox/katamari';
import { Compare, Element, TransformFind } from '@ephox/sugar';
import Editor from 'tinymce/core/api/Editor';
import { ContextTypes } from '../../ContextToolbar';
import { ScopedToolbars } from './ContextToolbarScopes';

export type LookupResult = { toolbars: Array<ContextTypes>, elem: Element };
type MatchResult = { contextToolbars: Array<ContextTypes>, contextForms: Array<ContextTypes> };

const matchTargetWith = (elem: Element, candidates: Array<ContextTypes>): MatchResult => {
  const ctxs = Arr.filter(candidates, (toolbarApi) => toolbarApi.predicate(elem.dom()));
  const { pass, fail } = Arr.partition(ctxs, (t) => t.type === 'contexttoolbar');
  return { contextToolbars: pass, contextForms: fail };
};

const filterToolbarsByPosition = (toolbars: Array<ContextTypes>): Array<ContextTypes> => {
  if (toolbars.length <= 1) {
    return toolbars;
  } else {
    const findPosition = (value) => Arr.find(toolbars, (t) => t.position === value);

    // prioritise position by 'selection' -> 'node' -> 'line'
    const basePosition = findPosition('selection')
        .orThunk(() => findPosition('node'))
        .orThunk(() => findPosition('line'))
        .map((t) => t.position);
    return basePosition.fold(
      () => [],
      (pos) => Arr.filter(toolbars, (t) => t.position === pos)
    );
  }
};

const matchStartNode = (elem: Element, nodeCandidates: Array<ContextTypes>, editorCandidates: Array<ContextTypes>): Option<LookupResult> => {
  // requirements:
  // 1. prioritise context forms over context menus
  // 2. prioritise node scoped over editor scoped context forms
  // 3. only show max 1 context form
  // 4. concatenate all available context toolbars if no context form

  const nodeMatches = matchTargetWith(elem, nodeCandidates);

  if (nodeMatches.contextForms.length > 0) {
    return Option.some({ elem, toolbars: [nodeMatches.contextForms[0]] });
  } else {
    const editorMatches = matchTargetWith(elem, editorCandidates);

    if (editorMatches.contextForms.length > 0) {
      return Option.some({ elem, toolbars: [editorMatches.contextForms[0]] });
    } else if (nodeMatches.contextToolbars.length > 0 || editorMatches.contextToolbars.length > 0) {
      const toolbars = filterToolbarsByPosition(nodeMatches.contextToolbars.concat(editorMatches.contextToolbars));
      return Option.some({ elem, toolbars });
    } else {
      return Option.none();
    }
  }
};

const lookup = (scopes: ScopedToolbars, editor: Editor): Option<LookupResult> => {
  const rootElem = Element.fromDom(editor.getBody());
  const isRoot = (elem: Element<DomNode>) => Compare.eq(elem, rootElem);

  const startNode = Element.fromDom(editor.selection.getNode());

  // Ensure the lookup doesn't start on a parent element of the root node
  if (Compare.contains(startNode, rootElem)) {
    return Option.none();
  }

  return matchStartNode(startNode, scopes.inNodeScope, scopes.inEditorScope).orThunk(() => {
    return TransformFind.ancestor(startNode, (elem) => {
      // TransformFind will try to transform before doing the isRoot check, so we need to check here as well
      if (isRoot(elem)) {
        return Option.none();
      } else {
        const { contextToolbars, contextForms } = matchTargetWith(elem, scopes.inNodeScope);
        const toolbars = contextForms.length > 0 ? contextForms : contextToolbars;
        return toolbars.length > 0 ? Option.some({ elem, toolbars }) : Option.none();
      }
    }, isRoot);
  });
};

export {
  lookup
};
