// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function(global) {
//  "use strict";

  var matchesSelector = 'matchesSelector';
  if ('webkitMatchesSelector' in Element.prototype)
    matchesSelector = 'webkitMatchesSelector';
  else if ('mozMatchesSelector' in Element.prototype)
    matchesSelector = 'mozMatchesSelector';

  var MutationObserver = global.MutationObserver || global.WebKitMutationObserver || global.MozMutationObserver;
  if (MutationObserver === undefined) {
    console.log('MutationSummary cannot load: DOM Mutation Observers are required.');
    console.log('https://developer.mozilla.org/en-US/docs/DOM/MutationObserver');
    return;
  }

  // NodeMap UtilityClass. Exposed as MutationSummary.NodeMap.
  // TODO(rafaelw): Consider using Harmony Map when available.

  var ID_PROP = '__mutation_summary_node_map_id__';
  var nextId_ = 1;

  function ensureId(node) {
    if (!node[ID_PROP]) {
      node[ID_PROP] = nextId_++;
      return true;
    }

    return false;
  }

  function NodeMap() {
    this.map_ = {};
  };

  NodeMap.prototype = {
    set: function(node, value) {
      ensureId(node);
      this.map_[node[ID_PROP]] = {k: node, v: value};
    },
    get: function(node) {
      if (ensureId(node))
        return;
      var byId = this.map_[node[ID_PROP]];
      if (byId)
        return byId.v;
    },
    has: function(node) {
      return !ensureId(node) && node[ID_PROP] in this.map_;
    },
    'delete': function(node) {
      if (ensureId(node))
        return;
      delete this.map_[node[ID_PROP]];
    },
    keys: function() {
      var nodes = [];
      for (var id in this.map_) {
        nodes.push(this.map_[id].k);
      }
      return nodes;
    }
  };

  function hasOwnProperty(obj, propName) {
    return Object.prototype.hasOwnProperty.call(obj, propName);
  }

  // Reachability & Matchability changeType constants.
  var STAYED_OUT = 0;
  var ENTERED = 1;
  var STAYED_IN = 2;
  var EXITED = 3;

  // Sub-states of STAYED_IN
  var REPARENTED = 4;
  var REORDERED = 5;

  /**
   * This is no longer in use, but conceptually it still represents the policy for
   * reporting node movement:
   *
   *  var reachableMatchableProduct = [
   *  //  STAYED_OUT,  ENTERED,     STAYED_IN,   EXITED
   *    [ STAYED_OUT,  STAYED_OUT,  STAYED_OUT,  STAYED_OUT ], // STAYED_OUT
   *    [ STAYED_OUT,  ENTERED,     ENTERED,     STAYED_OUT ], // ENTERED
   *    [ STAYED_OUT,  ENTERED,     STAYED_IN,   EXITED     ], // STAYED_IN
   *    [ STAYED_OUT,  STAYED_OUT,  EXITED,      EXITED     ]  // EXITED
   *  ];
   */

  function enteredOrExited(changeType) {
    return changeType == ENTERED || changeType == EXITED;
  }

  var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

  function MutationProjection(rootNode, elementFilter, calcReordered, calcOldPreviousSibling) {
    this.rootNode = rootNode;
    this.elementFilter = elementFilter;
    this.calcReordered = calcReordered;
    this.calcOldPreviousSibling = calcOldPreviousSibling;
  }

  MutationProjection.prototype = {

    getChange: function(node) {
      var change = this.changeMap.get(node);
      if (!change) {
        change = {
          target: node
        };
        this.changeMap.set(node, change);
      }

      if (node.nodeType == Node.ELEMENT_NODE)
        change.matchCaseInsensitive = node instanceof HTMLElement && node.ownerDocument instanceof HTMLDocument;

      return change;
    },

    getParentChange: function(node) {
      var change = this.getChange(node);
      if (!change.childList) {
        change.childList = true;
        change.oldParentNode = null;
      }

      return change;
    },

    handleChildList: function(mutation) {
      this.childListChanges = true;

      forEach(mutation.removedNodes, function(el) {
        var change = this.getParentChange(el);

        // Note: is it possible to receive a removal followed by a removal. This
        // can occur if the removed node is added to an non-observed node, that
        // node is added to the observed area, and then the node removed from
        // it.
        if (change.added || change.oldParentNode)
          change.added = false;
        else
          change.oldParentNode = mutation.target;
      }, this);

      forEach(mutation.addedNodes, function(el) {
        var change = this.getParentChange(el);
        change.added = true;
      }, this);
    },

    handleAttributes: function(mutation) {
      this.attributesChanges = true;

      var change = this.getChange(mutation.target);
      if (!change.attributes) {
        change.attributes = true;
        change.attributeOldValues = {};
      }

      var oldValues = change.attributeOldValues;
      if (!hasOwnProperty(oldValues, mutation.attributeName)) {
        oldValues[mutation.attributeName] = mutation.oldValue;
      }
    },

    handleCharacterData: function(mutation) {
      this.characterDataChanges = true;

      var change = this.getChange(mutation.target);
      if (change.characterData)
        return;
      change.characterData = true;
      change.characterDataOldValue = mutation.oldValue;
    },

    processMutations: function(mutations) {
      this.mutations = mutations;
      this.changeMap = new NodeMap;

      this.mutations.forEach(function(mutation) {
        switch (mutation.type) {
          case 'childList':
            this.handleChildList(mutation);
            break;
          case 'attributes':
            this.handleAttributes(mutation);
            break;
          case 'characterData':
            this.handleCharacterData(mutation);
            break;
        }
      }, this);

      // Calculate node movement.
      var entered = this.entered = [];
      var exited = this.exited = [];
      var stayedIn = this.stayedIn = new NodeMap;

      if (!this.childListChanges && !this.attributesChanges)
        return; // No childList or attributes mutations occurred.

      var matchabilityChange = this.matchabilityChange.bind(this);

      var reachabilityChange = this.reachabilityChange.bind(this);
      var wasReordered = this.wasReordered.bind(this);

      var visited = new NodeMap;
      var self = this;

      function ensureHasOldPreviousSiblingIfNeeded(node) {
        if (!self.calcOldPreviousSibling)
          return;

        self.processChildlistChanges();

        var parentNode = node.parentNode;
        var change = self.changeMap.get(node);
        if (change && change.oldParentNode)
          parentNode = change.oldParentNode;

        change = self.childlistChanges.get(parentNode);
        if (!change) {
          change = {
            oldPrevious: new NodeMap
          };

          self.childlistChanges.set(parentNode, change);
        }

        if (!change.oldPrevious.has(node)) {
          change.oldPrevious.set(node, node.previousSibling);
        }
      }

      function visitNode(node, parentReachable) {
        if (visited.has(node))
          return;
        visited.set(node, true);

        var change = self.changeMap.get(node);
        var reachable = parentReachable;

        // node inherits its parent's reachability change unless
        // its parentNode was mutated.
        if ((change && change.childList) || reachable == undefined)
          reachable = reachabilityChange(node);

        if (reachable == STAYED_OUT)
          return;

        // Cache match results for sub-patterns.
        matchabilityChange(node);

        if (reachable == ENTERED) {
          entered.push(node);
        } else if (reachable == EXITED) {
          exited.push(node);
          ensureHasOldPreviousSiblingIfNeeded(node);

        } else if (reachable == STAYED_IN) {
          var movement = STAYED_IN;

          if (change && change.childList) {
            if (change.oldParentNode !== node.parentNode) {
              movement = REPARENTED;
              ensureHasOldPreviousSiblingIfNeeded(node);
            } else if (self.calcReordered && wasReordered(node)) {
              movement = REORDERED;
            }
          }

          stayedIn.set(node, movement);
        }

        if (reachable == STAYED_IN)
          return;

        // reachable == ENTERED || reachable == EXITED.
        for (var child = node.firstChild; child; child = child.nextSibling) {
          visitNode(child, reachable);
        }
      }

      this.changeMap.keys().forEach(function(node) {
        visitNode(node);
      });
    },

    getChanged: function(summary) {
      var matchabilityChange = this.matchabilityChange.bind(this);

      this.entered.forEach(function(node) {
        var matchable = matchabilityChange(node);
        if (matchable == ENTERED || matchable == STAYED_IN)
          summary.added.push(node);
      });

      this.stayedIn.keys().forEach(function(node) {
        var matchable = matchabilityChange(node);

        if (matchable == ENTERED) {
          summary.added.push(node);
        } else if (matchable == EXITED) {
          summary.removed.push(node);
        } else if (matchable == STAYED_IN && (summary.reparented || summary.reordered)) {
          var movement = this.stayedIn.get(node);
          if (summary.reparented && movement == REPARENTED)
            summary.reparented.push(node);
          else if (summary.reordered && movement == REORDERED)
            summary.reordered.push(node);
        }
      }, this);

      this.exited.forEach(function(node) {
        var matchable = matchabilityChange(node);
        if (matchable == EXITED || matchable == STAYED_IN)
          summary.removed.push(node);
      })
    },

    getOldParentNode: function(node) {
      var change = this.changeMap.get(node);
      if (change && change.childList)
        return change.oldParentNode ? change.oldParentNode : null;

      var reachabilityChange = this.reachabilityChange(node);
      if (reachabilityChange == STAYED_OUT || reachabilityChange == ENTERED)
        throw Error('getOldParentNode requested on invalid node.');

      return node.parentNode;
    },

    getOldPreviousSibling: function(node) {
      var parentNode = node.parentNode;
      var change = this.changeMap.get(node);
      if (change && change.oldParentNode)
        parentNode = change.oldParentNode;

      change = this.childlistChanges.get(parentNode);
      if (!change)
        throw Error('getOldPreviousSibling requested on invalid node.');

      return change.oldPrevious.get(node);
    },

    getOldAttribute: function(element, attrName) {
      var change = this.changeMap.get(element);
      if (!change || !change.attributes)
        throw Error('getOldAttribute requested on invalid node.');

      if (change.matchCaseInsensitive)
        attrName = attrName.toLowerCase();

      if (!hasOwnProperty(change.attributeOldValues, attrName))
        throw Error('getOldAttribute requested for unchanged attribute name.');

      return change.attributeOldValues[attrName];
    },

    getAttributesChanged: function(postFilter) {
      if (!this.attributesChanges)
        return {}; // No attributes mutations occurred.

      var attributeFilter;
      var caseInsensitiveFilter;
      if (postFilter) {
        attributeFilter = {};
        caseInsensitiveFilter = {};
        postFilter.forEach(function(attrName) {
          attributeFilter[attrName] = true;
          var lowerAttrName = attrName.toLowerCase();
          if (attrName != lowerAttrName) {
            caseInsensitiveFilter[lowerAttrName] = attrName;
          }
        });
      }

      var result = {};

      var nodes = this.changeMap.keys();
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];

        var change = this.changeMap.get(node);
        if (!change.attributes)
          continue;

        if (STAYED_IN != this.reachabilityChange(node) || STAYED_IN != this.matchabilityChange(node))
          continue;

        var element = node;
        var oldValues = change.attributeOldValues;

        Object.keys(oldValues).forEach(function(name) {
          var localName = name;
          if (change.matchCaseInsensitive && caseInsensitiveFilter && caseInsensitiveFilter[name])
            localName = caseInsensitiveFilter[name];

          if (attributeFilter && !attributeFilter[localName])
            return;

          if (element.getAttribute(name) == oldValues[name])
            return;

          if (!result[localName])
            result[localName] = [];

          result[localName].push(element);
        });
      }

      return result;
    },

    getOldCharacterData: function(node) {
      var change = this.changeMap.get(node);
      if (!change || !change.characterData)
        throw Error('getOldCharacterData requested on invalid node.');

      return change.characterDataOldValue;
    },

    getCharacterDataChanged: function() {
      if (!this.characterDataChanges)
        return []; // No characterData mutations occurred.

      var nodes = this.changeMap.keys();
      var result = [];
      for (var i = 0; i < nodes.length; i++) {
        var target = nodes[i];
        if (STAYED_IN != this.reachabilityChange(target) || STAYED_IN != this.matchabilityChange(target))
          continue;

        var change = this.changeMap.get(target);
        if (!change.characterData ||
            target.textContent == change.characterDataOldValue)
          continue

        result.push(target);
      }

      return result;
    },

    /**
     * Returns whether a given node:
     *
     *    STAYED_OUT, ENTERED, STAYED_IN or EXITED
     *
     * the set of nodes reachable from the root.
     *
     * These four states are the permutations of whether the node
     *
     *   wasReachable(node)
     *   isReachable(node)
     *
     */
    reachabilityChange: function(node) {
      this.reachableCache = this.reachableCache || new NodeMap;
      this.wasReachableCache = this.wasReachableCache || new NodeMap;

      // Close over owned values.
      var rootNode = this.rootNode;
      var changeMap = this.changeMap;
      var reachableCache = this.reachableCache;
      var wasReachableCache = this.wasReachableCache;

      // An node's oldParent is
      //   -its present parent, if nothing happened to it
      //   -null if the first thing that happened to it was an add.
      //   -the node it was removed from if the first thing that happened to it
      //      was a remove.
      function getOldParent(node) {
        var change = changeMap.get(node);

        if (change && change.childList) {
          if (change.oldParentNode)
            return change.oldParentNode;
          if (change.added)
            return null;
        }

        return node.parentNode;
      }

      // Is the given node reachable from the rootNode.
      function getIsReachable(node) {
        if (node === rootNode)
          return true;
        if (!node)
          return false;

        var isReachable = reachableCache.get(node);
        if (isReachable === undefined) {
          isReachable = getIsReachable(node.parentNode);
          reachableCache.set(node, isReachable);
        }
        return isReachable;
      }

      // Was the given node reachable from the rootNode.
      // A node wasReachable if its oldParent wasReachable.
      function getWasReachable(node) {
        if (node === rootNode)
          return true;
        if (!node)
          return false;

        var wasReachable = wasReachableCache.get(node);
        if (wasReachable === undefined) {
          wasReachable = getWasReachable(getOldParent(node));
          wasReachableCache.set(node, wasReachable);
        }
        return wasReachable;
      }

      if (getIsReachable(node))
        return getWasReachable(node) ? STAYED_IN : ENTERED;
      else
        return getWasReachable(node) ? EXITED : STAYED_OUT;
    },

    checkWasMatching: function(el, filter, isMatching) {
      var change = this.changeMap.get(el);
      if (!change || !change.attributeOldValues)
        return isMatching;

      var tagName = filter.tagName;
      if (change.matchCaseInsensitive &&
          tagName != '*' &&
          hasOwnProperty(filter, 'caseInsensitiveTagName')) {
        tagName = filter.caseInsensitiveTagName;
      }

      if (tagName != '*' && tagName != el.tagName)
        return false;

      var attributeOldValues = change.attributeOldValues;
      var significantAttrChanged = filter.qualifiers.some(function(qualifier) {
        if (qualifier.class)
          return hasOwnProperty(attributeOldValues, 'class');
        else if (qualifier.id)
          return hasOwnProperty(attributeOldValues, 'id');
        else {
          return change.matchCaseInsensitive && hasOwnProperty(qualifier, 'caseInsensitiveAttrName') ?
              hasOwnProperty(attributeOldValues, qualifier.caseInsensitiveAttrName) :
              hasOwnProperty(attributeOldValues, qualifier.attrName)
        }
      });

      if (!significantAttrChanged)
        return isMatching;

      for (var i = 0; i < filter.qualifiers.length; i++) {
        var qualifier = filter.qualifiers[i];
        var attrName;
        if (qualifier.class)
          attrName = 'class';
        else if (qualifier.id)
          attrName = 'id';
        else {
          if (change.matchCaseInsensitive &&
              hasOwnProperty(qualifier, 'caseInsensitiveAttrName')) {
            attrName = qualifier.caseInsensitiveAttrName;
          } else {
            attrName = qualifier.attrName;
          }
        }

        var contains = qualifier.class ? true : qualifier.contains;

        var attrOldValue = hasOwnProperty(attributeOldValues, attrName) ?
            attributeOldValues[attrName] : el.getAttribute(attrName);

        if (attrOldValue == null)
          return false;

        if (qualifier.hasOwnProperty('attrValue')) {
          if (!contains && qualifier.attrValue !== attrOldValue)
            return false;

          var subvalueMatch = attrOldValue.split(' ').some(function(subValue) {
            return subValue == qualifier.attrValue;
          });

          if (!subvalueMatch)
            return false;
        }
      }

      return true;
    },

    /**
     * Returns whether a given element:
     *
     *   STAYED_OUT, ENTERED, EXITED or STAYED_IN
     *
     * the set of element which match at least one match pattern.
     *
     * These four states are the permutations of whether the element
     *
     *   wasMatching(node)
     *   isMatching(node)
     *
     */
    matchabilityChange: function(node) {
      // TODO(rafaelw): Include PI, CDATA?
      // Only include text nodes.
      if (this.filterCharacterData) {
        switch (node.nodeType) {
          case Node.COMMENT_NODE:
          case Node.TEXT_NODE:
            return STAYED_IN;
          default:
            return STAYED_OUT;
        }
      }

      // No element filter. Include all nodes.
      if (!this.elementFilter)
        return STAYED_IN;

      // Element filter. Exclude non-elements.
      if (node.nodeType !== Node.ELEMENT_NODE)
        return STAYED_OUT;

      var el = node;

      function computeMatchabilityChange(filter) {
        if (!this.matchCache)
          this.matchCache = {};
        if (!this.matchCache[filter.selectorString])
          this.matchCache[filter.selectorString] = new NodeMap;

        var cache = this.matchCache[filter.selectorString];
        var result = cache.get(el);
        if (result !== undefined)
          return result;

        var isMatching = el[matchesSelector](filter.selectorString);
        var wasMatching = this.checkWasMatching(el, filter, isMatching);

        if (isMatching)
          result = wasMatching ? STAYED_IN : ENTERED;
        else
          result = wasMatching ? EXITED : STAYED_OUT;

        cache.set(el, result);
        return result;
      }

      var matchChanges = this.elementFilter.map(computeMatchabilityChange, this);
      var accum = STAYED_OUT;
      var i = 0;

      while (accum != STAYED_IN && i < matchChanges.length) {
        switch(matchChanges[i]) {
          case STAYED_IN:
            accum = STAYED_IN;
            break;
          case ENTERED:
            if (accum == EXITED)
              accum = STAYED_IN;
            else
              accum = ENTERED;
            break;
          case EXITED:
            if (accum == ENTERED)
              accum = STAYED_IN;
            else
              accum = EXITED;
            break;
        }

        i++;
      }

      return accum;
    },

    processChildlistChanges: function() {
      if (this.childlistChanges)
        return;

      var childlistChanges = this.childlistChanges = new NodeMap;

      function getChildlistChange(el) {
        var change = childlistChanges.get(el);
        if (!change) {
          change = {
            added: new NodeMap,
            removed: new NodeMap,
            maybeMoved: new NodeMap,
            oldPrevious: new NodeMap
          };
          childlistChanges.set(el, change);
        }

        return change;
      }

      var reachabilityChange = this.reachabilityChange.bind(this);
      var self = this;

      this.mutations.forEach(function(mutation) {
        if (mutation.type != 'childList')
          return;

        if (reachabilityChange(mutation.target) != STAYED_IN && !self.calcOldPreviousSibling)
          return;

        var change = getChildlistChange(mutation.target);

        var oldPrevious = mutation.previousSibling;

        function recordOldPrevious(node, previous) {
          if (!node ||
              change.oldPrevious.has(node) ||
              change.added.has(node) ||
              change.maybeMoved.has(node))
            return;

          if (previous &&
              (change.added.has(previous) ||
               change.maybeMoved.has(previous)))
            return;

          change.oldPrevious.set(node, previous);
        }

        forEach(mutation.removedNodes, function(node) {
          recordOldPrevious(node, oldPrevious);

          if (change.added.has(node)) {
            change.added.delete(node);
          } else {
            change.removed.set(node, true);
            change.maybeMoved.delete(node, true);
          }

          oldPrevious = node;
        });

        recordOldPrevious(mutation.nextSibling, oldPrevious);

        forEach(mutation.addedNodes, function(node) {
          if (change.removed.has(node)) {
            change.removed.delete(node);
            change.maybeMoved.set(node, true);
          } else {
            change.added.set(node, true);
          }
        });
      });
    },

    wasReordered: function(node) {
      if (!this.childListChanges)
        return false;

      this.processChildlistChanges();

      var parentNode = node.parentNode;
      var change = this.changeMap.get(node);
      if (change && change.oldParentNode)
        parentNode = change.oldParentNode;

      change = this.childlistChanges.get(parentNode);
      if (!change)
        return false;

      if (change.moved)
        return change.moved.get(node);

      var moved = change.moved = new NodeMap;
      var pendingMoveDecision = new NodeMap;

      function isMoved(node) {
        if (!node)
          return false;
        if (!change.maybeMoved.has(node))
          return false;

        var didMove = moved.get(node);
        if (didMove !== undefined)
          return didMove;

        if (pendingMoveDecision.has(node)) {
          didMove = true;
        } else {
          pendingMoveDecision.set(node, true);
          didMove = getPrevious(node) !== getOldPrevious(node);
        }

        if (pendingMoveDecision.has(node)) {
          pendingMoveDecision.delete(node);
          moved.set(node, didMove);
        } else {
          didMove = moved.get(node);
        }

        return didMove;
      }

      var oldPreviousCache = new NodeMap;
      function getOldPrevious(node) {
        var oldPrevious = oldPreviousCache.get(node);
        if (oldPrevious !== undefined)
          return oldPrevious;

        oldPrevious = change.oldPrevious.get(node);
        while (oldPrevious &&
               (change.removed.has(oldPrevious) || isMoved(oldPrevious))) {
          oldPrevious = getOldPrevious(oldPrevious);
        }

        if (oldPrevious === undefined)
          oldPrevious = node.previousSibling;
        oldPreviousCache.set(node, oldPrevious);

        return oldPrevious;
      }

      var previousCache = new NodeMap;
      function getPrevious(node) {
        if (previousCache.has(node))
          return previousCache.get(node);

        var previous = node.previousSibling;
        while (previous && (change.added.has(previous) || isMoved(previous)))
          previous = previous.previousSibling;

        previousCache.set(node, previous);
        return previous;
      }

      change.maybeMoved.keys().forEach(isMoved);
      return change.moved.get(node);
    }
  }

  // TODO(rafaelw): Allow ':' and '.' as valid name characters.
  var validNameInitialChar = /[a-zA-Z_]+/;
  var validNameNonInitialChar = /[a-zA-Z0-9_\-]+/;

  // TODO(rafaelw): Consider allowing backslash in the attrValue.
  // TODO(rafaelw): There's got a to be way to represent this state machine
  // more compactly???
  function parseElementFilter(elementFilter) {
    var selectorGroup = [];
    var currentSelector;
    var currentQualifier;

    function newSelector() {
      if (currentSelector) {
        if (currentQualifier) {
          currentSelector.qualifiers.push(currentQualifier);
          currentQualifier = undefined;
        }

        selectorGroup.push(currentSelector);
      }
      currentSelector = {
        qualifiers: []
      }
    }

    function newQualifier() {
      if (currentQualifier)
        currentSelector.qualifiers.push(currentQualifier);

      currentQualifier = {};
    }


    var WHITESPACE = /\s/;
    var valueQuoteChar;
    var SYNTAX_ERROR = 'Invalid or unsupported selector syntax.';

    var SELECTOR = 1;
    var TAG_NAME = 2;
    var QUALIFIER = 3;
    var QUALIFIER_NAME_FIRST_CHAR = 4;
    var QUALIFIER_NAME = 5;
    var ATTR_NAME_FIRST_CHAR = 6;
    var ATTR_NAME = 7;
    var EQUIV_OR_ATTR_QUAL_END = 8;
    var EQUAL = 9;
    var ATTR_QUAL_END = 10;
    var VALUE_FIRST_CHAR = 11;
    var VALUE = 12;
    var QUOTED_VALUE = 13;
    var SELECTOR_SEPARATOR = 14;

    var state = SELECTOR;
    var i = 0;
    while (i < elementFilter.length) {
      var c = elementFilter[i++];

      switch (state) {
        case SELECTOR:
          if (c.match(validNameInitialChar)) {
            newSelector();
            currentSelector.tagName = c;
            state = TAG_NAME;
            break;
          }

          if (c == '*') {
            newSelector();
            currentSelector.tagName = '*';
            state = QUALIFIER;
            break;
          }

          if (c == '.') {
            newSelector();
            newQualifier();
            currentSelector.tagName = '*';
            currentQualifier.class = true;
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == '#') {
            newSelector();
            newQualifier();
            currentSelector.tagName = '*';
            currentQualifier.id = true;
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == '[') {
            newSelector();
            newQualifier();
            currentSelector.tagName = '*';
            currentQualifier.attrName = '';
            state = ATTR_NAME_FIRST_CHAR;
            break;
          }

          if (c.match(WHITESPACE))
            break;

          throw Error(SYNTAX_ERROR);

        case TAG_NAME:
          if (c.match(validNameNonInitialChar)) {
            currentSelector.tagName += c;
            break;
          }

          if (c == '.') {
            newQualifier();
            currentQualifier.class = true;
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == '#') {
            newQualifier();
            currentQualifier.id = true;
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == '[') {
            newQualifier();
            currentQualifier.attrName = '';
            state = ATTR_NAME_FIRST_CHAR;
            break;
          }

          if (c.match(WHITESPACE)) {
            state = SELECTOR_SEPARATOR;
            break;
          }

          if (c == ',') {
            state = SELECTOR;
            break;
          }

          throw Error(SYNTAX_ERROR);

        case QUALIFIER:
          if (c == '.') {
            newQualifier();
            currentQualifier.class = true;
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == '#') {
            newQualifier();
            currentQualifier.id = true;
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == '[') {
            newQualifier();
            currentQualifier.attrName = '';
            state = ATTR_NAME_FIRST_CHAR;
            break;
          }

          if (c.match(WHITESPACE)) {
            state = SELECTOR_SEPARATOR;
            break;
          }

          if (c == ',') {
            state = SELECTOR;
            break;
          }

          throw Error(SYNTAX_ERROR);

        case QUALIFIER_NAME_FIRST_CHAR:
          if (c.match(validNameInitialChar)) {
            currentQualifier.attrValue = c;
            state = QUALIFIER_NAME;
            break;
          }

          throw Error(SYNTAX_ERROR);

        case QUALIFIER_NAME:
          if (c.match(validNameNonInitialChar)) {
            currentQualifier.attrValue += c;
            break;
          }

          if (c == '.') {
            newQualifier();
            currentQualifier.class = true;
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == '#') {
            newQualifier();
            currentQualifier.id = true;
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == '[') {
            newQualifier();
            state = ATTR_NAME_FIRST_CHAR;
            break;
          }

          if (c.match(WHITESPACE)) {
            state = SELECTOR_SEPARATOR;
            break;
          }
          if (c == ',') {
            state = SELECTOR;
            break
          }

          throw Error(SYNTAX_ERROR);

        case ATTR_NAME_FIRST_CHAR:
          if (c.match(validNameInitialChar)) {
            currentQualifier.attrName = c;
            state = ATTR_NAME;
            break;
          }

          if (c.match(WHITESPACE))
            break;

          throw Error(SYNTAX_ERROR);

        case ATTR_NAME:
          if (c.match(validNameNonInitialChar)) {
            currentQualifier.attrName += c;
            break;
          }

          if (c.match(WHITESPACE)) {
            state = EQUIV_OR_ATTR_QUAL_END;
            break;
          }

          if (c == '~') {
            currentQualifier.contains = true;
            state = EQUAL;
            break;
          }

          if (c == '=') {
            currentQualifier.attrValue = '';
            state = VALUE_FIRST_CHAR;
            break;
          }

          if (c == ']') {
            state = QUALIFIER;
            break;
          }

          throw Error(SYNTAX_ERROR);

        case EQUIV_OR_ATTR_QUAL_END:
          if (c == '~') {
            currentQualifier.contains = true;
            state = EQUAL;
            break;
          }

          if (c == '=') {
            currentQualifier.attrValue = '';
            state = VALUE_FIRST_CHAR;
            break;
          }

          if (c == ']') {
            state = QUALIFIER;
            break;
          }

          if (c.match(WHITESPACE))
            break;

          throw Error(SYNTAX_ERROR);

        case EQUAL:
          if (c == '=') {
            currentQualifier.attrValue = '';
            state = VALUE_FIRST_CHAR
            break;
          }

          throw Error(SYNTAX_ERROR);

        case ATTR_QUAL_END:
          if (c == ']') {
            state = QUALIFIER;
            break;
          }

          if (c.match(WHITESPACE))
            break;

          throw Error(SYNTAX_ERROR);

        case VALUE_FIRST_CHAR:
          if (c.match(WHITESPACE))
            break;

          if (c == '"' || c == "'") {
            valueQuoteChar = c;
            state = QUOTED_VALUE;
            break;
          }

          currentQualifier.attrValue += c;
          state = VALUE;
          break;

        case VALUE:
          if (c.match(WHITESPACE)) {
            state = ATTR_QUAL_END;
            break;
          }
          if (c == ']') {
            state = QUALIFIER;
            break;
          }
          if (c == "'" || c == '"')
            throw Error(SYNTAX_ERROR);

          currentQualifier.attrValue += c;
          break;

        case QUOTED_VALUE:
          if (c == valueQuoteChar) {
            state = ATTR_QUAL_END;
            break;
          }

          currentQualifier.attrValue += c;
          break;

        case SELECTOR_SEPARATOR:
          if (c.match(WHITESPACE))
            break;

          if (c == ',') {
            state = SELECTOR;
            break
          }

          throw Error(SYNTAX_ERROR);
      }
    }

    switch (state) {
      case SELECTOR:
      case TAG_NAME:
      case QUALIFIER:
      case QUALIFIER_NAME:
      case SELECTOR_SEPARATOR:
        // Valid end states.
        newSelector();
        break;
      default:
        throw Error(SYNTAX_ERROR);
    }

    if (!selectorGroup.length)
      throw Error(SYNTAX_ERROR);

    function escapeQuotes(value) {
      return '"' + value.replace(/"/, '\\\"') + '"';
    }

    selectorGroup.forEach(function(selector) {
      var caseInsensitiveTagName = selector.tagName.toUpperCase();
      if (selector.tagName != caseInsensitiveTagName)
        selector.caseInsensitiveTagName = caseInsensitiveTagName;

      var selectorString = selector.tagName;

      selector.qualifiers.forEach(function(qualifier) {
        if (qualifier.class)
          selectorString += '.' + qualifier.attrValue;
        else if (qualifier.id)
          selectorString += '#' + qualifier.attrValue;
        else {
          var caseInsensitiveAttrName = qualifier.attrName.toLowerCase();
          if (qualifier.attrName != caseInsensitiveAttrName)
            qualifier.caseInsensitiveAttrName = caseInsensitiveAttrName;

          if (qualifier.contains)
            selectorString += '[' + qualifier.attrName + '~=' + escapeQuotes(qualifier.attrValue) + ']';
          else {
            selectorString += '[' + qualifier.attrName;
            if (qualifier.hasOwnProperty('attrValue'))
              selectorString += '=' + escapeQuotes(qualifier.attrValue);
            selectorString += ']';
          }
        }
      });

      selector.selectorString = selectorString;
    });

    return selectorGroup;
  }

  var attributeFilterPattern = /^([a-zA-Z:_]+[a-zA-Z0-9_\-:\.]*)$/;

  function validateAttribute(attribute) {
    if (typeof attribute != 'string')
      throw Error('Invalid request opion. attribute must be a non-zero length string.');

    attribute = attribute.trim();

    if (!attribute)
      throw Error('Invalid request opion. attribute must be a non-zero length string.');


    if (!attribute.match(attributeFilterPattern))
      throw Error('Invalid request option. invalid attribute name: ' + attribute);

    return attribute;
  }

  function validateElementAttributes(attribs) {
    if (!attribs.trim().length)
      throw Error('Invalid request option: elementAttributes must contain at least one attribute.');

    var lowerAttributes = {};
    var attributes = {};

    var tokens = attribs.split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      var attribute = tokens[i];
      if (!attribute)
        continue;

      var attribute = validateAttribute(attribute);
      if (lowerAttributes.hasOwnProperty(attribute.toLowerCase()))
        throw Error('Invalid request option: observing multiple case varitations of the same attribute is not supported.');
      attributes[attribute] = true;
      lowerAttributes[attribute.toLowerCase()] = true;
    }

    return Object.keys(attributes);
  }

  function validateOptions(options) {
    var validOptions = {
      'callback': true, // required
      'queries': true,  // required
      'rootNode': true,
      'oldPreviousSibling': true,
      'observeOwnChanges': true
    };

    var opts = {};

    for (var opt in options) {
      if (!(opt in validOptions))
        throw Error('Invalid option: ' + opt);
    }

    if (typeof options.callback !== 'function')
      throw Error('Invalid options: callback is required and must be a function');

    opts.callback = options.callback;
    opts.rootNode = options.rootNode || document;
    opts.observeOwnChanges = options.observeOwnChanges;
    opts.oldPreviousSibling = options.oldPreviousSibling;

    if (!options.queries || !options.queries.length)
      throw Error('Invalid options: queries must contain at least one query request object.');

    opts.queries = [];

    for (var i = 0; i < options.queries.length; i++) {
      var request = options.queries[i];

      // all
      if (request.all) {
        if (Object.keys(request).length > 1)
          throw Error('Invalid request option. all has no options.');

        opts.queries.push({all: true});
        continue;
      }

      // attribute
      if (request.hasOwnProperty('attribute')) {
        var query = {
          attribute: validateAttribute(request.attribute)
        };

        query.elementFilter = parseElementFilter('*[' + query.attribute + ']');

        if (Object.keys(request).length > 1)
          throw Error('Invalid request option. attribute has no options.');

        opts.queries.push(query);
        continue;
      }

      // element
      if (request.hasOwnProperty('element')) {
        var requestOptionCount = Object.keys(request).length;
        var query = {
          element: request.element,
          elementFilter: parseElementFilter(request.element)
        };

        if (request.hasOwnProperty('elementAttributes')) {
          query.elementAttributes = validateElementAttributes(request.elementAttributes);
          requestOptionCount--;
        }

        if (requestOptionCount > 1)
          throw Error('Invalid request option. element only allows elementAttributes option.');

        opts.queries.push(query);
        continue;
      }

      // characterData
      if (request.characterData) {
        if (Object.keys(request).length > 1)
          throw Error('Invalid request option. characterData has no options.');

        opts.queries.push({ characterData: true });
        continue;
      }

      throw Error('Invalid request option. Unknown query request.');
    }

    return opts;
  }

  function elementFilterAttributes(filters) {
    var attributes = {};

    filters.forEach(function(filter) {
      filter.qualifiers.forEach(function(qualifier) {
        if (qualifier.class)
          attributes['class'] = true;
        else if (qualifier.id)
          attributes['id'] = true;
        else
          attributes[qualifier.attrName] = true;
      });
    });

    return Object.keys(attributes);
  }

  function createObserverOptions(queries) {
    var observerOptions = {
      childList: true,
      subtree: true
    };

    var attributeFilter;
    function observeAttributes(attributes) {
      if (observerOptions.attributes && !attributeFilter)
        return; // already observing all.

      observerOptions.attributes = true;
      observerOptions.attributeOldValue = true;

      if (!attributes) {
        // observe all.
        attributeFilter = undefined;
        return;
      }

      // add to observed.
      attributeFilter = attributeFilter || {};
      attributes.forEach(function(attribute) {
        attributeFilter[attribute] = true;
        attributeFilter[attribute.toLowerCase()] = true;
      });
    }

    queries.forEach(function(request) {
      if (request.characterData) {
        observerOptions.characterData = true;
        observerOptions.characterDataOldValue = true;
        return;
      }

      if (request.all) {
        observeAttributes();
        observerOptions.characterData = true;
        observerOptions.characterDataOldValue = true;
        return;
      }

      if (request.attribute) {
        observeAttributes([request.attribute.trim()]);
        return;
      }

      if (request.elementFilter && request.elementFilter.some(function(f) { return f.className; } ))
         observeAttributes(['class']);

      var attributes = elementFilterAttributes(request.elementFilter).concat(request.elementAttributes || []);
      if (attributes.length)
        observeAttributes(attributes);
    });

    if (attributeFilter)
      observerOptions.attributeFilter = Object.keys(attributeFilter);

    return observerOptions;
  }

  function createSummary(projection, root, query) {
    projection.elementFilter = query.elementFilter;
    projection.filterCharacterData = query.characterData;

    var summary = {
      target: root,
      type: 'summary',
      added: [],
      removed: []
    };

    summary.getOldParentNode = projection.getOldParentNode.bind(projection);

    if (query.all || query.element)
      summary.reparented = [];

    if (query.all)
      summary.reordered = [];

    projection.getChanged(summary);

    if (query.all || query.attribute || query.elementAttributes) {
      var filter = query.attribute ? [ query.attribute ] : query.elementAttributes;
      var attributeChanged = projection.getAttributesChanged(filter);

      if (query.attribute) {
        summary.valueChanged = [];
        if (attributeChanged[query.attribute])
          summary.valueChanged = attributeChanged[query.attribute];

        summary.getOldAttribute = function(node) {
          return projection.getOldAttribute(node, query.attribute);
        }
      } else {
        summary.attributeChanged = attributeChanged;
        if (query.elementAttributes) {
          query.elementAttributes.forEach(function(attrName) {
            if (!summary.attributeChanged.hasOwnProperty(attrName))
              summary.attributeChanged[attrName] = [];
          });
        }
        summary.getOldAttribute = projection.getOldAttribute.bind(projection);
      }
    }

    if (query.all || query.characterData) {
      var characterDataChanged = projection.getCharacterDataChanged()
      summary.getOldCharacterData = projection.getOldCharacterData.bind(projection);

      if (query.characterData)
        summary.valueChanged = characterDataChanged;
      else
        summary.characterDataChanged = characterDataChanged;
    }

    if (summary.reordered)
      summary.getOldPreviousSibling = projection.getOldPreviousSibling.bind(projection);

    return summary;
  }

  function MutationSummary(opts) {
    var connected = false;
    var options = validateOptions(opts);
    var observerOptions = createObserverOptions(options.queries);

    var root = options.rootNode;
    var callback = options.callback;

    var elementFilter = Array.prototype.concat.apply([], options.queries.map(function(query) {
      return query.elementFilter ? query.elementFilter : [];
    }));
    if (!elementFilter.length)
      elementFilter = undefined;

    var calcReordered = options.queries.some(function(query) {
      return query.all;
    });

    var queryValidators = []
    if (MutationSummary.createQueryValidator) {
      queryValidators = options.queries.map(function(query) {
        return MutationSummary.createQueryValidator(root, query);
      });
    }

    function checkpointQueryValidators() {
      queryValidators.forEach(function(validator) {
        if (validator)
          validator.recordPreviousState();
      });
    }

    function runQueryValidators(summaries) {
      queryValidators.forEach(function(validator, index) {
        if (validator)
          validator.validate(summaries[index]);
      });
    }

    function createSummaries(mutations) {
      if (!mutations || !mutations.length)
        return [];

      var projection = new MutationProjection(root, elementFilter, calcReordered, options.oldPreviousSibling);
      projection.processMutations(mutations);

      return options.queries.map(function(query) {
        return createSummary(projection, root, query);
      });
    }

    function changesToReport(summaries) {
      return summaries.some(function(summary) {
        var summaryProps =  ['added', 'removed', 'reordered', 'reparented',
                             'valueChanged', 'characterDataChanged'];
        if (summaryProps.some(function(prop) { return summary[prop] && summary[prop].length; }))
          return true;

        if (summary.attributeChanged) {
          var attrsChanged = Object.keys(summary.attributeChanged).some(function(attrName) {
            return summary.attributeChanged[attrName].length
          });
          if (attrsChanged)
            return true;
        }
        return false;
      });
    }

    var observer = new MutationObserver(function(mutations) {
      if (!options.observeOwnChanges)
        observer.disconnect();

      var summaries = createSummaries(mutations);
      runQueryValidators(summaries);

      if (options.observeOwnChanges)
        checkpointQueryValidators();

      if (changesToReport(summaries))
        callback(summaries);

      // disconnect() may have been called during the callback.
      if (!options.observeOwnChanges && connected) {
        checkpointQueryValidators();
        observer.observe(root, observerOptions);
      }
    });

    this.reconnect = function() {
      if (connected)
        throw Error('Already connected');

      observer.observe(root, observerOptions);
      connected = true;
      checkpointQueryValidators();
    };

    var takeSummaries = this.takeSummaries = function() {
      if (!connected)
        throw Error('Not connected');

      var mutations = observer.takeRecords();
      var summaries = createSummaries(mutations);
      if (changesToReport(summaries))
        return summaries;
    };

    this.disconnect = function() {
      var summaries = takeSummaries();

      observer.disconnect();
      connected = false;

      return summaries;
    };

    this.reconnect();
  }

  // Externs
  global.MutationSummary = MutationSummary;
  global.MutationSummary.NodeMap = NodeMap; // exposed for use in TreeMirror.
  global.MutationSummary.parseElementFilter = parseElementFilter; // exposed for testing.
})(this);


