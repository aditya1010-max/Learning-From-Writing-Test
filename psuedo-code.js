function validateCrossingNode(node, graph) {
    // STEP 1: Eligibility
    if (!isCrossingCandidate(node, graph)) {
        return null;
    }

    // STEP 2: Get parent ways
    const parentWays = graph.parentWays(node);

    const crossingWays = parentWays.filter(isCrossingWay);

    if (crossingWays.length === 0) {
        return null;
    }

    // STEP 3: Extract expected tags
    let expectedTags = {};

    for (let way of crossingWays) {
        const tags = extractRelevantCrossingTags(way.tags);
        expectedTags = mergeTags(expectedTags, tags);
    }

    // STEP 4: Normalize
    const normalizedNode = normalizeCrossingTags(node.tags);
    const normalizedExpected = normalizeCrossingTags(expectedTags);

    // STEP 5: Compare
    const diff = diffTags(normalizedNode, normalizedExpected);

    if (!diff.hasChanges) {
        return null;
    }

    // STEP 6: Resolve conflicts
    if (hasMultipleCrossableParents(node, parentWays)) {
        return handleMultiParentCase(node, diff);
    }

    // STEP 7: Apply fix
    return buildFix({
        node: node,
        add: diff.missing,
        update: diff.conflicting,
        preserve: diff.preserve
    });
}
