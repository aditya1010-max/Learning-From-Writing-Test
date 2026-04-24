function isCrossingCandidate(node, graph) {
    if (isEndpoint(node)) return false;

    const ways = graph.parentWays(node);

    return ways.some(isRoad) && ways.some(isCrossingWay);
}