/*==========================================================================================================================*/

/*
 * Browser event handler
 * 
 * listener
 * {
		onDOMUpdate(hsBrowserHandler handler, String parent_id, String prev_sibling_id, Node xml_dom);
		onDOMDelete(hsBrowserHandler handler, String[] node_ids);
		onDOMInit(hsBrowserHandler handler, Node xml_dom);
		onDOMMove(hsBrowserHandler handler, String new_parent_id, String new_prev_sibling_id, String moved_node_id);
		onDOMAttrChange(hsBrowserHandler handler, String[] node_id, String[] attr, String[] values);
		onDOMAttrDelete(hsBrowserHandler handler, String[] node_id, String[] attr);
		onValueChange(hsBrowserHandler handler, String node_id, String value);
 * }
 * 
 * Implement this handler in the following order:
 * 1) Implement static part (init)
 * 2) Implement highlight
 * 3) Implement dynamic part (load/unload/pageshow) that can call onDOMInit (when whole page will be loaded)
 * 4) Implement dynamic part 2 (use mutation_summary): changes in 

 * 5) Implement frame support (Don't forget, that frames can be removed/created too, as any other document node)
 * 6) Implement value change event listener for input nodes.
 */

/*hsBrowserHandler*/ function hsCreateBrowserHandler(/*Browser*/br, /*Listener*/ listener, 
		/*long*/ tabId, /*custom filter ignoreCheckFn(Node to check)*/ ignoreCheckFunction)
{	
	function initializeDocument()
	{
		var observer = new MutationSummary({
		  callback: handleChanges,
		  rootNode: br.contentDocument,
		  queries: [{all:true}]
		});
		
		newNodeId = 1;
		docToSend = br.contentDocument;
		initializeNodeMap(br.contentDocument.documentElement);
		var xmlDocument = br.contentDocument.implementation.createDocument('http://www.w3.org/1999/xhtml','HTML', null);
		var xmlPayload = createXMLPayload(xmlDocument, docToSend.documentElement);
		listener.onDOMInit(obj , xmlPayload, tabId);
	}

	function handleLoad(event)
	{
		var eventDocument = event.target;
		if(eventDocument == br.contentDocument)
		{
			if(docToSend == null)
			{
				initializeDocument();
			}
		}
	}

	function handlePageHide(event)
	{
		docToSend = null;
		// Release Mutation observer??
	}

	var newNodeId = 0;

	var nodeMap = {};	// map id -> node

	var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);

	var obj = {
			highlight: function(/*String[]*/ ids)
			{
				// Clear current highlightning, 
				// highlight new set of nodes				         
				for (var index in ids) {
					//We do not want to highlight entire page
					if(ids[index] == 0 )
						continue;
					else
					{
						// Clear current highlightning,
						ClearHighlightsDoc(br.contentDocument);						
						var nodeObject = this.getNode(ids[index]);						                                              
						SetHighlightControl(nodeObject);
					}
				}                
			},
			getNode: function(/*String*/ id)
			{
				if(id in nodeMap)
				{
					return nodeMap[id];
				}
				return null;
			},
			/*String*/getNodeId: function(/*Node*/node)
			{
				return node._internalNodeId;
			},
			getURL: function()
			{
				return br.contentDocument.URL;
			},
			release: /*void*/ function()
			{
				br.removeEventListener('load', handleLoad);
				br.removeEventListener('DOMContentLoaded', handleLoad);
				br.removeEventListener('pageshow', handleLoad);
				br.removeEventListener('pagehide', handlePageHide);
			},
			getBrowser:function() { return br; }
	};

	function copyAttributes(htmlDocNode, xmlDocNode)
	{
		if(htmlDocNode.hasAttributes())
		{
			for(var x=0; x < htmlDocNode.attributes.length ; x++)
			{
				var attributeNode = htmlDocNode.attributes[x];
				xmlDocNode.setAttribute(attributeNode.nodeName,attributeNode.nodeValue);
			}
		}
		return xmlDocNode;
	}

	/**
	 * TODO: Ignore empty nodes where you assign id's when storing nodes in node map
	 * 
	 */
	function createXMLPayload(xmlDocument, documentRootNode)
	{
		/**
		 * Checking for empty nodes
		 */
		//Creates an XML payload in reference to the current node map by traversing the given document
		//log('Creating payload now for document node  : ' + documentRootNode.nodeName);

		var internalNodeId = obj.getNodeId(documentRootNode);

		if(internalNodeId != null)
		{
			//Check if this document node is a text node
			if(documentRootNode.nodeType == 3)
			{
				if(documentRootNode.nodeValue.trim() != '')
				{
					var newTextElement = xmlDocument.createElement("textelement");
					newTextElement.setAttribute("node_id" , internalNodeId);
					var newtextNode = xmlDocument.createTextNode(documentRootNode.nodeValue);
					newTextElement.appendChild(newtextNode);
					return newTextElement;
				}            
			}
			else
			{
				var xmlRootNode = xmlDocument.createElement(documentRootNode.nodeName);
				xmlRootNode = copyAttributes(documentRootNode, xmlRootNode);
				xmlRootNode.setAttribute("node_id",internalNodeId);
				for(var x=0 ; x < documentRootNode.childNodes.length ; x++)
				{
					var childNode = documentRootNode.childNodes[x];
					var elementToAppend = createXMLPayload(xmlDocument, childNode);
					if(elementToAppend != null)
					{
						xmlRootNode.appendChild(elementToAppend);
					}
				}
				//log("Returning xmlRootNode : " + xmlRootNode);
				return xmlRootNode;
			}
		}
		else
		{
			//log("Returning null for xmlRootNode : " + documentRootNode.nodeName);
			return null;
		}
	}

	/**
	 * Initialize the node map from the document tree provided and filter nodes with the provided filter callback
	 */
	function initializeNodeMap(root)
	{
		if(ignoreCheckFunction(root))
			return;

		//log('Initializing node map for document node : ' + root.nodeName + " with value : " + root.nodeValue + " and type : " + root.nodeType);
		//Invoke specified filter that checks if the given node must be ignored or not
		nodeMap[newNodeId] = root;
		root._internalNodeId = newNodeId;
		newNodeId++;

		if(root.hasChildNodes())
			for(var x=0; x<root.childNodes.length; x++)
				initializeNodeMap(root.childNodes[x]);
	}

	function log(msg) 
	{	
		consoleService.logStringMessage("brhandler] "+msg);	
	}

	// TODO: add implementation.
	// use br events to control load page process,
	// use mutation observer to control page mutations

	//log('hsCreateBrowserHandler invoked with document status : ' + document.readyState);

	var docToSend = null;

	if(br.contentDocument.readyState === "complete" || br.contentDocument.readyState === "interactive")
	{
		//log('document loading is now complete : ' + br.contentDocument.readyState + 'with URL as ' + br.contentDocument.URL);
		docToSend = br.contentDocument;
		initializeNodeMap(br.contentDocument.documentElement);
		var xmlDocument = br.contentDocument.implementation.createDocument('http://www.w3.org/1999/xhtml','HTML', null);
		//log(br.contentDocument.body.hasChildNodes());
		var xmlPayload = createXMLPayload(xmlDocument, docToSend.documentElement);
		log("This was the payload generated : " + xmlPayload);
		listener.onDOMInit(obj , xmlPayload, tabId);
	}
	
	function handleChanges(summaries)
	{
		var summary = summaries[0];
		
		updateDOM(summary);
		deleteDOM(summary);
		attrChange(summary);
		moveDOM(summary);
	}
	
	function updateDOM(summary)
	{
		var elements = new Array();
		var parents = new Array();
		var siblings = new Array();
		var i = 0;
		
		summary.added.forEach(function(element)
		{					
			var parent = element.parentNode;
			var sibling = element.previousSibling;
			
			if(parent != null && parent._internalNodeId != undefined && !find(parent,elements))
			{
				elements[i] = element;
				parents[i] = parent;
				siblings[i] = sibling;
				i++;
			}
		}); 
		
		handleAddedElements(elements,parents,siblings);
	}

	function moveDOM(summary)
	{
		var elements = new Array();
		var parents = new Array();
		var siblings = new Array();
		var i = 0;
		
		summary.reparented.forEach(function(reparent)
		{
			var parent = reparent.parentNode;
			var sibling = reparent.previousSibling;
			
			if(parent != null && parent._internalNodeId != undefined && !find(parent,elements))
			{
				elements[i] = reparent;
				parents[i] = parent;
				siblings[i] = sibling;
				i++;
			}
			
		});
		 		
 		summary.reordered.forEach(function(reorder)
		{
 			var parent = reorder.parentNode;
			var sibling = reorder.previousSibling;
			
			if(parent != null && parent._internalNodeId != undefined && !find(parent,elements))
			{
				elements[i] = reorder;
				parents[i] = parent;
				siblings[i] = sibling;
				i++;
			}
		});
 		
 		handleMovedElements(elements,parents,siblings);
 		
	}
	
	function handleMovedElements(elements,parents,siblings)
	{
		for(var j = 0; j < elements.length; j++)
		{
			var new_parent_id = "";
			var new_prev_sibling_id = "";
			var moved_node_id = elements[j]._internalNodeId;
			
			if(parents[j]._internalNodeId != undefined)
			{
				new_parent_id = parents[j]._internalNodeId;
			}
			if(siblings[j] != null && siblings[j]._internalNodeId != undefined)
			{
				new_prev_sibling_id = siblings[j]._internalNodeId;
			}
			
			listener.onDOMMove(obj , new_parent_id, new_prev_sibling_id, moved_node_id , tabId);
		}
	}
	
	function handleAddedElements(elements,parents,siblings)
	{
		for(var j = 0; j < elements.length; j++)
		{
			var parent_id = "";
			var prev_sibling_id = "";	
			initializeNodeMap(elements[j]);
			var xmlDocument = br.contentDocument.implementation.createDocument('http://www.w3.org/1999/xhtml','HTML', null);
			var xmlPayload = createXMLPayload(xmlDocument, elements[j]);
			if(xmlPayload != null)
			{
				if(parents[j]._internalNodeId != undefined)
				{
					parent_id = parents[j]._internalNodeId;
				}
				if(siblings[j] != null && siblings[j]._internalNodeId != undefined)
				{
					prev_sibling_id = siblings[j]._internalNodeId;
				}
				listener.onDOMUpdate(obj , parent_id, prev_sibling_id, xmlPayload, tabId);
			}
		}
	}
	
	function deleteDOM(summary)
	{
		var removed = new Array();
		var i = 0;
		summary.removed.forEach(function(removedEl)
		{
			
			if(removedEl._internalNodeId != undefined)
			{
				removed[i] = removedEl._internalNodeId;
				delete nodeMap[removed[i]];
				i++;
			}
	    });
		
		if(removed.length > 0)
			listener.onDOMDelete(obj , removed, tabId);
	}
	
	function attrChange(summary)
	{
		var node_id = new Array();
		var attr = new Array();
		var values = new Array();
		var removed_node_id = new Array();
		var removed_attr = new Array();
		var i = 0, k = 0;
		Object.keys(summary.attributeChanged).forEach(function(attrName)
		{
			for(var j = 0; j < summary.attributeChanged[attrName].length; j++)
			{				
	            if(summary.attributeChanged[attrName][j].getAttribute(attrName))
	            {
		            node_id[i] = summary.attributeChanged[attrName][j]._internalNodeId;
		            attr[i] = attrName;
		            values[i] = summary.attributeChanged[attrName][j].getAttribute(attrName);
		            i++;
	            }
	            else
	            {
	            	removed_node_id[k] = summary.attributeChanged[attrName][j]._internalNodeId;
		            removed_attr[k] = attrName;
		            k++;
	            }
			}
		});	
		
		if(node_id.length > 0)
			listener.onDOMAttrChange(obj, node_id, attr, values, tabId);
		if(removed_node_id.length > 0)
			listener.onDOMAttrDelete(obj, removed_node_id, removed_attr, tabId);
	}
		
	function find(parent,elements)
	{
		for(var j=0; j<elements.length; j++)
		{
			if(elements[j]==parent)
			{ 
				return true;
			}
		}
		return false;
	}
	
	/**
	 * Update part of document, receive load as well as DOMContentLoad
	 */

	br.addEventListener('load', handleLoad, false);
	br.addEventListener('DOMContentLoaded', handleLoad, false);
	br.addEventListener('pageshow', handleLoad, false);
	br.addEventListener('pagehide', handlePageHide, false);

	return obj;
}