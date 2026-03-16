test block -

    it('normalizes legacy crossing=zebra to crossing:markings=zebra', function() {    //this block will check the part of validator that will trigger when a user interacts with that old data.
        createCrossing({ highway: 'footway', footway: 'crossing', crossing: 'zebra' }, {});
        var issues = validate();
        // The validator should find a mismatch because the node doesn't have the markings yet
        // but it should also show that it has "cleaned" the tags for the fix
        expect(issues[0].subtype).to.eql('mismatched_crossing_tags');
    });


why -

- this will test the part of validator that will normalize the crossing=zebra (a legacy tag)
- we will basically look at the node and see if its empty by comparing crossing=zebra and crossing:marking=zebra
- if we see nothing in the node then flag the error 



test block -

    it('skips normalization when semicolons are present', function() {
        createCrossing({ 'crossing:markings': 'zebra;lines' }, {});
        // Logic from Section 4: If semicolons exist, return tags as-is (no sync/cleanup)
        var issues = validate();
        expect(issues).to.have.lengthOf(0);
    });


why -

- this block will test the function that will ignore normalization we have done in above block beacuse we have more than 1 tag value 
- this is for safety(you dont want to remove tags that you dont know want to keep)
- The Ambiguity Problem - if the way has crossing:markings=zebra;lines and node it crosses has crossing:markings=lines - the validator dosent know which one is correct? should it add zebra or remove.
- standard mappers usually select one option from a dropdown, whereas advance mappers use ; to provide extreme details. the validator will therefore catch simple mistakes(from beginners) and respect the experts who are likely doing something intentional that dosent fit the standard "1-to-1 sysc" model



test block -

    it('flags when a crossing midpoint node is missing tags from the way', function() {
        createCrossing({ highway: 'footway', footway: 'crossing', 'crossing:markings': 'zebra' }, { highway: 'crossing' });
        var issues = validate();
        expect(issues).to.have.lengthOf(1);
        expect(issues[0].message).to.contain('Crossing tags mismatch');
    });


why -

- this block will check the part of validator that detects the conflict between way and node tags
- for example, way is highway=footway, footway=crossing, crossing:markings=zebra (very specific) and node is just (highway=crossing) very vague. 
- Because crossing:markings is in our SYNCED_KEYS list, the validator expects them to be identical. Since they aren't, it triggers the warning.
- the validator will not throw any error but the specific about mismatch "validator tag mismatch"



test block -

    it('ignores endpoints even if they are on a crossing way', function() {
        var n1 = iD.osmNode({id: 'n-1', loc: [0,0], tags: {}}); // Endpoint
        var n2 = iD.osmNode({id: 'n-2', loc: [1,1], tags: {}}); // Midpoint
        var w = iD.osmWay({id: 'w-1', nodes: ['n-1', 'n-2'], tags: { highway: 'footway', footway: 'crossing', 'crossing:markings': 'zebra' }});
        
        context.perform(iD.actionAddEntity(n1), iD.actionAddEntity(n2), iD.actionAddEntity(w));
        
        var validator = iD.validationCrossingVertexTags(context);
        var node1Issues = validator(n1, context.graph());
        expect(node1Issues).to.have.lengthOf(0); // Endpoint n1 is ignored
    });


why -

 - this block of code will check for boundry logic and make sure our validator dosent go crazy and starts flagging endpoints(ideally endpoints should be empty or contain sideway tags, but then validator will flag lot of errors)
 - this is a "Negative test" that will help us find errors and make sure validator dosent find an error where one shouldnt exist 



test block -

    // 3. PRESERVE KEYS (Section 1.2)
    it('does not flag a mismatch when way lacks a preserve key that the node has', function() {
        // crossing_ref is a preserve key
        createCrossing({ highway: 'footway', footway: 'crossing' }, { 'crossing_ref': '123' });
        var issues = validate();
        // Even though way doesn't have crossing_ref, we don't delete it from node or flag error
        expect(issues).to.have.lengthOf(0); 
    });


why -

- this block of code will check the logic that will have crossing_ref in the node
- logic will look at node which has tag- crossing_ref and look at way and see it is absent, then check the Preserve List, and found out crossing_ref is on the list, the logic will ignore it and move on
- expect(issues).to.have.lengthOf(0); will make sure logic returns nothing
- "It is okay for a Point to have more specific ID/Asset information than the Line it sits on." 



test block -

    // 4. NODE-ONLY HIGHWAY (Section 1.3)
    it('flags when node needs highway=crossing added for formal crossings', function() {
        createCrossing({ highway: 'footway', footway: 'crossing', 'crossing:markings': 'zebra' }, { }); 
        var issues = validate();
        // Should flag because node lacks the 'crossing' value in its highway tag
        expect(issues).to.have.lengthOf(1);
    });


why-

- this block checks if the node and way both have highway=label tag 
- the validator needs to know the difference beacuse we only sync tag if it is formal crossing
- the logic is like - If the Way is explicitly a crossing, the Node must also have the highway=crossing tag to be valid. The validator flags this because you can't have a "Zebra" marking on a point that isn't officially labeled as a crossing point.



test block -

    it('supports multivalue highway tags (e.g., traffic_signals)', function() {
        createCrossing({ 'crossing:signals': 'yes' }, { highway: 'traffic_signals' });
        var issues = validate();
        // The expected fix/sync would result in highway=traffic_signals;crossing
        expect(issues).to.have.lengthOf(1);
    });


