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
- The logic checks a node with the crossing_ref tag, sees that it is absent on the way, then checks the preserve list and finds that crossing_ref is included, so it ignores it and moves on
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
- the validator logic is like - If the Way is explicitly a crossing, the Node must also have the highway=crossing tag to be valid. The validator flags this because you can't have a "Zebra" marking on a point that isn't officially labeled as a crossing point.



test block -

    it('supports multivalue highway tags (e.g., traffic_signals)', function() {
        createCrossing({ 'crossing:signals': 'yes' }, { highway: 'traffic_signals' });
        var issues = validate();
        // The expected fix/sync would result in highway=traffic_signals;crossing
        expect(issues).to.have.lengthOf(1);
    });


why-

- in a scenario where a single point of intersection having two things at once like (a) a set of traffic signals(highway=traffic_signal) (b) a pedestrian crossing(highway=crossing)
- the conflict occurs when the mapper has defined the way as having signal(crossing:signal=yes)
however the node only has "traffic signal" badge(no "crossing" badge). This node is a signal, but since its on a crossing path it needs to be labelled as a crossing too 
- it will be bad if validator try to overwrite the tag, changing traffic_signal to crossing, we would loose information on spot.
- instead this test verifies that validator will surpport multi-value tags. when user clicks "Fix" the validator will join the values with a semicolon. 
- New Tag: highway=traffic_signals;crossing




test block -

    it('handles incomplete crossing tags by merging instead of overwriting', function() {
        // Node has markings but no highway=crossing
        var n = iD.osmNode({id: 'n-1', loc: [0,0], tags: { 'crossing:markings': 'zebra' }});
        // Way has highway=crossing but no markings
        var w = iD.osmWay({id: 'w-1', nodes: ['n-start', 'n-1', 'n-end'], 
            tags: { highway: 'footway', footway: 'crossing' }});
        var w_road = iD.osmWay({id: 'w-2', nodes: ['n-a', 'n-1', 'n-b'], tags: { highway: 'residential' }});

        context.perform(iD.actionAddEntity(n), iD.actionAddEntity(w), iD.actionAddEntity(w_road));

        var issues = validate();
        // Victor should notice the node is missing the 'highway=crossing' tag 
        // but should NOT delete the existing 'zebra' markings.
        expect(issues).to.have.lengthOf(1);
        expect(issues[0].message).to.contain('Missing crossing tag'); 
    });


why-

- this is the case of incomplete data where node is a zebra markings but the highway it lies on dosent have highway=crossing tag. Th way is a crossing but dosent have markings tag 
- Validator might see that since the way dosent have marking so the node shouldnt have markings either. This would be a disaster 
- Instead we use Merging strategy- we first check if the node is missing highway=crossing, then we flag it. When the user hits "Fix", we adds highway=crossing to the node but leave zerbra stripes alone  
- expect(issues).to.have.lengthOf(1), confirms that validator only sees one thing wrong (the missing highway tag). It does not see the existing zebra stripes as an "error" that needs to be deleted.
- expect(issues[0].message).to.contain('Missing crossing tag')- This ensures the validator is complaining about the right thing. We want to make sure it's asking for the missing tag, not trying to delete the markings.



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
- the validator will not throw any error but the specify about mismatch "validator tag mismatch"



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


Road A (Northbound)          Road B (Southbound)
               |                            |
               |          Node 1            |          Node 2
  [Start]------|------------(X)-------------|-----------(X)------------[End]
               |      (First Junction)      |      (Second Junction)
               |                            |
               |                            |


why -

- this scenerio happens when a pedestrian crossing goes across a dual carriageway (a large road with a median or divider in the middle)
- instead of one single interaction, the crossing path hits the first road, then the second half.
- validator would check both nodes, checks if it touches road A, checks if it has zebra tags, if not then falg it. Similarly checks 2nd node. 
- this test ensures that every single spot where a pedestrian might encounter a car on the path is correctly tagged


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
- but before deleting, we should check the node if it belongs to crossable road, we must leave the crossing tags alone, even if the current way is not crossable
- This test verifies that crossing tags are preserved as long as the node has at least one crossable parent way, protecting valid data from being stripped by non-crossable features.



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
 - this acts as a "Negative test" confirming that the validator correctly ignores valid mapping patterns and does not flag errors where none exist



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


    ROAD WAY
          |
          |          n1 (Endpoint - Ignored)
          |          |
          |          *
          |          |
          |          | 
