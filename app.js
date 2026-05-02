const { createApp, ref, computed, onMounted, watch } = Vue;

createApp({
    setup() {
        // Application State
        const isLoading = ref(true);
        const isDarkMode = ref(true);
        const showLeftSidebar = ref(true);
        const showRightSidebar = ref(true);

        // Search State
        const searchQuery = ref('');
        const searchResults = ref([]);

        // Network State
        const currentNetworkMode = ref('coauthor');
        const networkStats = ref({ nodes: 0, edges: 0 });

        // Selection State
        const selectedNodeId = ref(null);
        const selectedGroupIndex = ref(null);

        // Shortest Path State
        const pathTargetQuery = ref('');
        const pathTargetResults = ref([]);
        const pathTargetId = ref(null);
        const pathIgnoreWeights = ref(false);
        const shortestPathInfo = ref(null);

        // Visual Configuration State
        const colorBy = ref('uniform');
        const sizeBy = ref('uniform');
        const layoutAlgorithm = ref('fcose');
        const showLabels = ref(true);

        // Export Configuration
        const exportConfig = ref({
            scope: 'full',
            background: 'transparent',
            format: 'png'
        });

        // Data Stores
        let authorsData = {};
        let publicationsData = {};
        let edgesData = [];
        const groupsList = ref([]);
        const groupsSections = ref([]);
        const groupsDescription = ref('');

        // Cytoscape Instance
        let cy = null;

        // --- Computed Properties ---

        const selectedNodeData = computed(() => {
            if (!selectedNodeId.value || !authorsData[selectedNodeId.value]) return null;
            const author = authorsData[selectedNodeId.value];

            // Find which group(s) the author belongs to
            let authorGroups = [];
            groupsList.value.forEach(group => {
                if (group.authors && group.authors.some(a => a.orcid === author.orcid || a.name === author.name)) {
                    authorGroups.push(group.label);
                }
            });
            const groupText = authorGroups.length > 0 ? authorGroups.join(', ') : 'Unknown';

            return {
                id: selectedNodeId.value,
                name: author.name,
                orcid: author.orcid,
                n_work: author.n_work,
                n_citation: author.n_citation,
                stat_h: author.stat_h,
                stat_i10: author.stat_i10,
                group: groupText
            };
        });

        const selectedNodeNeighbors = computed(() => {
            if (!selectedNodeId.value || !cy) return [];

            // Find edges connected to the selected node in the current graph
            const cyNode = cy.$(`node[id = "${selectedNodeId.value}"]`);
            if (cyNode.empty()) return [];

            const connectedEdges = cyNode.connectedEdges();
            const neighbors = [];

            connectedEdges.forEach(edge => {
                const target = edge.target();
                const source = edge.source();
                const neighborCy = target.id() === selectedNodeId.value ? source : target;
                const neighborId = neighborCy.id();

                if (authorsData[neighborId]) {
                    neighbors.push({
                        id: neighborId,
                        name: authorsData[neighborId].name,
                        weight: Number(parseFloat(edge.data('weight') || 1).toFixed(3))
                    });
                }
            });

            // Sort by weight descending
            return neighbors.sort((a, b) => b.weight - a.weight).slice(0, 10); // Show top 10
        });

        const selectedNodePublications = computed(() => {
            if (!selectedNodeId.value || !authorsData[selectedNodeId.value]) return [];
            const ids = authorsData[selectedNodeId.value].publications || [];
            return ids.map(id => {
                const pub = publicationsData[id];
                return pub ? { id, ...pub } : { id, title: 'Unknown Publication' };
            }).sort((a, b) => (b.n_citation || 0) - (a.n_citation || 0));
        });

        let sidebarAuthorChartInstance = null;

        const updateAuthorChart = () => {
            const pubs = selectedNodePublications.value;
            if (pubs.length === 0) return;

            // Aggregation
            const yearsMap = {}; // pub count
            const citationsMap = {}; // citation count
            let minYear = new Date().getFullYear();
            let maxYear = 0;

            pubs.forEach(p => {
                if (p.year) {
                    const y = parseInt(p.year);
                    yearsMap[y] = (yearsMap[y] || 0) + 1;
                    citationsMap[y] = (citationsMap[y] || 0) + (parseInt(p.n_citation) || 0);
                    if (y < minYear) minYear = y;
                    if (y > maxYear) maxYear = y;
                }
            });

            // Ensure all years between min and max are present
            const labels = [];
            const pubData = [];
            const citeData = [];
            if (maxYear > 0) {
                for (let y = minYear; y <= maxYear; y++) {
                    labels.push(y);
                    pubData.push(yearsMap[y] || 0);
                    citeData.push(citationsMap[y] || 0);
                }
            }

            const ctxSidebar = document.getElementById('sidebarAuthorChart');
            
            const isDark = isDarkMode.value;
            const textColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
            const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

            // Helper to create chart config
            const getChartConfig = (type, datasets) => ({
                type: type,
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                            titleColor: isDark ? '#ffffff' : '#1e293b',
                            bodyColor: isDark ? '#ffffff' : '#1e293b',
                            borderColor: '#4361ee',
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: {
                            ticks: { 
                                color: textColor,
                                autoSkip: labels.length > 10,
                                font: { size: 9 }
                            },
                            grid: { display: false }
                        },
                        y: {
                            beginAtZero: true,
                            position: 'left',
                            ticks: { color: textColor, precision: 0, font: { size: 9 } },
                            grid: { color: gridColor },
                            title: { display: false }
                        },
                        y1: {
                            beginAtZero: true,
                            position: 'right',
                            display: datasets.some(d => d.yAxisID === 'y1'),
                            ticks: { color: textColor, precision: 0, font: { size: 9 } },
                            grid: { drawOnChartArea: false },
                            title: { display: false }
                        }
                    }
                }
            });

            // Update/Create Sidebar Chart
            if (ctxSidebar) {
                if (sidebarAuthorChartInstance) sidebarAuthorChartInstance.destroy();
                sidebarAuthorChartInstance = new Chart(ctxSidebar, getChartConfig('bar', [
                    {
                        label: 'Papers',
                        data: pubData,
                        backgroundColor: 'rgba(67, 97, 238, 0.5)',
                        borderColor: '#4361ee',
                        borderWidth: 1,
                        borderRadius: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Citations',
                        data: citeData,
                        type: 'line',
                        borderColor: '#f72585',
                        backgroundColor: '#f72585',
                        borderWidth: 2,
                        pointRadius: 1,
                        tension: 0.3,
                        yAxisID: 'y1'
                    }
                ]));
            }
        };

        // Watch for Changes
        watch(selectedNodeId, (newId) => {
            if (newId) {
                // Wait for Vue to update data before rendering sidebar chart
                setTimeout(updateAuthorChart, 50);
            }
        });

        // --- Methods ---

        const formatNumber = (num) => {
            return new Intl.NumberFormat('en-US').format(num || 0);
        };

        const toggleTheme = () => {
            isDarkMode.value = !isDarkMode.value;
            document.documentElement.setAttribute('data-bs-theme', isDarkMode.value ? 'dark' : 'light');
            updateGraphStyles();
            // Update sidebar chart if it exists
            if (sidebarAuthorChartInstance) {
                updateAuthorChart();
            }
        };

        const onSearch = () => {
            const query = searchQuery.value.toLowerCase().trim();
            if (query.length < 2) {
                searchResults.value = [];
                return;
            }

            const results = Object.entries(authorsData)
                .map(([id, data]) => ({ id, ...data }))
                .filter(author => author.name && author.name.toLowerCase().includes(query))
                .sort((a, b) => b.n_work - a.n_work) // Sort by number of works prioritizing high-profile authors
                .slice(0, 8); // Top 8 results

            searchResults.value = results;
        };

        const selectAuthorFromSearch = (id) => {
            selectedNodeId.value = id;
            selectedGroupIndex.value = null; // Clear active group
            searchQuery.value = '';
            searchResults.value = [];
            showRightSidebar.value = true; // Auto-open right panel

            // Center Graph on Node
            if (cy) {
                const node = cy.$(`node[id = "${id}"]`);
                if (!node.empty()) {
                    cy.animate({
                        center: { eles: node },
                        zoom: 1.5
                    }, { duration: 500 });
                }
            }
        };

        const onPathSearch = () => {
            const query = pathTargetQuery.value.toLowerCase().trim();
            if (query.length < 2) {
                pathTargetResults.value = [];
                return;
            }

            const results = Object.entries(authorsData)
                .map(([id, data]) => ({ id, ...data }))
                .filter(author => 
                    author.name && 
                    author.name.toLowerCase().includes(query) && 
                    author.id !== selectedNodeId.value
                )
                .sort((a, b) => b.n_work - a.n_work)
                .slice(0, 5);

            pathTargetResults.value = results;
        };

        const selectPathTarget = (id) => {
            pathTargetId.value = id;
            pathTargetQuery.value = '';
            pathTargetResults.value = [];
            calculateShortestPath();
        };

        const calculateShortestPath = () => {
            if (!cy || !selectedNodeId.value || !pathTargetId.value) return;

            const root = cy.$(`node[id = "${selectedNodeId.value}"]`);
            const target = cy.$(`node[id = "${pathTargetId.value}"]`);

            if (root.empty() || target.empty()) {
                shortestPathInfo.value = { found: false };
                return;
            }

            // Dijkstra's algorithm
            const dijkstra = cy.elements().dijkstra(root, (edge) => {
                if (pathIgnoreWeights.value) return 1;
                // Return 1 / weight since higher similarity means "closer"
                const w = parseFloat(edge.data('weight')) || 1;
                return 1 / (w + 0.1); 
            });

            const path = dijkstra.pathTo(target);
            
            if (path.length > 0) {
                shortestPathInfo.value = {
                    found: true,
                    distance: Math.floor((path.length - 1) / 2), // edges count
                    targetName: authorsData[pathTargetId.value]?.name || 'Unknown'
                };
                highlightSelection();
                
                // Animate view to show the path
                cy.animate({
                    fit: { eles: path, padding: 50 },
                    duration: 500
                });
            } else {
                shortestPathInfo.value = { found: false };
                highlightSelection();
            }
        };

        const clearPath = () => {
            pathTargetId.value = null;
            pathTargetQuery.value = '';
            pathTargetResults.value = [];
            shortestPathInfo.value = null;
            highlightSelection();
        };

        const selectGroup = (indexOrChapter) => {
            // Support both index (old) and chapter object (new)
            let chapter;
            if (typeof indexOrChapter === 'number') {
                chapter = groupsList.value[indexOrChapter];
            } else {
                chapter = indexOrChapter;
            }

            if (!chapter) return;

            const chapterId = chapter.chapter;
            selectedGroupIndex.value = chapterId === selectedGroupIndex.value ? null : chapterId;

            if (selectedGroupIndex.value !== null) {
                selectedNodeId.value = null; // Clear individual node selection
                searchQuery.value = '';

                if (cy) {
                    const nodeIds = getGroupNodes(chapter);
                    if (nodeIds.length > 0) {
                        const selector = nodeIds.map(id => `node[id = "${id}"]`).join(', ');
                        const groupNodes = cy.$(selector);

                        if (!groupNodes.empty()) {
                            cy.animate({
                                fit: { eles: groupNodes, padding: 50 }
                            }, { duration: 500 });
                        }
                    }
                }
            } else if (cy) {
                // Return to full view when toggled off
                cy.animate({
                    fit: { padding: 50 }
                }, { duration: 500 });
            }
        };

        const getGroupNodes = (chapter) => {
            const nodeIds = [];
            if (!chapter || !chapter.authors) return nodeIds;

            chapter.authors.forEach(groupAuthor => {
                // Match by ORCID first
                if (groupAuthor.orcid && groupAuthor.orcid !== "None" && groupAuthor.orcid !== "") {
                    const match = Object.entries(authorsData).find(([id, data]) => data.orcid === groupAuthor.orcid);
                    if (match) {
                        nodeIds.push(match[0]);
                        return;
                    }
                }
                // Fallback to name match (be careful with variations)
                const nameMatch = Object.entries(authorsData).find(([id, data]) => 
                    data.name && data.name.toLowerCase() === groupAuthor.name.toLowerCase()
                );
                if (nameMatch) {
                    nodeIds.push(nameMatch[0]);
                }
            });
            return nodeIds;
        };

        const handleQueryParams = () => {
            const params = new URLSearchParams(window.location.search);
            const authorId = params.get('author');
            const chapterId = params.get('chapter');

            if (authorId && authorsData[authorId]) {
                console.log(`[URL] Auto-selecting author: ${authorId}`);
                selectAuthorFromSearch(authorId);
            } else if (chapterId) {
                const chapterNum = parseInt(chapterId);
                const chapter = groupsList.value.find(g => g.chapter === chapterNum);
                if (chapter) {
                    console.log(`[URL] Auto-selecting chapter: ${chapterNum}`);
                    selectGroup(chapter);
                    
                    // Also expand the corresponding accordion
                    const sIndex = groupsSections.value.findIndex(s => s.chapters.includes(chapterNum));
                    if (sIndex !== -1) {
                        setTimeout(() => {
                            const btn = document.querySelector(`[data-bs-target="#flush-collapse${sIndex}"]`);
                            if (btn && btn.classList.contains('collapsed')) {
                                btn.click();
                            }
                        }, 500);
                    }
                }
            }
        };

        const loadNetworkEdges = async (mode) => {
            console.log(`[Network] Loading mode: ${mode}`);
            isLoading.value = true;
            let filename = '';
            if (mode === 'coauthor') filename = 'coauthor-net.edges';
            else if (mode === 'cocitation') filename = 'cocitation-net.edges';
            else if (mode === 'cociting') filename = 'cociting-net.edges';
            else if (mode === 'fieldsim') filename = 'fieldsim-net.edges';

            try {
                // Add timestamp as cache-buster
                const edgesRes = await fetch(`data/${filename}?t=${Date.now()}`);
                if (!edgesRes.ok) throw new Error(`File ${filename} not found`);
                const edgesText = await edgesRes.text();

                // Parse edge list (format: node1,node2,weight)
                edgesData = edgesText.trim().split('\n').map(line => {
                    const parts = line.split(',');
                    return {
                        source: parts[0]?.trim() || '',
                        target: parts[1]?.trim() || '',
                        weight: parseFloat(parts[2]?.trim()) || 1
                    };
                }).filter(e => e.source && e.target);

                setTimeout(() => {
                    initCytoscape();
                    isLoading.value = false;
                }, 50);
            } catch (error) {
                console.warn(`Continuing with empty graph: ${error.message}`);
                edgesData = []; // Load blank graph if edges missing

                setTimeout(() => {
                    initCytoscape();
                    isLoading.value = false;
                }, 50);
            }
        };

        watch(currentNetworkMode, (newMode) => {
            loadNetworkEdges(newMode);
        });

        // --- Network and Data Loading ---

        const loadData = async () => {
            try {
                // Fetch Core JSONs
                const [authorsRes, publicationsRes, groupsRes] = await Promise.all([
                    fetch('data/authors.json'),
                    fetch('data/publications.json'),
                    fetch('data/groups-updated.json').catch(e => null) // Optional fail-safe
                ]);

                authorsData = await authorsRes.json();
                publicationsData = await publicationsRes.json();

                if (groupsRes && groupsRes.ok) {
                    const parsedGroups = await groupsRes.json();
                    groupsList.value = parsedGroups.groups || [];
                    groupsSections.value = parsedGroups.sections || [];
                    groupsDescription.value = parsedGroups.description || '';
                }

                // Initiate edge loading for whatever mode is actively selected
                await loadNetworkEdges(currentNetworkMode.value);

                // Handle deep linking after first load
                setTimeout(handleQueryParams, 800);

            } catch (error) {
                console.error("Error loading core data:", error);
                alert("Failed to load foundational authors/publications data. Please check console.");
                isLoading.value = false;
            }
        };

        const initCytoscape = () => {
            if (cy) {
                cy.destroy(); // Safely unmount old canvas context
            }

            const elements = [];
            const nodesSet = new Set();

            // First pass to compute degree map
            const degreeMap = {};
            edgesData.forEach(edge => {
                degreeMap[edge.source] = (degreeMap[edge.source] || 0) + 1;
                degreeMap[edge.target] = (degreeMap[edge.target] || 0) + 1;
            });

            // Add all known authors as nodes first to ensure singletons (0 edges) are mapped
            Object.keys(authorsData).forEach(nodeId => {
                nodesSet.add(nodeId);
                const author = authorsData[nodeId];
                elements.push({
                    data: {
                        id: nodeId,
                        name: author.name || nodeId,
                        publications: author.n_work || 1,
                        citations: author.n_citation || 0,
                        h_index: author.stat_h || 0,
                        degree: degreeMap[nodeId] || 0
                    }
                });
            });

            // Build Edge Elements and pick up any ghost nodes not present in authorsData
            edgesData.forEach(edge => {
                [edge.source, edge.target].forEach(nodeId => {
                    if (!nodesSet.has(nodeId)) {
                        nodesSet.add(nodeId);
                        elements.push({
                            data: {
                                id: nodeId,
                                name: nodeId,
                                publications: 1,
                                citations: 0,
                                h_index: 0,
                                degree: degreeMap[nodeId] || 0
                            }
                        });
                    }
                });

                elements.push({
                    data: {
                        id: `${edge.source}-${edge.target}`,
                        source: edge.source,
                        target: edge.target,
                        weight: edge.weight
                    }
                });
            });

            networkStats.value.nodes = nodesSet.size;
            networkStats.value.edges = edgesData.length;

            cy = cytoscape({
                container: document.getElementById('cy'),
                elements: elements,
                style: getCytoscapeStyles(),
                layout: getLayoutOptions(),
                minZoom: 0.1,
                maxZoom: 4,
                wheelSensitivity: 0.2
            });

            // Interaction Events
            cy.on('tap', 'node', function (evt) {
                const node = evt.target;
                selectedGroupIndex.value = null; // Clear group context
                selectedNodeId.value = node.id();
                showRightSidebar.value = true;
            });

            cy.on('tap', function (evt) {
                if (evt.target === cy) {
                    selectedNodeId.value = null; // clicked background
                    selectedGroupIndex.value = null;
                }
            });

            highlightSelection();
        };

        const updateGraphStyles = () => {
            if (!cy) return;
            cy.style().fromJson(getCytoscapeStyles()).update();
        };

        const updateGraphStylesAndLayout = () => {
            updateGraphStyles();
            // Let the engine visually register the newly painted geometry bounds, then run the physics
            setTimeout(() => {
                runLayout();
            }, 50);
        };

        const runLayout = () => {
            if (!cy) return;
            const layout = cy.layout(getLayoutOptions());
            layout.run();
        };

        const getLayoutOptions = () => {
            if (layoutAlgorithm.value === 'fcose') {
                return {
                    name: 'fcose',
                    quality: 'default',
                    randomize: true,
                    animate: true,
                    animationDuration: 2000,
                    fit: true,
                    padding: 50,

                    // Specific to fCOSE for homogeneous spreading and packing
                    packComponents: true, // This algorithm perfectly packs small disconnected components 
                    nodeSeparation: 150, // Massive separation boundary to guarantee physical bounding box buffers

                    idealEdgeLength: function (edge) {
                        const w = edge.data('weight') || 1;
                        // Math.min cap prevents extremely small decimal weights (e.g. 0.01 similarity) 
                        // from mapping to explosive 25,000+ pixel edge lengths that freeze the renderer.
                        return Math.min(600, Math.max(100, 250 / Math.max(w, 0.1)));
                    },
                    // Scale repulsion exponentially so large nodes actively shove their neighbors away
                    nodeRepulsion: function (node) {
                        const degree = node.data('degree') || 1;
                        return 4500 + (degree * 1500);
                    },
                    edgeElasticity: function (edge) {
                        const w = edge.data('weight') || 1;
                        return 0.45 * w; // fCOSE uses different scale for elasticity (default is 0.45)
                    },
                    gravity: 0.02, // Severely weakened gravity so nodes can float apart without being crushed tightly
                    numIter: 2500,
                    initialTemp: 200,
                    coolingFactor: 0.95,
                    minTemp: 1.0
                };
            } else if (layoutAlgorithm.value === 'concentric') {
                return {
                    name: 'concentric',
                    concentric: function (node) {
                        return node.data('citations'); // high citations in center
                    },
                    levelWidth: function (_nodes) { return 100; },
                    animate: true
                };
            }
            // fallback
            return {
                name: 'circle',
                animate: true
            };
        };

        const getCytoscapeStyles = () => {
            const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
            const nodeColor = isDark ? '#f8f9fa' : '#4cc9f0';
            const edgeColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
            const labelColor = isDark ? '#f8f9fa' : '#1a1e23';
            const labelOutline = isDark ? '#0b0f19' : '#f0f4f8';

            const dynamicPrimaryColor = isDark ? '#6c72e6' : '#212469';

            // Determine Dynamic Colors
            let nodeBgColor;
            if (colorBy.value === 'uniform') {
                nodeBgColor = dynamicPrimaryColor;
            } else if (colorBy.value === 'h_index') {
                nodeBgColor = `mapData(h_index, 0, 50, #4cc9f0, ${dynamicPrimaryColor})`;
            } else if (colorBy.value === 'citations') {
                nodeBgColor = `mapData(citations, 0, 5000, #4cc9f0, ${dynamicPrimaryColor})`;
            }

            let nodeSize = 20; // Reduced node size
            if (sizeBy.value === 'publications') {
                nodeSize = 'mapData(publications, 1, 200, 15, 60)';
            } else if (sizeBy.value === 'degree') {
                nodeSize = 'mapData(degree, 1, 50, 15, 60)';
            }

            return [
                {
                    selector: 'node',
                    style: {
                        'background-color': nodeBgColor,
                        'width': nodeSize,
                        'height': nodeSize,
                        'label': showLabels.value ? 'data(name)' : '',
                        'color': labelColor,
                        'text-outline-color': labelOutline,
                        'text-outline-width': 2,
                        'font-size': '10px',
                        'font-family': 'Inter',
                        'text-valign': 'bottom',
                        'text-margin-y': 5,
                        'transition-property': 'background-color, width, height, opacity',
                        'transition-duration': 0.3
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 'mapData(weight, 1, 10, 1, 5)',
                        'line-color': edgeColor,
                        'curve-style': 'bezier',
                        'opacity': 0.6,
                        'transition-property': 'line-color, opacity, width',
                        'transition-duration': 0.3
                    }
                },
                // Highlighting States
                {
                    selector: 'node.highlighted',
                    style: {
                        'background-color': '#f72585',
                        'border-width': 3,
                        'border-color': '#ffffff',
                        'opacity': 1,
                        'z-index': 10
                    }
                },
                {
                    selector: 'node.neighbor',
                    style: {
                        'background-color': '#4cc9f0',
                        'opacity': 1,
                        'z-index': 9
                    }
                },
                {
                    selector: 'edge.highlighted',
                    style: {
                        'line-color': dynamicPrimaryColor,
                        'opacity': 1,
                        'z-index': 9
                    }
                },
                {
                    selector: 'edge.neighbor-edge',
                    style: {
                        'line-color': '#4cc9f0',
                        'opacity': 0.5,
                        'z-index': 8
                    }
                },
                {
                    selector: 'node.faded',
                    style: {
                        'opacity': 0.1
                    }
                },
                {
                    selector: 'edge.faded',
                    style: {
                        'opacity': 0.05
                    }
                },
                // Path Highlighting
                {
                    selector: 'node.path-highlight',
                    style: {
                        'background-color': '#00f5d4',
                        'border-width': 4,
                        'border-color': '#ffffff',
                        'z-index': 20,
                        'opacity': 1
                    }
                },
                {
                    selector: 'edge.path-edge-highlight',
                    style: {
                        'line-color': '#00f5d4',
                        'width': 6,
                        'opacity': 1,
                        'z-index': 19
                    }
                }
            ];
        };

        const highlightSelection = () => {
            if (!cy) return;

            cy.elements().removeClass('highlighted neighbor neighbor-edge faded path-highlight path-edge-highlight');

            if (pathTargetId.value && selectedNodeId.value) {
                // Shortest Path Highlighting Mode
                const root = cy.$(`node[id = "${selectedNodeId.value}"]`);
                const target = cy.$(`node[id = "${pathTargetId.value}"]`);
                
                const dijkstra = cy.elements().dijkstra(root, (edge) => {
                    if (pathIgnoreWeights.value) return 1;
                    const w = parseFloat(edge.data('weight')) || 1;
                    return 1 / (w + 0.1);
                });
                const path = dijkstra.pathTo(target);

                if (path.length > 0) {
                    cy.elements().addClass('faded');
                    path.removeClass('faded');
                    path.nodes().addClass('path-highlight');
                    path.edges().addClass('path-edge-highlight');
                    
                    // Specific start/end markers
                    root.addClass('highlighted');
                    target.addClass('highlighted');
                } else {
                    // Fallback to normal highlighting if no path
                    applyNormalHighlighting();
                }
            } else {
                applyNormalHighlighting();
            }
        };

        const applyNormalHighlighting = () => {
            if (!cy) return;

            if (selectedNodeId.value) {
                const node = cy.$(`node[id = "${selectedNodeId.value}"]`);
                if (!node.empty()) {
                    const neighborNodes = node.neighborhood('node');
                    const directEdges = node.connectedEdges();
                    const crossEdges = neighborNodes.edgesWith(neighborNodes);

                    cy.elements().addClass('faded');
                    node.removeClass('faded').addClass('highlighted');
                    neighborNodes.removeClass('faded').addClass('neighbor');
                    directEdges.removeClass('faded').addClass('highlighted');
                    crossEdges.removeClass('faded').addClass('neighbor-edge');
                }
            } else if (selectedGroupIndex.value !== null) {
                const chapter = groupsList.value.find(g => g.chapter === selectedGroupIndex.value);
                if (chapter) {
                    const nodeIds = getGroupNodes(chapter);
                    if (nodeIds.length > 0) {
                        const selector = nodeIds.map(id => `node[id = "${id}"]`).join(', ');
                        const groupNodes = cy.$(selector);

                        if (!groupNodes.empty()) {
                            const crossEdges = groupNodes.edgesWith(groupNodes);
                            cy.elements().addClass('faded');
                            groupNodes.removeClass('faded').addClass('highlighted');
                            crossEdges.removeClass('faded').addClass('neighbor-edge');
                        }
                    }
                }
            }
        };

        // Watch for Changes
        watch([selectedNodeId, selectedGroupIndex, pathTargetId], () => {
            highlightSelection();
        });

        // Update URL with selection parameters
        watch([selectedNodeId, selectedGroupIndex], ([nodeId, groupIdx]) => {
            const url = new URL(window.location);
            if (nodeId) {
                url.searchParams.set('author', nodeId);
                url.searchParams.delete('chapter');
            } else if (groupIdx) {
                url.searchParams.set('chapter', groupIdx);
                url.searchParams.delete('author');
            } else {
                url.searchParams.delete('author');
                url.searchParams.delete('chapter');
            }
            window.history.replaceState({}, '', url);
        });

        // Clear path if selected node changes
        watch(selectedNodeId, () => {
            pathTargetId.value = null;
            pathTargetQuery.value = '';
            pathTargetResults.value = [];
            shortestPathInfo.value = null;
        });

        watch(pathIgnoreWeights, () => {
            if (pathTargetId.value) {
                calculateShortestPath();
            }
        });

        // Lifecycle
        onMounted(() => {
            loadData();
        });

        const executeExport = () => {
            if (!cy) return;

            const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
            const bgColor = exportConfig.value.background === 'transparent'
                ? 'transparent'
                : (isDark ? '#0b0f19' : '#f8f9fa');

            const fullScope = exportConfig.value.scope === 'full';
            const format = exportConfig.value.format;
            const scopeName = fullScope ? 'full' : 'view';

            // Calculate Optimal Scale to respect 2000px width limit
            const maxDimension = 2000;
            const bbox = fullScope ? cy.elements().boundingBox() : { w: cy.width(), h: cy.height() };
            const currentWidth = bbox.w || 1000;
            
            // Default target scales: 2x for full graph quality, 1x for view
            let targetScale = fullScope ? 2 : 1;
            // Cap scale if it would exceed 2000px
            const maxAllowedScale = maxDimension / currentWidth;
            const finalScale = Math.min(targetScale, maxAllowedScale);

            console.log(`[Export] Format: ${format}, Scale: ${finalScale.toFixed(2)}, Final Width: ${Math.round(currentWidth * finalScale)}px`);

            if (format === 'svg') {
                const svgContent = cy.svg({ scale: finalScale, full: fullScope, bg: bgColor });
                const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `network-export-${currentNetworkMode.value}-${scopeName}-${Date.now()}.svg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                // PNG and PDF both start with a scaled PNG
                const pngContent = cy.png({ 
                    scale: finalScale, 
                    full: fullScope, 
                    bg: bgColor 
                });

                if (format === 'png') {
                    const link = document.createElement('a');
                    link.href = pngContent;
                    link.download = `network-export-${currentNetworkMode.value}-${scopeName}-${Date.now()}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else if (format === 'pdf') {
                    const img = new Image();
                    img.onload = () => {
                        try {
                            // Support both window.jspdf and window.jspdf.jsPDF depending on bundle version
                            const jsPDFClass = window.jspdf?.jsPDF || window.jsPDF;
                            if (!jsPDFClass) {
                                throw new Error("jsPDF library not found in window scope");
                            }

                            const orientation = img.width > img.height ? 'l' : 'p';
                            const doc = new jsPDFClass({
                                orientation: orientation,
                                unit: 'px',
                                format: [img.width, img.height]
                            });

                            doc.addImage(pngContent, 'PNG', 0, 0, img.width, img.height);
                            doc.save(`network-export-${currentNetworkMode.value}-${scopeName}-${Date.now()}.pdf`);
                        } catch (err) {
                            console.error("PDF Export Error:", err);
                            alert("Failed to generate PDF. Check console for details.");
                        }
                    };
                    img.onerror = () => {
                        console.error("Failed to load PNG for PDF conversion");
                        alert("Failed to process network image for PDF export.");
                    };
                    img.src = pngContent;
                }
            }
        };

        const getChapter = (id) => {
            return groupsList.value.find(g => g.chapter === id);
        };

        return {
            isLoading,
            isDarkMode,
            showLeftSidebar,
            showRightSidebar,
            searchQuery,
            searchResults,
            currentNetworkMode,
            networkStats,
            selectedNodeId,
            selectedGroupIndex,
            pathTargetQuery,
            pathTargetResults,
            pathTargetId,
            pathIgnoreWeights,
            shortestPathInfo,
            colorBy,
            sizeBy,
            layoutAlgorithm,
            showLabels,
            exportConfig,
            groupsList,
            groupsSections,
            groupsDescription,
            selectedNodeData,
            selectedNodeNeighbors,
            selectedNodePublications,
            formatNumber,
            toggleTheme,
            onSearch,
            selectAuthorFromSearch,
            onPathSearch,
            selectPathTarget,
            clearPath,
            selectGroup,
            getChapter,
            loadNetworkEdges,
            runLayout,
            updateGraphStyles,
            updateGraphStylesAndLayout,
            executeExport
        };
    }
}).mount('#app');
