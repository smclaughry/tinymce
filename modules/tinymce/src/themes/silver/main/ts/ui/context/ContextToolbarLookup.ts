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

const matchTargetWith = (elem: Element, contextToolbars: Array<ContextTypes>): Option<LookupResult> => {
  const toolbars = Arr.filter(contextToolbars, (toolbarApi) => {
    return toolbarApi.predicate(elem.dom());
  });
  return toolbars.length > 0 ? Option.some({ elem, toolbars }) : Option.none();
};

const lookup = (scopes: ScopedToolbars, editor: Editor): Option<LookupResult> => {
  const rootElem = Element.fromDom(editor.getBody());
  const isRoot = (elem: Element<DomNode>) => Compare.eq(elem, rootElem);

  const startNode = Element.fromDom(editor.selection.getNode());

  // Ensure the lookup doesn't start on a parent element of the root node
  if (Compare.contains(startNode, rootElem)) {
    return Option.none();
  }

  return matchTargetWith(startNode, (scopes.inNodeScope).concat(scopes.inEditorScope)).orThunk(() => {
    return TransformFind.ancestor(startNode, (elem) => {
      // TransformFind will try to transform before doing the isRoot check, so we need to check here as well
      return isRoot(elem) ? Option.none() : matchTargetWith(elem, scopes.inNodeScope);
    }, isRoot);
  });
};

export {
  lookup
};