----------X----------|----------  <-- (Intersection Node - VALIDATED)
          |          |
          |          n2 (Midpoint - Shape only)
          |          |   Validator logic: "No road intersection? -> Skip"
          |          *
          |          |
          |          |
          |          *
          |          |
                     n3 (Endpoint - Ignored)

     CROSSING WAY (Path)

why -

- In this logic, if a node is simply a midpoint used to define the shape of a path, it does not need a highway=crossing label. However, if the node exists at the actual intersection of a crossing way and a road, it must carry the crossing tag to be valid
- X: The intersection. This is the only point that needs the highway=crossing and marking tags because it "connects" the path to the road.
- *: These are just midpoints or endpoints. Even though they are part of the "crossing way," they don't sit on the road, so they stay "clean" (no crossing tags).



test block -

    it('normalizes legacy crossing=zebra to crossing:markings=zebra', function() {    //this block will check the part of validator that will trigger when a user interacts with that old data.
        createCrossing({ highway: 'footway', footway: 'crossing', crossing: 'zebra' }, {});
        var issues = validate();
        // The validator should find a mismatch because the node doesn't have the markings yet
        // but it should also show that it has "cleaned" the tags for the fix
        expect(issues[0].subtype).to.eql('mismatched_crossing_tags');
    });


why -

- this block verifies that validator that will correctly identify and normalize the crossing=zebra (a legacy tag)
- this logic compares existing legacy tag on the way against crossing:marking=zebra. The validator will detect the mismatch if the intersection node is empty
- This ensures that when a user interacts with older map data, the validator automatically suggests "cleaning" the tags during the sync process.



test block -

    it('skips normalization when semicolons are present', function() {
        createCrossing({ 'crossing:markings': 'zebra;lines' }, {});
        // Logic from Section 4: If semicolons exist, return tags as-is (no sync/cleanup)
        var issues = validate();
        expect(issues).to.have.lengthOf(0);
    });

    TAG CHECK: "crossing:markings"
                |
        Does it have a ";" ?
        /              \
        YES              NO
        |                |
    [Expert Mode]   [Standard Mode]
        |                |
      SKIP!       Run Normalization
    (Stay Safe)    & Sync Logic

why -

- this block will test the function that will ignore normalization we have done in above block beacuse we have more than 1 tag value 
- this is for safety(you dont want to remove tags that you dont know want to keep)
- The Ambiguity Problem - if the way has crossing:markings=zebra;lines and node it crosses has crossing:markings=lines - the validator dosent know which one is correct? should it add zebra or remove, therefore it remains silent to avoid making wrong corrections.
- standard mappers usually select one option from a dropdown, whereas advance mappers use ; to provide extreme details. the validator will therefore catch simple mistakes(from beginners) and respect the expert mappers specialized work.


test block -
    // Point 4.3: Mapping specific signal types from crossing_ref
    it('maps crossing_ref=pelican to crossing:signals=yes', function() {
        createCrossing({ 'crossing_ref': 'pelican' }, {});
        var issues = validate();
        // This proves the normalization engine understands specific crossing types
        expect(issues[0].subtype).to.eql('mismatched_crossing_tags');
    });

why -

- In countries like the UK, mappers often use specific names for crossing types- like Pelican, Puffin, Toucan("Two-can" cross(Pedestrian + cyclists))
- When the validator sees crossing_ref=pelican, even if the mapper didnt explicitly tag crossing:signal=yes, it should know its true.
- when validator runs it should trigger mismatched_crossing_tags beacuse way has high-level info(pelican) and node is missing the specific detail(crossing:signal=yes)
- validator must flag the mismatch and when user clicks "Fix", the node gets the modern signal tag. This ensures that a routing app for a person with visual impairement knows there is a signalized button at the exact spot, even if the orignal mapper used the British "Pelican" term


