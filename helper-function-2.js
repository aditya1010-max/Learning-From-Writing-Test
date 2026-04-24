function normalizeCrossingTags(tags) {
    let t = { ...tags };

    // zebra normalization
    if (t.crossing === 'zebra') {
        t['crossing:markings'] = 'zebra';
        delete t.crossing;
    }

    // pelican → signals
    if (t.crossing_ref === 'pelican') {
        t['crossing:signals'] = 'yes';
    }

    // informal
    if (t.crossing === 'informal') {
        t['crossing:markings'] = 'no';
    }

    // upgrade logic
    if (t['crossing:signals'] === 'yes') {
        t.crossing = 'traffic_signals';
    }

    return t;
}