why-

- in a scenario where a single point of intersection having two things at once like (a) a set of traffic signals(highway=traffic_signal) (b) a pedestrian crossing(highway=crossing)
- the conflict occurs when the mapper has defined the way(the path) as having signal(crossing:signal=yes)
however the node only has "traffic signal" badge(no "crossing" badge). This node is a signal, but since its on a crossing path it needs to be labelled as a crossing too 
- it will be bad if validator try to overwrite the tag, changing traffic_signal to crossing, we would loose information on spot.
- instead this test proves that validor will surpport multi-value tags. when user clicks "Fix" the validator will join the values with a semicolon. 
- New Tag: highway=traffic_signals;crossing



test block -

    // 5. CLEANUP SAFEGUARD (Section 3.1)
    it('does not strip crossing tags from a node if it has another crossable parent', function() {
        var items = createCrossing({ highway: 'stream' }, { 'crossing:markings': 'zebra' });
        // Even though 'stream' is not crossable, the node is also part of a 'residential' road
        // (created in our helper), so the crossing tags should be left alone.
        var issues = validate();
        expect(issues).to.have.lengthOf(0);
    });


why-

- the setup is like way1: road(highway=residential) , way2: stream(highway=stream) and node has crossing:marking=zebra
- the confict is zebra crossing on a river, this is not pssible and we should delete it 
- but before deleting, we should check if the node, if zebracrossing is not for road then we must leave the alone 
- This test proves that as long as there is AT LEAST ONE valid, crossable way attached to the node, the crossing tags are safe.



test block -

    it('does not give crossing tags to midpoints that only belong to the crossing way', function() {
        // n2 is a midpoint of a crossing way, but it does NOT intersect any other road
        var n1 = iD.osmNode({id: 'n-1', loc: [0,0]});
        var n2 = iD.osmNode({id: 'n-2', loc: [1,1]}); // The "Sidewalk Only" midpoint
        var n3 = iD.osmNode({id: 'n-3', loc: [2,2]});
        var w = iD.osmWay({id: 'w-1', nodes: ['n-1', 'n-2', 'n-3'], 
                        tags: { highway: 'footway', footway: 'crossing', 'crossing:markings': 'zebra' }});
        
        context.perform(iD.actionAddEntity(n1), iD.actionAddEntity(n2), iD.actionAddEntity(n3), iD.actionAddEntity(w));
        
        var issues = validate();
        // n2 should NOT be flagged as "missing tags" because it isn't an intersection with a road
        expect(issues).to.have.lengthOf(0);
    });


why -

-  its like, if a node it at the midway of way , it dosnet need to be labeled as highway=cossing , whereas if the node is present at the intersection of way and path , then it needs to have crossing tag



test block-

    it('upgrades legacy crossing=yes to crossing=marked when markings are present', function() {
        createCrossing({ 'crossing': 'yes', 'crossing:markings': 'zebra' }, {});
        var issues = validate();
        // This should trigger a cleanup that prefers the specific 'marked' over the vague 'yes'
        expect(issues[0].subtype).to.eql('mismatched_crossing_tags');
    });


why -

- This block targets legacy 'crossing=yes' tags. In modern OSM standards, if specific markings (like 'zebra') are present, the primary tag should be 'crossing=marked' rather than the vague 'yes'. The validator flags this as a 'mismatched_crossing_tags' error to prompt mappers to upgrade old data to current specifications when they interact with it in the editor.
 


test block-

    it('syncs tags to multiple valid intersection midpoints on a single crossing way', function() {
        // Create two road ways
        var w_road1 = iD.osmWay({id: 'w-road1', nodes: ['n-a', 'n-mid1', 'n-b'], tags: { highway: 'residential' }});
        var w_road2 = iD.osmWay({id: 'w-road2', nodes: ['n-c', 'n-mid2', 'n-d'], tags: { highway: 'residential' }});
        
        // Create one crossing way that spans both roads
        var w_cross = iD.osmWay({id: 'w-cross', nodes: ['n-start', 'n-mid1', 'n-mid2', 'n-end'], 
            tags: { highway: 'footway', footway: 'crossing', 'crossing:markings': 'zebra' }});
        
        context.perform(
            iD.actionAddEntity(w_road1), iD.actionAddEntity(w_road2), iD.actionAddEntity(w_cross)
        );

        var issues = validate();
        // Both n-mid1 and n-mid2 should be flagged for missing zebra tags
        // (Total issues = 2 because each node needs a fix)
        expect(issues).to.have.lengthOf(2);
    });


why -

Road A (Northbound)          Road B (Southbound)
               |                            |
               |          Node 1            |          Node 2
  [Start]------|------------(X)-------------|-----------(X)------------[End]
               |      (First Junction)      |      (Second Junction)
               |                            |
               |                            |

- this scenerio happens when a pedestrian crossing goes across a dual carriageway (a large road with a median or divider in the middle)
- instead of one single interaction, the crossing path hits the first road, then the second half.
- validator would check both nodes, checks if it touches road A, checks if it has zebra tags, if not then falg it. Similarly checks 2nd node. 
- this test ensures that every single spot where a pedestrian might encounter a car on the path is correctly tagged