test block -
    // Point 4.4: Mapping informal/unmarked legacy tags
    it('maps crossing=informal to crossing:markings=no', function() {
        createCrossing({ 'crossing': 'informal' }, {});
        var issues = validate();
        // Proves that 'informal' is recognized as 'no markings'
        expect(issues[0].subtype).to.eql('mismatched_crossing_tags');
    });


why -

- for old data - 
if the user clicks on an existing crossing that has crossing=informal, validator will flag it that this should be crossing:marking=no
- It will also provide a fix- when the user clicks "Fix", the code runs on Action that adds crossing:marking=no and removes old crossing=informal tag beacuse it is now redundant.
- for new data with Legacy tags
- if a user try to manually type legacy tag manually into the editor today(beacuse they remember it from years ago) , validator should imediately see 
- The ultimate UX goal is to "Auto-Fix" or sync these changes so the UI always reflects modern standards, regardless of how the data was entered


test block -

    // Point 4.6: Setting legacy crossing from modern signals
    it('sets crossing=traffic_signals when crossing:signals=yes is present', function() {
        // Start with ONLY modern signal tags
        createCrossing({ 'crossing:signals': 'yes' }, {});
        var issues = validate();
        // The sync/normalization should suggest adding crossing=traffic_signals
        expect(issues[0].subtype).to.eql('mismatched_crossing_tags');
    });


why-

- We have two ways of saying same thing: 
Modern(precise): crossing:signal=yes
Legacy(Broad): crossing=traffic_signal
- if a mapper adds the modern crossing:signals=yes tag, validator should check if the legacy equivalent is there. If its missing, it should be flagged as missing tag.
- This test verifies that the validator maintains "Parallel Tagging." If a mapper provides the modern detail, the validator ensures the legacy equivalent is also present so the map remains functional across all platforms, the fix will suggest adding crossing=traffic_signal to ensure the data is complete for both old and new systems.


test block-

    it('upgrades legacy crossing=yes to crossing=marked when markings are present', function() {
        createCrossing({ 'crossing': 'yes', 'crossing:markings': 'zebra' }, {});
        var issues = validate();
        // This should trigger a cleanup that prefers the specific 'marked' over the vague 'yes'
        expect(issues[0].subtype).to.eql('mismatched_crossing_tags');
    });


why -

- This block targets legacy 'crossing=yes' tags. In modern OSM standards, if specific markings (like 'zebra') are present, the primary tag should be 'crossing=marked' rather than the vague 'yes'. The validator "triggers a modernization fix." to upgrade old data to current specifications when they interact with it in the editor.
 


code block -

    // 6. EDGE CASES (Section 6)

    it('does not suggest removing tags from a standalone crossing node', function() {
        // Create a node with crossing tags but NO parent ways
        var n1 = iD.osmNode({id: 'n-1', loc: [0,0], tags: { 'crossing:markings': 'zebra', 'highway': 'crossing' }});
        context.perform(iD.actionAddEntity(n1));
        
        var issues = validate();
        // Should be 0 issues because the validator avoids "false remove-all" on standalone nodes
        expect(issues).to.have.lengthOf(0);
    });

    //     (NO Crossing Way here)
    //          
    //                   
    // -----------------(X)-----------------  <-- highway=residential (The Road)
    //                   
    //                   
    //             NODE (X) tags:
    //             - highway=crossing
    //             - crossing:markings=zebra


why -


- This test covers nodes that are placed on a road but aren't yet connected to a crossing path (footway). if the validator only looked for a parent crossing way, it would see this node and might incorrectly conclude that beacuse there is no crossing path , the tag shouldnt exist and should be deleted.
- if the validator automatically suggest, "remove all tags" for standalone node, a user might delete thousands of valid crossings globally just beacuse they werent connected to a crossing way 
- since validator cannot prove these tags are wrong, its better to not flag an issue